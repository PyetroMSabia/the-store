"use client";

import { useUser } from "./UserContext";
import { StoreChip } from "./ProductUI";
import { formatBRL } from "@/lib/offers";
import { ExternalIcon, CartIcon, HeartIcon } from "./Icons";

export default function ProductOffersList({ productId, offers = [] }) {
  const { isFavorite, toggleFavorite, addToCart } = useUser();
  const fav = isFavorite(productId);

  // Ordena ofertas do menor preço para o maior preço
  const sortedOffers = [...offers].sort((a, b) => {
    const pA = Number(a.price) || 0;
    const pB = Number(b.price) || 0;
    return pA - pB;
  });

  if (!sortedOffers.length) return null;

  const lowestPrice = Number(sortedOffers[0].price) || 0;

  return (
    <div className="pd-offers-stack">
      <div className="pd-offers-stack-head">
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          Onde Comprar ({sortedOffers.length} {sortedOffers.length === 1 ? "opção disponível" : "lojas disponíveis"})
        </h3>
        <span className="muted" style={{ fontSize: 12.5 }}>
          Ordenado automaticamente pelo menor preço
        </span>
      </div>

      <div className="pd-offers-list">
        {sortedOffers.map((offer, index) => {
          const currentPrice = Number(offer.price) || 0;
          const oldPrice = Number(offer.oldPrice) || 0;
          const isCheapest = index === 0;
          const buyUrl = `/go/${productId}?offer=${offer.id || ""}&store=${encodeURIComponent(offer.storeName || "")}`;

          return (
            <div
              key={offer.id || index}
              className={`pd-offer-card ${isCheapest ? "cheapest-offer" : ""}`}
            >
              {/* Lado Esquerdo: Identificação da Loja e Badges */}
              <div className="pd-offer-store-info">
                <span className="pd-offer-number">Link {index + 1}</span>
                <StoreChip storeName={offer.storeName} />
                {isCheapest && (
                  <span className="badge-lowest-price">
                    ★ Menor Preço
                  </span>
                )}
              </div>

              {/* Centro: Preço naquela loja */}
              <div className="pd-offer-price-col">
                <div className="pd-offer-price gold-text">
                  {formatBRL(currentPrice)}
                </div>
                {oldPrice > currentPrice && (
                  <div className="pd-offer-old-price">
                    De {formatBRL(oldPrice)}
                  </div>
                )}
              </div>

              {/* Lado Direito: Botões de Ação da Oferta */}
              <div className="pd-offer-actions">
                <a
                  href={buyUrl}
                  target="_blank"
                  rel="noopener sponsored"
                  className="btn btn-gold pd-offer-buy-btn"
                  title={`Ir para a loja oficial ${offer.storeName}`}
                >
                  <span>Comprar na {offer.storeName}</span>
                  <ExternalIcon width={14} height={14} />
                </a>

                <button
                  type="button"
                  onClick={() => addToCart(productId, 1)}
                  className="icon-btn"
                  title="Adicionar ao carrinho"
                  aria-label="Adicionar ao carrinho"
                  style={{ width: 42, height: 42 }}
                >
                  <CartIcon width={17} height={17} />
                </button>

                <button
                  type="button"
                  onClick={() => toggleFavorite(productId)}
                  className={`icon-btn ${fav ? "active" : ""}`}
                  title={fav ? "Remover dos favoritos" : "Salvar nos favoritos"}
                  aria-label="Salvar nos favoritos"
                  style={{
                    width: 42,
                    height: 42,
                    borderColor: fav ? "var(--gold)" : undefined,
                    color: fav ? "var(--gold)" : undefined,
                  }}
                >
                  <HeartIcon width={18} height={18} filled={fav} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
