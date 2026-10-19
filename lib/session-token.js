/**
 * Token de sessão assinado (HMAC-SHA256) — usa apenas Web Crypto, então funciona
 * tanto no `proxy.js` quanto em Route Handlers / Server Components.
 *
 * Formato: base64url(JSON payload) + "." + base64url(assinatura)
 * Payload: { sid, uid, role, exp }
 *
 * A assinatura impede adulteração (ex.: trocar role para ADMIN no cookie). Mesmo
 * assim, o servidor SEMPRE revalida a sessão e a role no banco (ver lib/session.js).
 */
export const SESSION_COOKIE = "ts_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

const encoder = new TextEncoder();
const DEV_SECRET = "dev-only-insecure-secret-defina-AUTH_SECRET-no-env-local";

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET ou JWT_SECRET ausente ou muito curto (mínimo de 32 caracteres).");
  }
  // Em desenvolvimento, avisa sobre a ausência da variável segura
  console.warn("[the-store AppSec] AVISO: AUTH_SECRET não definido ou curto no .env.local; utilizando chave efêmera de desenvolvimento.");
  return secret || "the-store-segredo-de-autenticacao-super-seguro-2026-fallback-dev";
}

let cached = { secret: null, key: null };
function getKey() {
  const secret = getSecret();
  if (cached.secret !== secret) {
    cached = {
      secret,
      key: crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
        "sign",
        "verify",
      ]),
    };
  }
  return cached.key;
}

function toB64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str) {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function signSessionToken(payload) {
  const body = toB64url(encoder.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await getKey(), encoder.encode(body)));
  return `${body}.${toB64url(sig)}`;
}

/** Retorna o payload se a assinatura for válida e o token não estiver expirado; caso contrário `null`. */
export async function verifySessionToken(token) {
  if (typeof token !== "string" || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await getKey(), fromB64url(parts[1]), encoder.encode(parts[0]));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));
    if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
