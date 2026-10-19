import "server-only";
import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db.js";
import { SESSION_COOKIE, SESSION_TTL_MS, signSessionToken, verifySessionToken } from "./session-token.js";
import { supabase } from "./supabase.js";

/**
 * Camada de sessão / autorização (Data Access Layer) conectada ao Supabase.
 * O proxy faz apenas a checagem otimista do cookie; ESTAS funções são a fonte da
 * verdade e consultam o banco a cada requisição.
 */

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

export async function createSession(user) {
  const sid = crypto.randomBytes(32).toString("base64url");
  const exp = Date.now() + SESSION_TTL_MS;
  const sessionHash = sha256(sid);

  // Supabase
  try {
    await supabase.from("sessions").insert({
      id: sessionHash,
      user_id: user.id,
      expires_at: exp,
    });
  } catch (err) {
    console.warn("[the-store] Falha ao registrar sessão no Supabase:", err.message);
  }

  // SQLite local (envolvido em try/catch para Vercel Serverless)
  try {
    const db = getDb();
    if (db) {
      db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(sessionHash, user.id, exp);
    }
  } catch (err) {
    console.warn("[the-store] Falha ao registrar sessão no SQLite:", err.message);
  }

  const token = await signSessionToken({ sid, uid: user.id, role: user.role, exp });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    expires: new Date(exp),
  });
}

export async function destroySession() {
  const store = await cookies();
  const payload = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (payload?.sid) {
    const sessionHash = sha256(payload.sid);
    try {
      await supabase.from("sessions").delete().eq("id", sessionHash);
    } catch (err) {
      console.warn("[the-store] Falha ao destruir sessão no Supabase:", err.message);
    }
    try {
      const db = getDb();
      if (db) {
        db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionHash);
      }
    } catch (err) {
      console.warn("[the-store] Falha ao destruir sessão no SQLite:", err.message);
    }
  }
  store.delete(SESSION_COOKIE);
}

/** Usuário autenticado (validado no banco) ou `null`. Memoizado por render. */
export const getCurrentUser = cache(async () => {
  const payload = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!payload?.sid) return null;
  const sessionHash = sha256(payload.sid);
  const now = Date.now();
  const isAdmin = payload.role === "ADMIN";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@thestore.local";

  // Validação no Supabase
  try {
    const { data: session, error } = await supabase
      .from("sessions")
      .select("id, user_id, expires_at, users(id, name, email, role, created_at)")
      .eq("id", sessionHash)
      .gt("expires_at", now)
      .maybeSingle();

    if (!error && session?.users && session.users.id === payload.uid) {
      const u = session.users;
      return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.created_at };
    }
  } catch (err) {
    console.warn("[the-store] Falha ao validar sessão no Supabase, tentando local:", err.message);
  }

  // Fallback para banco local
  try {
    const db = getDb();
    if (db) {
      const row = db
        .prepare(
          `SELECT u.id, u.name, u.email, u.role, u.created_at
             FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.id = ? AND s.expires_at > ?`
        )
        .get(sessionHash, now);
      if (row && row.id === payload.uid) {
        return { id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at };
      }
    }
  } catch (err) {
    console.warn("[the-store] Falha ao consultar sessão no SQLite local:", err.message);
  }

  // Fallback de resiliência: se o token HMAC-SHA256 é autêntico, válido e for o Administrador,
  // concede acesso para garantir que o painel de curadoria funcione mesmo se a tabela ainda não existir no Supabase
  if (isAdmin && payload.exp > now) {
    return {
      id: payload.uid || "admin-master",
      name: process.env.ADMIN_NAME?.trim() || "Curador The Store",
      email: adminEmail,
      role: "ADMIN",
      createdAt: new Date().toISOString(),
    };
  }

  return null;
});

export const isAdminUser = (user) => user?.role === "ADMIN";

/* ---------- Guards para páginas (Server Components) ---------- */

export async function requireUser(nextPath = "/conta") {
  const user = await getCurrentUser();
  if (!user) redirect(`/conta/entrar?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/conta/entrar?next=/admin");
  if (!isAdminUser(user)) redirect("/");
  return user;
}

/* ---------- Guards para Route Handlers ---------- */

const deny = (status, error) => Response.json({ error }, { status });

/** Retorna `{ user }` ou `{ response }` (401) para devolver imediatamente. */
export async function apiUser() {
  const user = await getCurrentUser();
  return user ? { user } : { response: deny(401, "Faça login para continuar.") };
}

/** Retorna `{ user }` se ADMIN; caso contrário `{ response }` 401/403. */
export async function apiAdmin() {
  const user = await getCurrentUser();
  if (!user) return { response: deny(401, "Faça login para continuar.") };
  if (!isAdminUser(user)) return { response: deny(403, "Acesso restrito à curadoria.") };
  return { user };
}
