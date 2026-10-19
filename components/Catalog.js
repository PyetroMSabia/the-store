"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductCard } from "./ProductUI";
import { TABS } from "@/lib/catalog";
import { productMatches, isTopRated } from "@/lib/offers";

const SORTS = {
  recent: { label: "Mais recentes", fn: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0) },
  priceAsc: { label: "Menor preço", fn: (a, b) => a.price - b.price },
  priceDesc: { label: "Maior preço", fn: (a, b) => b.price - a.price },
  rating: { label: "Melhor avaliação", fn: (a, b) => (b.rating || 0) - (a.rating || 0) },
};

export default function Catalog({ products = [], cat = "todos", q = "" }) {
  const [sort, setSort] = useState("recent");
  const [sealOnly, setSealOnly] = useState(false);

  const counts = useMemo(() => {
    const c = {};
    for (const t of TABS) {
      c[t.key] = products.filter((p) => productMatches(p, t.key, q)).length;
    }
    return c;
  }, [products, q]);

  const list = useMemo(() => {
    return products
      .filter((p) => productMatches(p, cat, q) && (!sealOnly || isTopRated(p)))
      .sort(SORTS[sort].fn);
  }, [products, cat, q, sealOnly, sort]);

  const tabHref = (key) => {
    const sp = new URLSearchParams();
    if (key !== "todos") sp.set("cat", key);
    if (q) sp.set("q", q);
    const s = sp.toString();
    return `/${s ? `?${s}` : ""}#catalogo`;
  };

  return (
    <section className="section" id="catalogo" style={{ scrollMarginTop: 90 }}>
      <div className="section-head">
        <div>
          <h2>
            Destaques da <span className="gold-text">Curadoria</span>
          </h2>
          <p>As melhores ofertas das maiores lojas (Shopee, Shein, Mercado Livre, Amazon e mais), filtradas pelo menor preço e melhor avaliação.</p>
        </div>
      </div>

      {q && (
        <p className="search-note">
          {list.length} resultado(s) para <b>“{q}”</b> ·{" "}
          <Link href={cat !== "todos" ? `/?cat=${cat}#catalogo` : "/#catalogo"} className="gold-text">
            limpar busca
          </Link>
        </p>
      )}

      <div className="controls">
        <div className="pills" role="tablist">
          {TABS.map((t) => (
            <Link
              key={t.key}
              id={`pill-${t.key}`}
              href={tabHref(t.key)}
              scroll={false}
              role="tab"
              aria-selected={cat === t.key}
              className={`pill ${cat === t.key ? "active" : ""}`}
            >
              {t.label}
              <span className="count">{counts[t.key] || 0}</span>
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <label className="toggle-seal" id="seal-toggle" onClick={() => setSealOnly((v) => !v)}>
            <span className={`switch ${sealOnly ? "on" : ""}`} /> Só com selo (Nota ≥ 4.7)
          </label>

          <label htmlFor="sort-select" className="sr-only">
            Ordenar
          </label>
          <select id="sort-select" className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {list.length > 0 ? (
        <div className="grid">
          {list.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>Nenhum produto cadastrado nesta categoria ainda</h3>
          <p>
            {cat !== "todos" || q
              ? "Tente selecionar outra categoria ou limpar a busca acima."
              : "Cadastre novas ofertas ou importe produtos por link diretamente no Painel da Curadoria."}
          </p>
          <div style={{ marginTop: 20 }}>
            <Link href="/admin" className="btn btn-ghost btn-sm">
              Ir para o Painel da Curadoria
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
