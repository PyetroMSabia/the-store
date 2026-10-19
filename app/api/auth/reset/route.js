import { findValidResetToken, markResetTokenUsed, updatePassword } from "@/lib/users";
import { readJson, jsonError, clientIp, rateLimit, tooMany } from "@/lib/http";
import { validatePassword } from "@/lib/validation";

export async function POST(request) {
  const ip = clientIp(request);
  const limit = rateLimit(`reset:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.ok) return tooMany(limit.retryAfter);

  const body = await readJson(request);
  if (!body) return jsonError("Dados inválidos.");

  const { token, password } = body;
  if (!token) return jsonError("Token de recuperação ausente ou inválido.");

  const passwordError = validatePassword(password);
  if (passwordError) return jsonError(passwordError);

  const userId = await findValidResetToken(token);
  if (!userId) {
    return jsonError("Este link de recuperação é inválido ou já expirou.", 400);
  }

  await updatePassword(userId, password);
  await markResetTokenUsed(token);

  return Response.json({
    ok: true,
    message: "Senha atualizada com sucesso! Você já pode entrar com sua nova senha.",
  });
}
