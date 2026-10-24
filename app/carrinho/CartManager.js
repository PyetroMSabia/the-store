"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@/components/UserContext";
import { formatBRL } from "@/lib/offers";
import { StoreChip } from "@/components/ProductUI";
import { TrashIcon, ExternalIcon, CartIcon, ArrowRight } from "@/components/Icons";
import SafeImage from "@/components/SafeImage";

export default function CartManager({ initialItems = [] }) {
  const [items, setItems] = useState(initialItems);
  const [loadingId, setLoadingId] = useState(null);
  const [showLinksPanel, setShowLinksPanel] = useState(false);
  const { refresh } = useUser();

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  function handleOpenProductLinks() {
    if (!items || items.length === 0) return;

    if (items.length === 1) {
      const prod = items[0].product;
      const url = `/go/${prod.id}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    // Se houver múltiplos produtos: tenta abrir as abas correspondentes
    items.forEach((item) => {
      try {
        const url = `/go/${item.product.id}`;
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {}
    });

    // Exibe simultaneamente o mini-painel expansível com links diretos
    setShowLinksPanel(true);
  }

  async function updateQuantity(productId, newQty) {
    if (newQty < 1) return removeItem(productId);
    setLoadingId(productId);

    try {
      const res = await fetch(`/api/cart/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((it) => (it.product.id === productId ? { ...it, quantity: newQty } : it))
        );
        refresh();
      }
    } catch {
      // erro
    } finally {
      setLoadingId(null);
    }
  }

  async function removeItem(productId) {
    setLoadingId(productId);
    try {
      const res = await fetch(`/api/cart/${productId}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((it) => it.product.id !== productId));
        refresh();
      }
    } catch {
      // erro
    } finally {
      setLoadingId(null);
    }
  }

  async function clearAll() {
    if (!confirm("Tem certeza que deseja esvaziar o carrinho?")) return;
    try {
      const res = await fetch("/api/cart", { method: "DELETE" });
      if (res.ok) {
        setItems([]);
        refresh();
      }
    } catch {
      // erro
    }
  }

  if (items.length === 0) {
    return (
      <div className="empty" style={{ margin: "40px auto", maxWidth: 640 }}>
        <div style={{ display: "inline-flex", padding: 18, borderRadius: "50%", background: "var(--surface-2)", color: "var(--gold)", marginBottom: 14 }}>
          <CartIcon width={36} height={36} />
        </div>
        <h3>Seu carrinho está vazio</h3>
        <p>
          Adicione ofertas que você tem interesse em comprar para acompanhar seus preços e acessar os links oficiais em um só lugar.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link href="/?cat=todos#catalogo" className="btn btn-gold">
            Explorar ofertas <ArrowRight width={16} height={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-grid">
      <div className="cart-items">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span className="muted">{items.length} {items.length === 1 ? "produto selecionado" : "produtos selecionados"}</span>
          <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ color: "var(--danger)" }}>
            <TrashIcon width={14} height={14} /> Esvaziar carrinho
          </button>
        </div>

        {items.map(({ product, quantity }) => {
          const storeName = product.storeName || "Loja Parceira";
          const title = product.title || "Produto sem título";

          return (
            <div key={product.id} className="cart-item-card">
              <Link href={`/produto/${product.id}`} className="cart-item-thumb">
                <SafeImage src={product.imageUrl} alt={title} />
              </Link>

              <div className="cart-item-details">
                {/* 1. Selo da loja */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <StoreChip storeName={storeName} />
                </div>

                {/* 2. Nome do produto em destaque (REQUISITO 4) */}
                <Link
                  href={`/produto/${product.id}`}
                  className="cart-item-title"
                  style={{
                    display: "block",
                    color: "var(--text)",
                    fontSize: 16,
                    fontWeight: 600,
                    lineHeight: 1.35,
                    marginBottom: 6,
                    textDecoration: "none",
                  }}
                  title={title}
                >
                  {title}
                </Link>

                {/* 3. Preço unitário */}
                <div className="cart-item-unit-price">
                  Preço unitário: <b>{formatBRL(product.price)}</b>
                  {product.oldPrice && <span className="old-price" style={{ marginLeft: 8 }}>{formatBRL(product.oldPrice)}</span>}
                </div>
              </div>

              <div className="cart-item-actions">
                <div className="qty-control">
                  <button
                    type="button"
                    onClick={() => updateQuantity(product.id, quantity - 1)}
                    disabled={loadingId === product.id}
                    aria-label="Diminuir quantidade"
                  >
                    -
                  </button>
                  <span>{quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(product.id, quantity + 1)}
                    disabled={loadingId === product.id}
                    aria-label="Aumentar quantidade"
                  >
                    +
                  </button>
                </div>

                <div className="cart-item-total">
                  {formatBRL(product.price * quantity)}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {/* Botão de redirecionamento oficial por item (REQUISITO 3) */}
                  <a
                    href={`/go/${product.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-gold btn-sm"
                    title={`Comprar na ${storeName}`}
                    style={{ fontWeight: 600, whiteSpace: "nowrap" }}
                  >
                    Comprar na {storeName} <ExternalIcon width={12} height={12} />
                  </a>

                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeItem(product.id)}
                    aria-label="Remover do carrinho"
                    title="Remover do carrinho"
                    disabled={loadingId === product.id}
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Card lateral Resumo do Carrinho (REQUISITO 2) */}
      <div className="cart-summary">
        <h3>Resumo do Carrinho</h3>

        <div className="cart-summary-line">
          <span>Subtotal estimado</span>
          <strong className="gold-text" style={{ fontSize: 24 }}>{formatBRL(subtotal)}</strong>
        </div>

        <p
          style={{
            marginTop: 18,
            marginBottom: 20,
            fontSize: 12.5,
            color: "var(--muted)",
            lineHeight: 1.5,
            padding: "12px 14px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          A The Store é um agregador e curador de ofertas. Cada item é finalizado diretamente no marketplace oficial parceiro com frete, garantia e estoque oficial.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href="/?cat=todos#catalogo"
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "center", padding: "12px 18px", fontSize: 14, fontWeight: 600 }}
          >
            Continuar explorando ofertas
          </Link>

          {/* REQUISITO 4: Botão dourado destacado para abrir links dos produtos */}
          <button
            type="button"
            className="btn btn-gold"
            id="btn-open-all-product-links"
            onClick={handleOpenProductLinks}
            style={{
              width: "100%",
              justifyContent: "center",
              padding: "13px 18px",
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 14px rgba(242, 193, 78, 0.25)",
            }}
          >
            🔗 Abrir links dos produtos ({items.length})
          </button>

          {/* Mini-painel expansível listando links diretos de 1 clique */}
          {showLinksPanel && items.length > 1 && (
            <div
              className="reveal"
              style={{
                marginTop: 6,
                padding: "14px",
                borderRadius: "var(--radius-md)",
                background: "var(--surface-2)",
                border: "1px solid var(--border-gold, rgba(242, 193, 78, 0.4))",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--gold)" }}>
                  🚀 Links Oficiais Prontos (1 Clique)
                </span>
                <button
                  type="button"
                  onClick={() => setShowLinksPanel(false)}
                  style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 11 }}
                >
                  ✕ Fechar
                </button>
              </div>
              <p className="muted" style={{ fontSize: 11.5, margin: 0, lineHeight: 1.4 }}>
                Se o seu navegador bloqueou a abertura de múltiplas abas simultâneas, clique abaixo para abrir cada loja oficial diretamente:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                {items.map((item) => {
                  const p = item.product;
                  const sName = p.storeName || (p.offers?.[0]?.storeName) || "Loja Oficial";
                  return (
                    <a
                      key={p.id}
                      href={`/go/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                      style={{
                        justifyContent: "space-between",
                        fontSize: 12,
                        padding: "7px 10px",
                        textAlign: "left",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
                        {p.title}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--gold)", fontWeight: 600, flexShrink: 0 }}>
                        {sName} <ExternalIcon width={10} height={10} />
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
