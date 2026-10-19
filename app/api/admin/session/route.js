import { destroySession } from "@/lib/session";

/**
 * Rota mantida apenas para compatibilidade de logout; autenticação do admin agora
 * é realizada exclusivamente via conta de usuário com role 'ADMIN' no /api/auth/login.
 */
export async function POST() {
  return Response.json(
    { error: "O login agora é feito com sua conta de administrador em /conta/entrar." },
    { status: 410 }
  );
}

export async function DELETE() {
  await destroySession();
  return Response.json({ ok: true });
}
