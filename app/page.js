import Link from "next/link";
import Catalog from "@/components/Catalog";
import { StoreChip, Stars } from "@/components/ProductUI";
import { ArrowRight, ScaleIcon, ShieldIcon, TruckIcon } from "@/components/Icons";
import { listProducts } from "@/lib/products";
import { CATEGORIES, TABS } from "@/lib/catalog";
import { formatBRL, isTopRated, isOnSale } from "@/lib/offers";
import SafeImage from "@/components/SafeImage";
import ShowcasePanel from "@/components/ShowcasePanel";

export const dynamic = "force-dynamic";

const PARTNERS = [
  "Mercado Livre",
  "Shopee",
  "Amazon",
  "Shein",
  "AliExpress",
  "Magalu",
  "Casas Bahia",
  "KaBuM!",
  "Nike",
  "Centauro",
];

export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const cat = TABS.some((t) => t.key === sp?.cat) ? sp.cat : "todos";
  const q = typeof sp?.q === "string" ? sp.q.slice(0, 80) : "";

  // 100% dados reais vindos do banco relacional Supabase
  const products = await listProducts();
  const sealed = products.filter(isTopRated).length;
  const onSaleCount = products.filter(isOnSale).length;

  const storesSet = new Set(products.map((p) => p.storeName));
  const distinctStoresCount = storesSet.size;

  // Destaque real: produto com melhor avaliação ou maior desconto
  const topProduct = products.find(isTopRated) || products[0] || null;

  return (
    <>
      {!q && (
        <>
          <section className="hero reveal" id="hero">
            <div style={{ position: "relative" }}>
              <span className="eyebrow">
                <span className="dot" /> Curadoria de ofertas
              </span>
              <h1>
                Antes de abrir outro app, <em className="gold-text">abra a The Store.</em>
              </h1>
              <p className="lead">
                Agregamos as melhores ofertas com links oficiais da Shopee, Shein, Mercado Livre, Amazon e muito mais. Produtos selecionados, notas comprovadas e direcionamento seguro para a compra.
              </p>

              <div className="hero-actions">
                <Link href="/?cat=todos#catalogo" className="btn btn-gold" id="hero-cta">
                  Ver ofertas validadas <ArrowRight width={16} height={16} />
                </Link>
                <Link href="/ajuda" className="btn btn-ghost" id="hero-how">
                  Como funciona o selo
                </Link>
              </div>

              <div className="hero-stats">
                <div>
                  <strong className="gold-text">{distinctStoresCount || 5}+</strong>
                  <span>lojas parceiras</span>
                </div>
                <div>
                  <strong className="gold-text">{products.length}</strong>
                  <span>produtos selecionados</span>
                </div>
                <div>
                  <strong className="gold-text">{sealed}</strong>
                  <span>produtos com selo</span>
                </div>
                <div>
                  <strong className="gold-text">{onSaleCount}</strong>
                  <span>ofertas ativas</span>
                </div>
              </div>
            </div>

            <div className="hero-visual">
              <img className="hero-logo" src="/logo.jpg" alt="The Store" />
              {topProduct && (
                <Link href={`/produto/${topProduct.id}`} className="float-chip c1">
                  <StoreChip storeName={topProduct.storeName} />
                  <span>
                    <b>{formatBRL(topProduct.price)}</b>
                    <small>{topProduct.title.slice(0, 26)}…</small>
                  </span>
                </Link>
              )}
            </div>
          </section>

          <div className="partners" aria-label="Lojas parceiras">
            <div className="partners-track">
              {[...PARTNERS, ...PARTNERS].map((p, i) => (
                <span key={i}>{p}</span>
              ))}
            </div>
          </div>

          {/* PAINEL DE VITRINE DINÂMICA (REQUISITO 1) */}
          <ShowcasePanel products={products} />

          <section className="section" id="categorias" style={{ scrollMarginTop: 90 }}>
            <div className="section-head">
              <div>
                <h2>Categorias</h2>
                <p>Navegue pela curadoria especializada de cada nicho.</p>
              </div>
            </div>
            <div className="cat-tiles">
              {Object.entries(CATEGORIES).map(([key, c]) => {
                const catProducts = products.filter((p) => p.category === key);
                const n = catProducts.length;
                const sampleImage = catProducts[0]?.imageUrl || null;

                return (
                  <Link key={key} href={`/?cat=${key}#catalogo`} className="cat-tile" id={`cat-${key}`}>
                    {sampleImage ? (
                      <SafeImage src={sampleImage} alt={c.label} loading="lazy" />
                    ) : (
                      <div className="cat-tile-bg" />
                    )}
                    <div>
                      <h3>{c.label}</h3>
                      <span>
                        {n} {n === 1 ? "produto selecionado" : "produtos selecionados"} <ArrowRight width={14} height={14} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="section" id="como-funciona" style={{ scrollMarginTop: 90 }}>
            <div className="section-head">
              <div>
                <h2>
                  Por que a <span className="gold-text">The Store</span>?
                </h2>
                <p>Três pilares fundamentais da nossa plataforma.</p>
              </div>
            </div>
            <div className="how">
              <div className="how-card">
                <span className="num">01</span>
                <div className="how-icon">
                  <ShieldIcon />
                </div>
                <h3>Selo Compra Validada</h3>
                <p>Curadoria rigorosa de produtos com avaliações acima de 4.7 estrelas e reputação sólida.</p>
              </div>
              <div className="how-card">
                <span className="num">02</span>
                <div className="how-icon">
                  <ScaleIcon />
                </div>
                <h3>Agregador Oficial de Afiliados</h3>
                <p>Reunimos Shopee, Shein, Mercado Livre e Amazon em uma única vitrine com links rastreados e seguros.</p>
              </div>
              <div className="how-card">
                <span className="num">03</span>
                <div className="how-icon">
                  <TruckIcon />
                </div>
                <h3>Compra na Loja Parceira</h3>
                <p>Você finaliza sua compra diretamente no aplicativo ou site da loja oficial com toda a garantia e frete deles.</p>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Vitrine real com filtros */}
      <Catalog products={products} cat={cat} q={q} />
    </>
  );
}
