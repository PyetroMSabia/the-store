import "server-only";
import crypto from "node:crypto";
import { promisify } from "node:util";

/**
 * Hash de senhas com scrypt (função de derivação resistente a força bruta, nativa do Node).
 * Formato armazenado: scrypt$N$r$p$<salt base64>$<hash base64>
 */
const scrypt = promisify(crypto.scrypt);
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

const normalize = (pw) => String(pw).normalize("NFKC");
const format = (salt, key) =>
  `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${key.toString("base64")}`;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(normalize(password), salt, KEYLEN, PARAMS);
  return format(salt, key);
}

/** Versão síncrona — usada apenas na semeadura do admin durante a inicialização do banco. */
export function hashPasswordSync(password) {
  const salt = crypto.randomBytes(16);
  return format(salt, crypto.scryptSync(normalize(password), salt, KEYLEN, PARAMS));
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(normalize(password), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

/** Hash fictício para equalizar o tempo de resposta quando o e-mail não existe. */
let dummyHash;
export async function burnPasswordCheck(password) {
  dummyHash ||= await hashPassword("the-store-dummy-password");
  await verifyPassword(password, dummyHash);
  return false;
}
