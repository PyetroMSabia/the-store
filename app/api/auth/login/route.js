import { authenticate, syncAdminSafely } from "@/lib/users";
import { createSession } from "@/lib/session";
import { readJson, jsonError, clientIp, rateLimit, tooMany } from "@/lib/http";
import { validateEmail, normalizeEmail } from "@/lib/validation";

export async function POST(request) {
  try {
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

    const rawPassword = String(body.password);
    const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || "admin@thestore.local");
    const adminPassword = process.env.ADMIN_PASSWORD || "TheStoreAdmin2026!";

    // 1. BLINDAGEM DO ADMINISTRADOR (REQUISITO 1):
    // Se o e-mail e a senha baterem com as credenciais de Admin, autentica e gera sessão IMEDIATAMENTE,
    // mesmo que qualquer banco falhe.
    if (email === adminEmail && rawPassword === adminPassword) {
      const adminUser = {
        id: "admin-master",
        name: process.env.ADMIN_NAME?.trim() || "Curador The Store",
        email: adminEmail,
        role: "ADMIN",
        createdAt: new Date().toISOString(),
      };

      // Tenta sincronizar silenciosamente sem bloquear
      try {
        syncAdminSafely(adminUser, adminPassword).catch(() => {});
      } catch {}

      // Cria a sessão com cookie assinado seguro (HMAC-SHA256)
      await createSession(adminUser);

      return Response.json({
        ok: true,
        user: adminUser,
        message: "Autenticado com sucesso como Administrador!",
      });
    }

    // 2. Usuário comum ou credenciais do banco
    const user = await authenticate(email, rawPassword);
    if (!user) {
      return jsonError("E-mail ou senha incorretos.", 401);
    }

    await createSession(user);

    return Response.json({
      ok: true,
      user,
      message: "Autenticado com sucesso!",
    });
  } catch (err) {
    console.error("[the-store] Erro na rota de login:", err);
    return jsonError(`Erro no servidor ao tentar fazer login: ${err.message}`, 500);
  }
}
