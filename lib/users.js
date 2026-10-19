import "server-only";
import crypto from "node:crypto";
import { getDb } from "./db.js";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password.js";
import { normalizeEmail } from "./validation.js";
import { supabase } from "./supabase.js";

/** Repositório de usuários e tokens de recuperação de senha conectado ao Supabase. */

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const mapUser = (r) =>
  r ? { id: r.id, name: r.name, email: r.email, role: r.role, createdAt: r.created_at } : null;

export async function findUserById(id) {
  if (!id) return null;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, created_at")
      .eq("id", id)
      .maybeSingle();
    if (!error && data) return mapUser(data);
  } catch (err) {
    console.warn("[the-store] Falha ao consultar usuário por id no Supabase:", err.message);
  }
  return mapUser(getDb().prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").get(id));
}

export async function findUserByEmail(email) {
  const normEmail = normalizeEmail(email);
  if (!normEmail) return null;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, created_at, password_hash")
      .ilike("email", normEmail)
      .maybeSingle();
    if (!error && data) return mapUser(data);
  } catch (err) {
    console.warn("[the-store] Falha ao consultar usuário por email no Supabase:", err.message);
  }
  return mapUser(
    getDb().prepare("SELECT id, name, email, role, created_at FROM users WHERE email = ?").get(normEmail)
  );
}

/** Cria um usuário comum. A role nunca vem do cliente — cadastro público é sempre USER. */
export async function createUser({ name, email, password }) {
  const id = crypto.randomUUID();
  const normEmail = normalizeEmail(email);
  const cleanName = String(name).trim().replace(/\s+/g, " ");
  const passwordHash = await hashPassword(password);

  // Grava no Supabase
  try {
    const { error } = await supabase.from("users").insert({
      id,
      name: cleanName,
      email: normEmail,
      password_hash: passwordHash,
      role: "USER",
    });
    if (error) {
      if (String(error.message).toLowerCase().includes("unique") || error.code === "23505") {
        return { error: "Já existe uma conta com este e-mail." };
      }
      console.error("[the-store] Erro ao cadastrar usuário no Supabase:", error.message);
    }
  } catch (err) {
    console.error("[the-store] Exceção ao cadastrar usuário no Supabase:", err);
  }

  // Grava no SQLite local como espelho
  try {
    getDb()
      .prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'USER')")
      .run(id, cleanName, normEmail, passwordHash);
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return { error: "Já existe uma conta com este e-mail." };
    throw err;
  }

  return { user: await findUserById(id) };
}

/** Valida e-mail + senha. Tempo de resposta equalizado para não revelar e-mails cadastrados. */
export async function authenticate(email, password) {
  const normEmail = normalizeEmail(email);
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || "admin@thestore.local");

  // Sincronização do Administrador via variável de ambiente (sem senhas hardcoded)
  const envAdminPassword = process.env.ADMIN_PASSWORD;
  if (normEmail === adminEmail && envAdminPassword && envAdminPassword.length >= 8) {
    if (password === envAdminPassword) {
      const hash = await hashPassword(password);
      const db = getDb();
      const existing = db
        .prepare("SELECT id, name, email, role, created_at, password_hash FROM users WHERE email = ?")
        .get(normEmail);

      let adminId = existing?.id;
      if (!existing) {
        adminId = crypto.randomUUID();
        db.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'ADMIN')")
          .run(adminId, process.env.ADMIN_NAME?.trim() || "Curador The Store", normEmail, hash);
      } else {
        db.prepare("UPDATE users SET password_hash = ?, role = 'ADMIN' WHERE id = ?").run(hash, existing.id);
      }

      // Sincroniza admin no Supabase
      try {
        await supabase.from("users").upsert({
          id: adminId,
          name: process.env.ADMIN_NAME?.trim() || "Curador The Store",
          email: normEmail,
          password_hash: hash,
          role: "ADMIN",
        });
      } catch (err) {
        console.warn("[the-store] Falha ao sincronizar admin no Supabase:", err.message);
      }

      return findUserById(adminId);
    }
  }

  // Busca usuário e password_hash no Supabase
  let row = null;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, created_at, password_hash")
      .ilike("email", normEmail)
      .maybeSingle();
    if (!error && data) {
      row = data;
    }
  } catch (err) {
    console.warn("[the-store] Falha ao autenticar via Supabase, tentando local:", err.message);
  }

  // Fallback para SQLite
  if (!row) {
    row = getDb()
      .prepare("SELECT id, name, email, role, created_at, password_hash FROM users WHERE email = ?")
      .get(normEmail);
  }

  if (!row) return burnPasswordCheck(password).then(() => null);
  return (await verifyPassword(password, row.password_hash)) ? mapUser(row) : null;
}

export async function updatePassword(userId, password) {
  const hash = await hashPassword(password);

  // Atualiza no Supabase
  try {
    await supabase.from("users").update({ password_hash: hash }).eq("id", userId);
    await supabase.from("sessions").delete().eq("user_id", userId);
  } catch (err) {
    console.error("[the-store] Falha ao atualizar senha no Supabase:", err.message);
  }

  // Atualiza no SQLite
  const db = getDb();
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export async function countUsers() {
  try {
    const { count, error } = await supabase.from("users").select("*", { count: "exact", head: true });
    if (!error && typeof count === "number") return count;
  } catch {}
  return getDb().prepare("SELECT COUNT(*) AS n FROM users").get().n;
}

/* ---------- Recuperação de senha ---------- */

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

/** Gera um token de uso único. Apenas o hash é salvo no banco. */
export async function createPasswordResetToken(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const expiresAt = Date.now() + RESET_TTL_MS;

  // Supabase
  try {
    await supabase.from("password_resets").delete().eq("user_id", userId);
    await supabase.from("password_resets").insert({
      token_hash: tokenHash,
      user_id: userId,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.warn("[the-store] Falha ao salvar reset token no Supabase:", err.message);
  }

  // SQLite local
  const db = getDb();
  db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(userId);
  db.prepare("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    tokenHash,
    userId,
    expiresAt
  );
  return token;
}

export async function findValidResetToken(token) {
  if (!token || typeof token !== "string" || token.length > 200) return null;
  const tokenHash = sha256(token);
  const now = Date.now();

  try {
    const { data, error } = await supabase
      .from("password_resets")
      .select("user_id")
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .gt("expires_at", now)
      .maybeSingle();
    if (!error && data) return data.user_id;
  } catch (err) {
    console.warn("[the-store] Falha ao verificar reset token no Supabase:", err.message);
  }

  const row = getDb()
    .prepare("SELECT user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
    .get(tokenHash, now);
  return row ? row.user_id : null;
}

export async function markResetTokenUsed(token) {
  const tokenHash = sha256(token);
  const now = Date.now();

  try {
    await supabase.from("password_resets").update({ used_at: now }).eq("token_hash", tokenHash);
  } catch (err) {
    console.warn("[the-store] Falha ao marcar reset token usado no Supabase:", err.message);
  }

  getDb().prepare("UPDATE password_resets SET used_at = ? WHERE token_hash = ?").run(now, tokenHash);
}
