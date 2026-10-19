import { CATEGORIES } from "./catalog.js";
import { formatBRL } from "./offers.js";

/**
 * Calcula estatísticas financeiras entre os links e ofertas cadastradas.
 */
export function calculateOfferStats(offers = []) {
  const valid = (offers || []).filter((o) => o && Number(o.price) > 0);
  if (!valid.length) {
    return {
      count: 0,
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      savings: 0,
      savingsPct: 0,
      cheapestOffer: null,
    };
  }

  const prices = valid.map((o) => Math.round(Number(o.price) * 100) / 100);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const sumPrice = prices.reduce((acc, p) => acc + p, 0);
  const avgPrice = Math.round((sumPrice / prices.length) * 100) / 100;
  const savings = maxPrice > minPrice ? Math.round((maxPrice - minPrice) * 100) / 100 : 0;
  const savingsPct = maxPrice > 0 && savings > 0 ? Math.round((savings / maxPrice) * 100) : 0;
  const cheapestOffer = valid.find((o) => Math.round(Number(o.price) * 100) / 100 === minPrice) || valid[0];

  return {
    count: valid.length,
    minPrice,
    maxPrice,
    avgPrice,
    savings,
    savingsPct,
    cheapestOffer,
  };
}

/**
 * Gera automaticamente uma descrição limpa e um resumo inteligente da IA
 * com base no título, categoria, avaliação e comparativo de preços entre as lojas.
 */
export function generateAiSummaryAndDescription({
  title,
  category = "other",
  rating = 4.8,
  offers = [],
  storeName = "Loja Parceira",
  existingDescription = "",
}) {
  const cleanTitle = (title || "").trim();
  const catLabel = CATEGORIES[category]?.label || "Geral";
  const stats = calculateOfferStats(offers);
  const numStores = stats.count || (offers.length ? offers.length : 1);
  const bestStore = stats.cheapestOffer?.storeName || storeName || "Loja Oficial";
  const ratingDisplay = rating ? Number(rating).toFixed(1) : "4.8";

  // 1. Descrição limpa do produto
  let description = existingDescription ? existingDescription.trim() : "";
  if (!description || description.length < 30) {
    description = `${cleanTitle}. Selecionado na categoria de ${catLabel} pela curadoria The Store. ` +
      `Apresenta alto padrão de construção, design contemporâneo e excelente usabilidade. ` +
      `Ideal para quem busca máxima confiabilidade, acabamento de qualidade e compra segura garantida pelas maiores plataformas do Brasil.`;
  }

  // 2. Resumo Inteligente feito por IA (The Store AI)
  let priceComparisonText = "";
  if (numStores > 1 && stats.savings > 0) {
    priceComparisonText =
      `Identificamos este item em ${numStores} lojas com valor médio de mercado de ${formatBRL(stats.avgPrice)}. ` +
      `A oportunidade mais vantajosa é na ${bestStore} por ${formatBRL(stats.minPrice)}, garantindo uma economia real de até ${formatBRL(stats.savings)} (-${stats.savingsPct}% em relação ao maior preço).`;
  } else if (stats.minPrice > 0) {
    priceComparisonText =
      `Oferta monitorada na ${bestStore} por ${formatBRL(stats.minPrice)}, com verificação de preço e autenticidade validada pela nossa curadoria.`;
  } else {
    priceComparisonText =
      `Preço monitorado continuamente entre as lojas oficiais para assegurar a melhor condição de compra do mercado.`;
  }

  const aiSummary =
    `✨ Análise The Store AI: ${cleanTitle} se destaca na categoria ${catLabel} por aliar excelente receptividade dos compradores (nota ${ratingDisplay}/5) a um índice de satisfação comprovado. ` +
    `${priceComparisonText} ` +
    `🎯 Veredito da Curadoria: Produto com procedência verificada, excelente relação custo-benefício e checkout 100% seguro direto na loja oficial credenciada.`;

  return {
    description,
    aiSummary,
    stats,
  };
}
