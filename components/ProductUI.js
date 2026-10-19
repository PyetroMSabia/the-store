"use client";

import Link from "next/link";
import { ArrowRight, ShieldIcon, Star, HeartIcon, CartIcon } from "./Icons";
import { storeStyle } from "@/lib/stores";
import { formatBRL, isTopRated, isOnSale, isNewProduct, discountPct } from "@/lib/offers";
import { useUser } from "./UserContext";
import SafeImage from "./SafeImage";

export function Stars({ rating = 0, count }) {
  const r = Number(rating || 0);
  return (
    <span className="stars" aria-label={`Nota ${r.toFixed(1)} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} fill={Math.max(0, Math.min(1, r - i))} />
      ))}
      <span className="rating-num">{r.toFixed(1)}</span>
      {count != null && <span className="rating-count">({Number(count).toLocaleString("pt-BR")})</span>}
    </span>
  );
}

export function StoreDot({ storeName }) {
  const s = storeStyle(storeName);
  return (
    <span
      className="store-dot"
      style={{ backgroundColor: s.color }}
      title={s.name}
      suppressHydrationWarning
    >
      {(s.short || s.name || "").slice(0, 2).toUpperCase()}
    </span>
  );
}

export function StoreChip({ storeName }) {
  const s = storeStyle(storeName);
  return (
    <span className="store-chip">
      <StoreDot storeName={storeName} /> {s.name}
    </span>
  );
}

export function Seal({ large }) {
  return (
    <span
      className={`seal ${large ? "seal-lg" : ""}`}
      title="Selo The Store: produto com avaliação excepcional acima de 4.7"
    >
      <ShieldIcon /> {large ? "Selo The Store — Oferta Validada" : "Compra Validada"}
    </span>
  );
}

export function ProductCard({ product, index = 0 }) {
  const { isFavorite, toggleFavorite, addToCart } = useUser();
  const fav = isFavorite(product.id);
  const top = isTopRated(product);
  const sale = isOnSale(product);
  const isNew = isNewProduct(product);
  const pct = discountPct(product);

  return (
    <article className="card" style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}>
      <div className="card-media">
        <Link href={`/produto/${product.id}`} className="card-link" aria-label={`Ver detalhes de ${product.title}`} />
        <SafeImage
          src={product.imageUrl}
          alt={product.title}
          loading="lazy"
        />

        <div className="card-badges">
          <span>{top && <Seal />}</span>
          <span style={{ display: "flex", gap: 6 }}>
            {pct > 0 && <span className="tag sale">-{pct}%</span>}
            {isNew && <span className="tag new">Novo</span>}
          </span>
        </div>

        {/* Botão de Favoritar flutuante sobre a imagem */}
        <button
          type="button"
          className={`card-fav-btn ${fav ? "active" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(product.id);
          }}
          aria-label={fav ? "Remover dos favoritos" : "Salvar nos favoritos"}
          title={fav ? "Salvo nos seus favoritos" : "Salvar nos favoritos"}
        >
          <HeartIcon width={18} height={18} filled={fav} />
        </button>

        <span className="price-tag">{formatBRL(product.price)}</span>
      </div>

      <div className="card-body">
        <div className="card-meta">
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <StoreChip storeName={product.storeName} />
            {Array.isArray(product.availableStores) && product.availableStores.length > 1 && (
              <span
                style={{
                  fontSize: 10.5,
                  padding: "2px 7px",
                  borderRadius: 10,
                  background: "rgba(242, 193, 78, 0.12)",
                  color: "var(--gold)",
                  fontWeight: 600,
                }}
                title={`Disponível em: ${product.availableStores.join(", ")}`}
              >
                +{product.availableStores.length - 1} lojas
              </span>
            )}
          </div>
          {product.rating != null && <Stars rating={product.rating} />}
        </div>

        <Link href={`/produto/${product.id}`} style={{ textDecoration: "none" }}>
          <h3 className="card-title">{product.title}</h3>
        </Link>

        {product.oldPrice && (
          <div className="card-meta" style={{ marginTop: -2 }}>
            <span className="old-price">De {formatBRL(product.oldPrice)}</span>
            <span className="saving">Economia de {formatBRL(product.oldPrice - product.price)}</span>
          </div>
        )}

        <div className="card-foot">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addToCart(product.id, 1);
            }}
            title="Adicionar ao meu carrinho"
            style={{ padding: "0 10px", gap: 5 }}
          >
            <CartIcon width={14} height={14} /> + Carrinho
          </button>

          <a
            href={`/go/${product.id}`}
            target="_blank"
            rel="noopener sponsored"
            className="btn btn-gold btn-sm"
            title={`Comprar na ${product.storeName}`}
            onClick={(e) => e.stopPropagation()}
            style={{ padding: "0 12px" }}
          >
            Comprar <ArrowRight width={12} height={12} />
          </a>
        </div>
      </div>
    </article>
  );
}
