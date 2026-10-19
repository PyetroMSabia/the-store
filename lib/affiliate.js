import { STORES, storeKeyByName } from "./stores.js";

/**
 * Monta o link de saída rastreável.
 * - Se o link cadastrado já for o seu link de afiliado oficial (ex.: gerado no
 *   painel da Shopee/ML), ele é mantido e só recebe as UTMs.
 * - Se existir a variável de ambiente da loja (ex.: AFFILIATE_AMAZON=meutag-20),
 *   o parâmetro de afiliado é injetado automaticamente.
 */
export function buildAffiliateUrl(storeName, rawUrl, productId) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  const store = STORES[storeKeyByName(storeName)];
  const affiliateId = store?.affiliateEnv ? process.env[store.affiliateEnv] : null;
  if (store?.affiliateParam && affiliateId && !url.searchParams.has(store.affiliateParam)) {
    url.searchParams.set(store.affiliateParam, affiliateId);
  }
  url.searchParams.set("utm_source", "thestore");
  url.searchParams.set("utm_medium", "affiliate");
  if (productId) url.searchParams.set("utm_content", productId);
  return url.toString();
}
