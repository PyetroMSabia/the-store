import { createUser, findUserByEmail } from "@/lib/users";
import { createSession } from "@/lib/session";
import { readJson, jsonError, clientIp, rateLimit, tooMany } from "@/lib/http";
import { validateName, validateEmail, validatePassword } from "@/lib/validation";

export async function POST(request) {
  const ip = clientIp(request);
  const ipLimit = rateLimit(`reg:ip:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!ipLimit.ok) return tooMany(ipLimit.retryAfter);

  const body = await readJson(request);
  if (!body) return jsonError("Dados inválidos.");

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  const emailLimit = rateLimit(`reg:email:${email}`, { limit: 3, windowMs: 15 * 60 * 1000 });
  if (!emailLimit.ok) return tooMany(emailLimit.retryAfter);

  const nameError = validateName(name);
  if (nameError) return jsonError(nameError);

  const emailError = validateEmail(email);
  if (emailError) return jsonError(emailError);

  const passwordError = validatePassword(password);
  if (passwordError) return jsonError(passwordError);

  const existing = await findUserByEmail(email);
  if (existing) {
    return jsonError("Já existe uma conta com este e-mail.", 409);
  }

  const result = await createUser({
    name,
    email,
    password,
  });

  if (result.error) return jsonError(result.error, 409);

  // Cria a sessão automaticamente após o cadastro bem-sucedido (cookie seguro gravado)
  await createSession(result.user);

  return Response.json({
    ok: true,
    user: result.user,
    message: "Conta criada com sucesso!",
  });
}
