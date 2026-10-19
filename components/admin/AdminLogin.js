import Link from "next/link";

/**
 * Componente legado substituído pela autenticação RBAC em /conta/entrar.
 */
export default function AdminLogin() {
  return (
    <div className="login-wrap">
      <div className="login-card reveal">
        <img src="/logo.jpg" alt="The Store" />
        <h1>Acesso ao Painel da Curadoria</h1>
        <p className="muted">O acesso agora exige autenticação com uma conta de administrador (role ADMIN).</p>
        <div style={{ marginTop: 24 }}>
          <Link href="/conta/entrar?next=/admin" className="btn btn-gold">
            Entrar com conta de Administrador
          </Link>
        </div>
      </div>
    </div>
  );
}
