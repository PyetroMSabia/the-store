import { authenticate } from "@/lib/users";
import { createSession } from "@/lib/session";
import { readJson, jsonError, clientIp, rateLimit, tooMany } from "@/lib/http";
import { validateEmail, normalizeEmail } from "@/lib/validation";

export async function POST(request) {
  const ip = clientIp(request);
  const ipLimit = rateLimit(`login:ip:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!ipLimit.ok) return tooMany(ipLimit.retryAfter);

  const body = await readJson(request);
  if (!body) return jsonError("Dados inválidos.");

  const email = normalizeEmail(body.email);
  const emailError = validateEmail(email);
  if (emailError) return jsonError(emailError);

  const emailLimit = rateLimit(`login:email:${email}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!emailLimit.ok) return tooMany(emailLimit.retryAfter);

  if (!body.password) return jsonError("Informe sua senha.");

  const user = await authenticate(email, String(body.password));
  if (!user) {
    return jsonError("E-mail ou senha incorretos.", 401);
  }

  await createSession(user);

  return Response.json({
    ok: true,
    user,
    message: "Autenticado com sucesso!",
  });
}
