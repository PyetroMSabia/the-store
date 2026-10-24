import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { hashPasswordSync } from "./password.js";

/**
 * Banco de dados relacional da The Store (SQLite via `node:sqlite`, nativo do Node ≥ 22).
 *
 * - Arquivo persistente em `data/the-store.db` (ou `DATABASE_PATH`).
 * - Migrações versionadas com `PRAGMA user_version` — nunca edite uma migração já
 *   aplicada; adicione uma nova ao final do array `MIGRATIONS`.
 * - Toda a aplicação acessa o banco através dos repositórios em `lib/*.js`, então
 *   migrar para Postgres/Supabase no futuro só exige trocar esta camada.
 */

// `getBuiltinModule` evita que o bundler tente resolver o módulo nativo.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite");

function getDbPath() {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;

  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (process.env.NODE_ENV === "production" && process.platform !== "win32")
  );

  const localSeedPath = path.join(process.cwd(), "data", "the-store.db");

  if (isServerless) {
    const tmpDbPath = path.join("/tmp", "the-store.db");
    try {
      if (!fs.existsSync(tmpDbPath) && fs.existsSync(localSeedPath)) {
        fs.copyFileSync(localSeedPath, tmpDbPath);
      }
    } catch (copyErr) {
      console.warn("[the-store] Aviso ao copiar base SQLite semente para /tmp:", copyErr.message);
    }
    return tmpDbPath;
  }

  return localSeedPath;
}

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";

const MIGRATIONS = [
  // v1 — schema inicial
  `
  CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
    created_at    TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE products (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    price         REAL NOT NULL CHECK (price > 0),
    rating        REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
    image_url     TEXT NOT NULL,
    affiliate_url TEXT NOT NULL,
    store_name    TEXT NOT NULL,
    category      TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT ${NOW},
    -- colunas auxiliares
    old_price     REAL CHECK (old_price IS NULL OR old_price > 0),
    source_url    TEXT,
    description   TEXT,
    click_count   INTEGER NOT NULL DEFAULT 0,
    updated_at    TEXT
  );
  CREATE INDEX idx_products_category ON products (category, created_at DESC);
  CREATE INDEX idx_products_created ON products (created_at DESC);

  CREATE TABLE sessions (
    id         TEXT PRIMARY KEY,               -- sha256 do token de sessão
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,               -- epoch ms
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX idx_sessions_user ON sessions (user_id);

  CREATE TABLE password_resets (
    token_hash TEXT PRIMARY KEY,               -- sha256 do token enviado por e-mail
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at    INTEGER,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE favorites (
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    PRIMARY KEY (user_id, product_id)
  );

  CREATE TABLE cart_items (
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 99),
    created_at TEXT NOT NULL DEFAULT ${NOW},
    PRIMARY KEY (user_id, product_id)
  );
  `,
  // v2 — suporte a múltiplas lojas onde o produto está disponível
  `
  ALTER TABLE products ADD COLUMN available_stores TEXT;
  `,
  // v3 — suporte a múltiplos links/ofertas, galeria de imagens e resumo inteligente por IA
  `
  ALTER TABLE products ADD COLUMN offers TEXT;
  ALTER TABLE products ADD COLUMN images TEXT;
  ALTER TABLE products ADD COLUMN ai_summary TEXT;
  `,
  // v4 — tabela de pedidos finalizados dentro da The Store
  `
  CREATE TABLE orders (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    store_name       TEXT NOT NULL,
    subtotal         REAL NOT NULL,
    shipping_amount  REAL NOT NULL DEFAULT 0,
    total_amount     REAL NOT NULL,
    status           TEXT NOT NULL DEFAULT 'CONFIRMED',
    payment_method   TEXT NOT NULL,
    tracking_code    TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    items            TEXT NOT NULL,
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX idx_orders_user ON orders (user_id, created_at DESC);
  `,
  // v5 — personalização de perfil do usuário (avatar, biografia e preferências)
  `
  ALTER TABLE users ADD COLUMN avatar_url TEXT;
  ALTER TABLE users ADD COLUMN bio TEXT;
  ALTER TABLE users ADD COLUMN preferences TEXT;
  `,
];

function migrate(db) {
  const { user_version: current } = db.prepare("PRAGMA user_version").get();
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(`Falha na migração v${v + 1}: ${err.message}`);
    }
  }
}

/**
 * Garante que a credencial de administrador definida no `.env.local` exista no banco.
 * - Se o e-mail não existir: cria o usuário com role ADMIN e nova senha.
 * - Se existir: atualiza o password_hash para a nova senha e força role = ADMIN.
 * - Remove ou rebaixa a conta antiga admin@thestore.local.
 */
function seedAdmin(db) {
  const email = (process.env.ADMIN_EMAIL || "thestore@gmail.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "TheStore2026@";
  if (!email || !password) return;

  const hash = hashPasswordSync(password);
  const name = process.env.ADMIN_NAME?.trim() || "Curador The Store";

  const existing = db.prepare("SELECT id, role FROM users WHERE email = ?").get(email);
  if (existing) {
    db.prepare("UPDATE users SET password_hash = ?, role = 'ADMIN', name = ? WHERE id = ?").run(hash, name, existing.id);
  } else {
    db.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'ADMIN')").run(
      "admin-master",
      name,
      email,
      hash
    );
    console.info(`[the-store] Usuário administrador criado: ${email}`);
  }

  // Remove conta antiga admin@thestore.local
  try {
    db.prepare("DELETE FROM users WHERE email = 'admin@thestore.local'").run();
  } catch {}
}


function open() {
  try {
    const dbPath = getDbPath();
    const dir = path.dirname(dbPath);

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (dirErr) {
      console.warn("[the-store] Aviso ao criar pasta do banco:", dirErr.message);
    }

    const db = new DatabaseSync(dbPath);
    try {
      db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    } catch {}

    try {
      migrate(db);
    } catch (migErr) {
      console.warn("[the-store] Aviso na migração SQLite local:", migErr.message);
    }

    try {
      seedAdmin(db);
    } catch (seedErr) {
      console.warn("[the-store] Aviso no seedAdmin SQLite:", seedErr.message);
    }

    try {
      // Limpeza oportunista de sessões/tokens expirados.
      db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
      db.prepare("DELETE FROM password_resets WHERE expires_at < ?").run(Date.now());
    } catch {}

    return db;
  } catch (err) {
    console.warn("[the-store] Aviso: Banco SQLite local indisponível no ambiente atual:", err.message);
    return null;
  }
}

/** Conexão única por processo (sobrevive ao hot-reload em desenvolvimento). */
export function getDb() {
  if (globalThis.__theStoreDb === undefined) {
    globalThis.__theStoreDb = open();
  }
  return globalThis.__theStoreDb;
}

/** Executa `fn` dentro de uma transação. */
export function transaction(fn) {
  const db = getDb();
  if (!db) {
    throw new Error("Banco de dados SQLite local indisponível para transação.");
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** Converte linhas do SQLite (protótipo nulo) em objetos simples serializáveis. */
export const plain = (row) => (row ? { ...row } : null);
