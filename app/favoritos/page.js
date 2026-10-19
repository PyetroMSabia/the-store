import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listFavorites } from "@/lib/shopping";
import { ProductCard } from "@/components/ProductUI";
import { HeartIcon, ArrowRight } from "@/components/Icons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meus Favoritos",
};

export default async function FavoritosPage() {
  const user = await requireUser("/favoritos");
  const favorites = await listFavorites(user.id);

  return (
    <div className="reveal">
      <div className="section-head">
        <div>
          <span className="eyebrow">
            <HeartIcon width={14} height={14} filled style={{ color: "var(--gold)" }} /> Coleção pessoal
          </span>
          <h1 style={{ marginTop: 8 }}>
            Seus produtos <span className="gold-text">favoritos</span>
          </h1>
          <p className="muted">Ofertas salvas na sua conta para acompanhar e comprar no momento certo.</p>
        </div>
      </div>

      {favorites.length > 0 ? (
        <div className="grid">
          {favorites.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      ) : (
        <div className="empty" style={{ margin: "40px auto", maxWidth: 640 }}>
          <div style={{ display: "inline-flex", padding: 18, borderRadius: "50%", background: "var(--surface-2)", color: "var(--gold)", marginBottom: 14 }}>
            <HeartIcon width={36} height={36} />
          </div>
          <h3>Sua lista de favoritos está vazia</h3>
          <p>
            Enquanto navega pelo catálogo da The Store, clique no ícone de coração de qualquer produto para guardá-lo aqui.
          </p>
          <div style={{ marginTop: 24 }}>
            <Link href="/?cat=todos#catalogo" className="btn btn-gold">
              Explorar vitrine <ArrowRight width={16} height={16} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
