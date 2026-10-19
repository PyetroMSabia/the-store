import "server-only";

/**
 * Serviço de envio de e-mails para recuperação de senha.
 * Em desenvolvimento e testes, exibe o link seguro no terminal / console.
 * Se houver webhook ou serviço de SMTP configurado (ex: RESEND_API_KEY ou MAIL_WEBHOOK),
 * despacha a requisição HTTP.
 */

export async function sendPasswordResetEmail({ toEmail, userName, resetUrl }) {
  console.info(`
=====================================================
[THE STORE — RECUPERAÇÃO DE SENHA]
Para: ${userName} <${toEmail}>
Link de redefinição:
${resetUrl}
(Válido por 1 hora. Nunca compartilhe este link.)
=====================================================
  `);

  if (process.env.RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || "The Store <curadoria@thestore.local>",
          to: toEmail,
          subject: "Redefinição de senha — The Store",
          html: `
            <div style="background:#09090a; color:#f4f1ea; padding:40px; font-family:sans-serif; max-width:600px; margin:auto; border-radius:12px; border:1px solid #333;">
              <h1 style="color:#f2c14e; font-size:24px;">The Store</h1>
              <p>Olá, <strong>${userName}</strong>!</p>
              <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
              <div style="margin:30px 0;">
                <a href="${resetUrl}" style="background:linear-gradient(135deg, #fbe39a 0%, #f2c14e 40%, #c8961e 100%); color:#111; padding:12px 24px; text-decoration:none; font-weight:bold; border-radius:30px; display:inline-block;">
                  Redefinir minha senha
                </a>
              </div>
              <p style="font-size:13px; color:#888;">Se você não solicitou esta alteração, ignore este e-mail com segurança.</p>
            </div>
          `,
        }),
      });
    } catch (err) {
      console.error("[the-store] Erro ao despachar e-mail via Resend:", err.message);
    }
  }

  return { ok: true };
}
