"use client";

import { useUser } from "@/components/UserContext";
import { HeartIcon, CartIcon, ExternalIcon } from "@/components/Icons";

export default function ProductActions({ productId, storeName }) {
  const { isFavorite, toggleFavorite, addToCart } = useUser();
  const fav = isFavorite(productId);

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 18 }}>
      <a
        href={`/go/${productId}`}
        target="_blank"
        rel="noopener sponsored"
        className="btn btn-gold"
        id="btn-buy-official"
        style={{ padding: "0 28px", height: 50, fontSize: 15 }}
      >
        Comprar na {storeName} <ExternalIcon width={16} height={16} />
      </a>

      <button
        type="button"
        className="btn btn-ghost"
        id="btn-add-cart"
        onClick={() => addToCart(productId, 1)}
        style={{ height: 50 }}
      >
        <CartIcon width={18} height={18} /> Adicionar ao Carrinho
      </button>

      <button
        type="button"
        className={`icon-btn ${fav ? "active" : ""}`}
        id="btn-toggle-fav"
        onClick={() => toggleFavorite(productId)}
        aria-label={fav ? "Remover dos favoritos" : "Salvar nos favoritos"}
        title={fav ? "Salvo nos seus favoritos" : "Salvar nos favoritos"}
        style={{
          width: 50,
          height: 50,
          borderColor: fav ? "var(--gold)" : undefined,
          color: fav ? "var(--gold)" : undefined,
        }}
      >
        <HeartIcon width={22} height={22} filled={fav} />
      </button>
    </div>
  );
}
