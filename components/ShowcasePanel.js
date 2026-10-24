"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ProductCard } from "./ProductUI";
import { useUser } from "./UserContext";
import { SparkIcon, ArrowRight } from "./Icons";
import { CATEGORIES } from "@/lib/catalog";

const SHOWCASE_TABS = [
  { id: "hot", label: "🔥 Em Alta Venda", subtitle: "Itens com maiores vendas e avaliações máximas (★ 4.8+)" },
  { id: "sale", label: "🏷️ Em Promoção", subtitle: "Descontos reais verificados com economia em reais" },
  { id: "new", label: "✨ Recém-Adicionados", subtitle: "Últimas novidades selecionadas pelos curadores" },
  { id: "recommended", label: "🎯 Recomendados para Você", subtitle: "Ofertas personalizadas baseadas nas suas preferências" },
];

export default function ShowcasePanel({ products = [] }) {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState("hot");

  const userPreferences = useMemo(() => {
    if (user && Array.isArray(user.preferences)) {
      return user.preferences.map((p) => p.toLowerCase());
    }
    return [];
  }, [user]);

  // Itens filtrados para cada aba sem recarregar a página
  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];

    switch (activeTab) {
      case "hot": {
        // rating >= 4.8 ou mais clicados
        const highRated = products.filter((p) => (p.rating != null && p.rating >= 4.8) || (p.clickCount && p.clickCount > 0));
        const sorted = [...(highRated.length >= 4 ? highRated : products)].sort((a, b) => {
          const scoreB = (b.rating || 4.5) * 10 + (b.clickCount || 0);
          const scoreA = (a.rating || 4.5) * 10 + (a.clickCount || 0);
          return scoreB - scoreA;
        });
        return sorted.slice(0, 8);
      }

      case "sale": {
        // oldPrice > price
        const onSale = products.filter((p) => p.oldPrice && p.oldPrice > p.price);
        const sorted = [...(onSale.length >= 4 ? onSale : products)].sort((a, b) => {
          const discB = b.oldPrice ? (b.oldPrice - b.price) / b.oldPrice : 0;
          const discA = a.oldPrice ? (a.oldPrice - a.price) / a.oldPrice : 0;
          return discB - discA;
        });
        return sorted.slice(0, 8);
      }

      case "new": {
        // Últimos produtos adicionados ordenados por created_at DESC
        const sorted = [...products].sort((a, b) => {
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        return sorted.slice(0, 8);
      }

      case "recommended": {
        // Prioriza as categorias marcadas pelo usuário
        if (userPreferences.length > 0) {
          const matched = products.filter((p) => {
            const cat = (p.category || "").toLowerCase();
            return userPreferences.some((pref) => cat.includes(pref) || pref.includes(cat));
          });
          const remaining = products.filter((p) => !matched.includes(p));
          return [...matched, ...remaining].slice(0, 8);
        }
        // Se ainda não tiver preferências salvas, exibe os melhores avaliados com selo
        const topRated = [...products].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        return topRated.slice(0, 8);
      }

      default:
        return products.slice(0, 8);
    }
  }, [products, activeTab, userPreferences]);

  const currentTabObj = SHOWCASE_TABS.find((t) => t.id === activeTab) || SHOWCASE_TABS[0];

  return (
    <section
      className="section showcase-section reveal"
      id="vitrine-destaques"
      style={{
        margin: "36px 0 20px",
        padding: "26px",
        background: "linear-gradient(180deg, rgba(242, 193, 78, 0.04) 0%, rgba(20, 20, 22, 0.6) 100%)",
        border: "1px solid rgba(242, 193, 78, 0.2)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
      }}
    >
      {/* Cabeçalho da Vitrine */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              className="seal"
              style={{
                background: "var(--gold)",
                color: "#000",
                fontWeight: 700,
                fontSize: 11,
                padding: "2px 8px",
              }}
            >
              Curadoria em Destaque
            </span>
            <span className="muted" style={{ fontSize: 12 }}>
              Atualizada em tempo real
            </span>
          </div>

          <h2 style={{ fontSize: 24, margin: "4px 0" }}>
            Vitrine Dinâmica <span className="gold-text">The Store</span>
          </h2>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            {currentTabObj.subtitle}
          </p>
        </div>

        {/* Abas Interativas */}
        <div
          role="tablist"
          aria-label="Filtros da Vitrine Dinâmica"
          style={{
            display: "flex",
            gap: 6,
            background: "var(--surface)",
            padding: "4px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            flexWrap: "wrap",
          }}
        >
          {SHOWCASE_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const isRec = tab.id === "recommended";

            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-showcase-${tab.id}`}
                aria-selected={isActive}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  border: isActive ? "1px solid var(--gold)" : "1px solid transparent",
                  background: isActive ? "rgba(242, 193, 78, 0.16)" : "transparent",
                  color: isActive ? "var(--gold)" : "var(--muted)",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{tab.label}</span>
                {isRec && userPreferences.length > 0 && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--gold)",
                      display: "inline-block",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dica para a aba de Recomendações */}
      {activeTab === "recommended" && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(242, 193, 78, 0.06)",
            border: "1px dashed rgba(242, 193, 78, 0.3)",
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            fontSize: 12.5,
          }}
        >
          <span>
            {userPreferences.length > 0 ? (
              <>
                ✨ Recomendações baseadas nas suas categorias favoritas:{" "}
                <strong className="gold-text">
                  {userPreferences.map((p) => CATEGORIES[p]?.label || p).join(", ")}
                </strong>
              </>
            ) : (
              <>
                🎯 Dica: Defina suas preferências na sua conta para personalizarmos ainda mais suas ofertas!
              </>
            )}
          </span>

          <Link
            href="/conta"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11.5, padding: "4px 10px", height: "auto" }}
          >
            Personalizar preferências →
          </Link>
        </div>
      )}

      {/* Grid de Cards dos Produtos */}
      <div className="grid">
        {filteredProducts.map((p, idx) => (
          <ProductCard key={`${activeTab}-${p.id}`} product={p} index={idx} />
        ))}
      </div>

      {/* Rodapé com link para catálogo completo */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
        <Link
          href="/?cat=todos#catalogo"
          className="btn btn-ghost"
          style={{ fontSize: 13, gap: 8, padding: "10px 20px" }}
        >
          Ver todas as ofertas do catálogo <ArrowRight width={14} height={14} />
        </Link>
      </div>
    </section>
  );
}
