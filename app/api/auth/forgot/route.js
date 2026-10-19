import { findUserByEmail, createPasswordResetToken } from "@/lib/users";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { readJson, jsonError, clientIp, rateLimit, tooMany, appOrigin } from "@/lib/http";
import { validateEmail } from "@/lib/validation";

export async function POST(request) {
  const ip = clientIp(request);
  const limit = rateLimit(`forgot:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!limit.ok) return tooMany(limit.retryAfter);

  const body = await readJson(request);
  if (!body) return jsonError("Dados inválidos.");

  const emailError = validateEmail(body.email);
  if (emailError) return jsonError(emailError);

  const user = await findUserByEmail(body.email);
  if (user) {
    const token = await createPasswordResetToken(user.id);
    const origin = appOrigin(request);
    const resetUrl = `${origin}/conta/redefinir?token=${encodeURIComponent(token)}`;
    await sendPasswordResetEmail({
      toEmail: user.email,
      userName: user.name,
      resetUrl,
    });
  }

  // Resposta uniforme para evitar enumeração de contas
  return Response.json({
    ok: true,
    message: "Se o e-mail estiver cadastrado, enviamos as instruções para recuperação.",
  });
}
