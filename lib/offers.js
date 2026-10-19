import { fold } from "./catalog.js";

/**
 * Regras de vitrine da The Store (puras — usadas no cliente e no servidor).
 * Tudo é derivado dos dados reais salvos no banco:
 *   - "Bem avaliado" (selo): nota real do produto ≥ MIN_RATING.
 *   - "Novidade": publicado há no máximo NEW_DAYS dias.
 *   - "Oferta": possui preço anterior maior que o preço atual.
 */
export const MIN_RATING = 4.7;
export const NEW_DAYS = 14;

export const formatBRL = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const isTopRated = (p) => Number(p?.rating) >= MIN_RATING;

export const isOnSale = (p) => Number(p?.oldPrice) > Number(p?.price);

export const discountPct = (p) => (isOnSale(p) ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);

export const isNewProduct = (p, now = Date.now()) =>
  !!p?.createdAt && now - new Date(p.createdAt).getTime() <= NEW_DAYS * 86400000;

export function productMatches(product, cat, q, now) {
  if (cat === "novidades" && !isNewProduct(product, now)) return false;
  if (cat === "ofertas" && !isOnSale(product)) return false;
  if (cat && !["todos", "novidades", "ofertas"].includes(cat) && product.category !== cat) return false;
  if (q) {
    const hay = fold([product.title, product.description, product.storeName].join(" "));
    return fold(q)
      .split(/\s+/)
      .filter(Boolean)
      .every((w) => hay.includes(w));
  }
  return true;
}

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";
