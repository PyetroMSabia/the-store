import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getFavoriteIds, getCartCount } from "@/lib/shopping";
import { listUserOrders } from "@/lib/orders";
import { formatBRL } from "@/lib/offers";
import { UserIcon, HeartIcon, CartIcon, SettingsIcon, ShieldIcon } from "@/components/Icons";
import AccountActions from "./AccountActions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Minha Conta",
};

export default async function AccountPage() {
  const user = await requireUser("/conta");
  const favoriteIds = await getFavoriteIds(user.id);
  const cartCount = await getCartCount(user.id);
  const orders = await listUserOrders(user.id);

  const formattedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Recentemente";

  return (
    <div className="account-container reveal" style={{ maxWidth: 860, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column" }}>
      <div className="account-hero">
        <div
          className="account-avatar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          <span style={{ display: "block", transform: "translateY(-1px)" }}>
            {user.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <span className="eyebrow" style={{ marginBottom: 6 }}>
            {user.role === "ADMIN" ? "Administrador da Curadoria" : "Cliente The Store"}
          </span>
          <h1>{user.name}</h1>
          <p className="muted">{user.email} · Membro desde {formattedDate}</p>
        </div>
      </div>

      <div className="kpis" style={{ margin: "24px 0" }}>
        <Link href="/favoritos" className="kpi" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Favoritos</span>
            <HeartIcon width={20} height={20} style={{ color: "var(--gold)" }} />
          </div>
          <strong className="gold-text">{favoriteIds.length}</strong>
          <small className="muted">Produtos salvos</small>
        </Link>

        <Link href="/carrinho" className="kpi" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Meu Carrinho</span>
            <CartIcon width={20} height={20} style={{ color: "var(--gold)" }} />
          </div>
          <strong className="gold-text">{cartCount}</strong>
          <small className="muted">Itens para compra</small>
        </Link>

        <div className="kpi">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Perfil</span>
            <ShieldIcon width={20} height={20} style={{ color: "var(--gold)" }} />
          </div>
          <strong>{user.role}</strong>
          <small className="muted">{user.role === "ADMIN" ? "Acesso total" : "Acesso de cliente"}</small>
        </div>
      </div>

      {user.role === "ADMIN" && (
        <div className="sidebar-card" style={{ margin: "24px 0", background: "linear-gradient(135deg, #1b160d 0%, #141416 100%)", borderColor: "rgba(242, 193, 78, 0.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
            <div>
              <span className="seal" style={{ color: "#0d0d0f", fontWeight: 700 }}>
                <ShieldIcon width={14} height={14} style={{ color: "#0d0d0f", stroke: "#0d0d0f" }} /> Painel de Controle
              </span>
              <h3 style={{ margin: "8px 0 4px", fontSize: 20 }}>Você é um Administrador da The Store</h3>
              <p className="muted">Cadastre novos produtos, importe ofertas por link e gerencie a vitrine.</p>
            </div>
            <Link href="/admin" className="btn btn-gold" id="btn-goto-admin">
              <SettingsIcon width={16} height={16} /> Abrir Painel da Curadoria
            </Link>
          </div>
        </div>
      )}

      {/* Pedidos realizados na The Store */}
      {orders && orders.length > 0 && (
        <div style={{ margin: "28px 0" }}>
          <h2 style={{ fontSize: 20, marginBottom: 14 }}>
            Meus Pedidos na <span className="gold-text">The Store</span> ({orders.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {orders.map((ord) => (
              <div
                key={ord.id}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: "var(--gold)" }}>
                      #{ord.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="badge-count" style={{ background: "rgba(62, 207, 142, 0.15)", color: "#3ecf8e" }}>
                      {ord.status === "CONFIRMED" ? "Confirmado" : ord.status}
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      · Loja: <b>{ord.storeName}</b>
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Rastreio: <code style={{ color: "var(--fg)" }}>{ord.trackingCode}</code> · {ord.items?.length} {ord.items?.length === 1 ? "item" : "itens"}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)" }}>
                    {formatBRL(ord.totalAmount)}
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {new Date(ord.createdAt).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <AccountActions />
      </div>
    </div>
  );
}
