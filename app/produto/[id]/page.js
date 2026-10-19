import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard, Seal, StoreChip, Stars } from "@/components/ProductUI";
import { getProduct, listRelated } from "@/lib/products";
import { CATEGORIES } from "@/lib/catalog";
import { formatBRL, isTopRated, isOnSale, isNewProduct, discountPct, MIN_RATING } from "@/lib/offers";
import { SparkIcon, ShieldIcon, ScaleIcon } from "@/components/Icons";
import ProductGallery from "@/components/ProductGallery";
import ProductOffersList from "@/components/ProductOffersList";
import { generateAiSummaryAndDescription, calculateOfferStats } from "@/lib/aiSummary";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: "Produto não encontrado" };

  return {
    title: `${product.title} — Comparador The Store (${formatBRL(product.price)})`,
    description: `Compare preços e veja onde comprar ${product.title} com o menor valor verificado na The Store.`,
    openGraph: {
      images: [product.imageUrl],
    },
  };
}

export default async function ProductPage({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const top = isTopRated(product);
  const sale = isOnSale(product);
  const isNew = isNewProduct(product);
  const pct = discountPct(product);
  const related = await listRelated(product, 4);

  // Garante que o produto sempre tenha lista de fotos válida
  const galleryImages = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [product.imageUrl];

  // Garante lista de ofertas válida com fallback para Link 1
  const rawOffers = Array.isArray(product.offers) && product.offers.length > 0
    ? product.offers
    : [
        {
          id: "offer-1",
          storeName: product.storeName || "Loja Oficial",
          affiliateUrl: product.affiliateUrl,
          price: product.price,
          oldPrice: product.oldPrice,
          isPrimary: true,
        },
      ];

  const offerStats = calculateOfferStats(rawOffers);
  const storesCount = offerStats.count || rawOffers.length;

  // Garante resumo de IA e descrição elegantes
  const fallbackAi = generateAiSummaryAndDescription({
    title: product.title,
    category: product.category,
    rating: product.rating || 4.8,
    offers: rawOffers,
    storeName: product.storeName,
    existingDescription: product.description,
  });

  const finalDescription = product.description || fallbackAi.description;
  const finalAiSummary = product.aiSummary || fallbackAi.aiSummary;

  return (
    <>
      <nav className="breadcrumbs" aria-label="Trilha de navegação">
        <Link href="/">Início</Link> <span>/</span>
        <Link href={`/?cat=${product.category}#catalogo`}>
          {CATEGORIES[product.category]?.label || "Geral"}
        </Link>{" "}
        <span>/</span>
        <span style={{ color: "var(--text)" }}>{product.title}</span>
      </nav>

      <div className="pd">
        {/* COLUNA DA ESQUERDA: FOTOS DO PRODUTO (REQUISITO 3) */}
        <div className="pd-left-col">
          <ProductGallery
            images={galleryImages}
            title={product.title}
            badges={
              <div className="card-badges">
                <span>{top && <Seal />}</span>
                <span style={{ display: "flex", gap: 6 }}>
                  {pct > 0 && <span className="tag sale">-{pct}%</span>}
                  {isNew && <span className="tag new">Novo</span>}
                </span>
              </div>
            }
          />
        </div>

        {/* COLUNA DA DIREITA: TOPO, CARD CENTRAL E LISTA DE LINKS */}
        <div className="pd-info reveal" style={{ animationDelay: "120ms" }}>
          {/* TOPO: SELOS DAS LOJAS DISPONÍVEIS + BADGE DOURADO "SELO THE STORE — OFERTA VALIDADA" */}
          <div className="pd-header-top">
            <div className="pd-stores-row">
              {Array.isArray(product.availableStores) && product.availableStores.length > 0 ? (
                product.availableStores.map((st) => (
                  <StoreChip key={st} storeName={st} />
                ))
              ) : (
                <StoreChip storeName={product.storeName} />
              )}
            </div>

            <Seal large />
          </div>

          {/* NOME DO PRODUTO EM DESTAQUE E SUBTÍTULO / AVALIAÇÃO */}
          <h1 className="pd-title-main">{product.title}</h1>

          <div className="pd-sub-rating">
            {product.rating != null && <Stars rating={product.rating} />}
            <span className="muted" style={{ fontSize: 13 }}>
              Loja de referência: <strong>{product.storeName}</strong>
            </span>
            <span className="muted" style={{ fontSize: 12.5 }}>
              · {storesCount} {storesCount === 1 ? "loja parceira monitorada" : "lojas parceiras monitoradas"}
            </span>
          </div>

          {/* CARD CENTRAL INFORMATIVO COMPLETO: 3 SEÇÕES BEM ORGANIZADAS (REQUISITO 3) */}
          <div className="pd-central-info-card">
            {/* SEÇÃO 1: DESCRIÇÃO DO PRODUTO */}
            <div className="pd-central-section">
              <h2 className="pd-central-sec-title">
                Descrição do Produto
              </h2>
              <p className="pd-central-desc-text">
                {finalDescription}
              </p>
            </div>

            {/* SEÇÃO 2: MÉDIA DE PREÇO ENTRE SITES */}
            <div className="pd-central-section pd-price-average-box">
              <div className="pd-avg-header">
                <div className="pd-avg-icon">
                  <ScaleIcon width={20} height={20} />
                </div>
                <div>
                  <span className="pd-avg-badge">Radar de Mercado The Store</span>
                  <div className="pd-avg-title">
                    Média entre {storesCount} {storesCount === 1 ? "loja" : "lojas"}:{" "}
                    <strong className="gold-text">{formatBRL(offerStats.avgPrice)}</strong>
                  </div>
                </div>
              </div>

              {storesCount > 1 && offerStats.savings > 0 ? (
                <div className="pd-avg-savings-highlight">
                  <span className="savings-pill">
                    Economia de até {formatBRL(offerStats.savings)}
                  </span>
                  <span className="savings-detail muted">
                    comprando pelo menor preço na <strong>{offerStats.cheapestOffer?.storeName}</strong> ({formatBRL(offerStats.minPrice)}) em vez da cotação mais alta ({formatBRL(offerStats.maxPrice)}).
                  </span>
                </div>
              ) : (
                <div className="pd-avg-savings-highlight">
                  <span className="savings-detail muted">
                    Menor preço verificado de mercado: <strong className="gold-text">{formatBRL(offerStats.minPrice)}</strong> com garantia oficial e entrega monitorada.
                  </span>
                </div>
              )}
            </div>

            {/* SEÇÃO 3: RESUMO DO PRODUTO POR IA */}
            <div className="pd-central-section pd-ai-summary-box">
              <div className="pd-ai-header">
                <span className="pd-ai-icon-sparkle">
                  <SparkIcon width={16} height={16} />
                </span>
                <span className="pd-ai-title">Resumo do Produto por IA</span>
                <span className="pd-ai-tag">The Store AI</span>
              </div>
              <div className="pd-ai-body">
                {finalAiSummary}
              </div>
            </div>
          </div>

          {/* PARTE INFERIOR: LISTA DE LINKS (LINK 1, LINK 2, LINK 3...) ORDENADOS DO MENOR PARA O MAIOR PREÇO (REQUISITO 3) */}
          <ProductOffersList productId={product.id} offers={rawOffers} />

          {/* NOTA DE CONFIABILIDADE E CRITÉRIOS DA CURADORIA */}
          <div className="pd-trust-footer">
            <span>
              <ShieldIcon width={15} height={15} style={{ color: "var(--gold)" }} />
              Redirecionamento oficial seguro para o checkout da loja parceira
            </span>
            <span>
              ✓ Preços sincronizados e links validados contra fraudes
            </span>
          </div>
        </div>
      </div>

      {/* PRODUTOS RELACIONADOS DA CATEGORIA */}
      {related.length > 0 && (
        <section className="section" style={{ marginTop: 40 }}>
          <div className="section-head">
            <div>
              <h2>Mais achados em {CATEGORIES[product.category]?.label || "destaque"}</h2>
              <p>Mais ofertas selecionadas e validadas em nossa curadoria.</p>
            </div>
          </div>
          <div className="grid">
            {related.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
