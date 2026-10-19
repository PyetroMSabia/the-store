import { requireUser } from "@/lib/session";
import { getCart } from "@/lib/shopping";
import CartManager from "./CartManager";
import { CartIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meu Carrinho",
};

export default async function CarrinhoPage() {
  const user = await requireUser("/carrinho");
  const cartItems = await getCart(user.id);

  return (
    <div className="reveal">
      <div className="section-head">
        <div>
          <span className="eyebrow">
            <CartIcon width={14} height={14} style={{ color: "var(--gold)" }} /> Agregador de compras
          </span>
          <h1 style={{ marginTop: 8 }}>
            Meu <span className="gold-text">carrinho</span>
          </h1>
          <p className="muted">Gerencie seus itens selecionados antes de finalizar a compra nas lojas oficiais.</p>
        </div>
      </div>

      <CartManager initialItems={cartItems} />
    </div>
  );
}
