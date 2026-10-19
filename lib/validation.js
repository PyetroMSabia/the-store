/** Validações compartilhadas (puras — podem rodar no cliente e no servidor). */

export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

export function validateName(name) {
  const n = String(name || "").trim().replace(/\s+/g, " ");
  if (n.length < 3) return "Informe seu nome completo.";
  if (n.length > 80) return "O nome deve ter no máximo 80 caracteres.";
  return null;
}

export function validateEmail(email) {
  const e = normalizeEmail(email);
  if (!e) return "Informe seu e-mail.";
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return "E-mail inválido.";
  return null;
}

export function validatePassword(password) {
  const p = String(password || "");
  if (p.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (p.length > 128) return "A senha deve ter no máximo 128 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(p) || !/\d/.test(p)) return "Use letras e números na senha.";
  return null;
}

/** Força da senha de 0 a 4 (para o medidor visual no cadastro). */
export function passwordStrength(password) {
  const p = String(password || "");
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  return Math.min(4, score);
}

/** Aceita apenas caminhos internos (evita open redirect em `?next=`). */
export function safeNextPath(next, fallback = "/conta") {
  const n = String(next || "");
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : fallback;
}

export const isHttpUrl = (value) => {
  if (!value || typeof value !== "string") return false;
  const s = value.trim();
  // Bloqueio explícito de esquemas perigosos
  if (/^(javascript|data|vbscript|file|about|blob):/i.test(s)) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    // Rejeita credenciais embutidas na URL
    if (u.username || u.password) return false;
    // Rejeita caracteres perigosos comuns de XSS
    if (/[<>"']/.test(s)) return false;
    return true;
  } catch {
    return false;
  }
};

export const isSafeHttpUrl = isHttpUrl;

/** Remove tags HTML, scripts e caracteres perigosos de entradas de texto */
export function sanitizeText(text, maxLength = 5000) {
  if (text == null) return "";
  let clean = String(text)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ") // remove todas as tags HTML
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength).trim();
  }
  return clean;
}

