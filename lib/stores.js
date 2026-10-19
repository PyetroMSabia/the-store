/**
 * Lojas parceiras suportadas pela The Store.
 * - `domains`: usados para identificar automaticamente a loja pela URL do produto.
 * - `affiliateParam` / `affiliateEnv`: parâmetro de URL e variável de ambiente usados
 *   para injetar seu ID de afiliado no link de saída (ver lib/affiliate.js).
 */
export const STORES = {
  shopee: {
    name: "Shopee", short: "Shopee", color: "#EE4D2D", text: "#FFFFFF",
    domains: ["shopee.com.br", "shopee.com", "shp.ee", "shope.ee"],
    affiliateParam: "af_id", affiliateEnv: "AFFILIATE_SHOPEE",
  },
  shein: {
    name: "Shein", short: "Shein", color: "#111111", text: "#FFFFFF",
    domains: ["shein.com", "shein.com.br", "shein.top", "sheinlink.com"],
    affiliateParam: "url_from", affiliateEnv: "AFFILIATE_SHEIN",
  },
  mercadolivre: {
    name: "Mercado Livre", short: "ML", color: "#FFE600", text: "#2D3277",
    domains: ["mercadolivre.com.br", "mercadolivre.com", "mercadolibre.com", "meli.la", "mlb.am"],
    affiliateParam: "matt_tool", affiliateEnv: "AFFILIATE_MERCADOLIVRE",
  },
  amazon: {
    name: "Amazon", short: "Amazon", color: "#232F3E", text: "#FF9900",
    domains: ["amazon.com.br", "amazon.com", "amzn.to", "amzn.com", "a.co"],
    affiliateParam: "tag", affiliateEnv: "AFFILIATE_AMAZON",
  },
  aliexpress: {
    name: "AliExpress", short: "Ali", color: "#E43225", text: "#FFFFFF",
    domains: ["aliexpress.com", "aliexpress.us", "aliexpress.ru", "ali.ski"],
    affiliateParam: "aff_fcid", affiliateEnv: "AFFILIATE_ALIEXPRESS",
  },
  magalu: {
    name: "Magalu", short: "Magalu", color: "#0086FF", text: "#FFFFFF",
    domains: ["magazineluiza.com.br", "magalu.com", "magazinevoce.com.br", "magalu.com.br"],
    affiliateParam: "partner_id", affiliateEnv: "AFFILIATE_MAGALU",
  },
  temu: {
    name: "Temu", short: "Temu", color: "#FB7701", text: "#FFFFFF",
    domains: ["temu.com"],
  },
  casasbahia: {
    name: "Casas Bahia", short: "CB", color: "#0033A0", text: "#FFD100",
    domains: ["casasbahia.com.br"],
    affiliateParam: "utm_campaign", affiliateEnv: "AFFILIATE_CASASBAHIA",
  },
  americanas: {
    name: "Americanas", short: "Amer", color: "#E60014", text: "#FFFFFF",
    domains: ["americanas.com.br"],
  },
  kabum: {
    name: "KaBuM!", short: "KaBuM", color: "#0060B1", text: "#FF6500",
    domains: ["kabum.com.br"],
  },
  netshoes: {
    name: "Netshoes", short: "Net", color: "#5A2D82", text: "#FFFFFF",
    domains: ["netshoes.com.br"],
  },
  centauro: {
    name: "Centauro", short: "Cent", color: "#D0021B", text: "#FFFFFF",
    domains: ["centauro.com.br"],
  },
  nike: {
    name: "Nike", short: "Nike", color: "#111111", text: "#FFFFFF",
    domains: ["nike.com.br", "nike.com"],
  },
  dafiti: {
    name: "Dafiti", short: "Dafiti", color: "#1A1A1A", text: "#FFFFFF",
    domains: ["dafiti.com.br"],
  },
};

export const STORE_NAMES = Object.values(STORES).map((s) => s.name);

const hostOf = (url) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Identifica a loja pelo domínio da URL. Retorna a chave (ex.: "shopee") ou `null`. */
export function detectStore(url) {
  const host = hostOf(url);
  if (!host) return null;
  for (const [key, store] of Object.entries(STORES)) {
    if (store.domains.some((d) => host === d || host.endsWith(`.${d}`))) return key;
  }
  return null;
}

export function storeKeyByName(name) {
  const n = String(name || "").trim().toLowerCase();
  return Object.keys(STORES).find((k) => STORES[k].name.toLowerCase() === n) || null;
}

/** Estilo visual da loja (cores do chip). Lojas desconhecidas recebem um estilo neutro dourado. */
export function storeStyle(name) {
  const key = storeKeyByName(name);
  if (key) return STORES[key];
  const label = String(name || "Loja").trim();
  return { name: label, short: label.slice(0, 6), color: "#2a2414", text: "#f2c14e" };
}

/** Nome "bonito" a partir do domínio, para lojas fora da lista. */
export function prettyStoreFromUrl(url) {
  const host = hostOf(url);
  if (!host) return "";
  const parts = host.split(".");
  const base = parts.length > 2 && parts.at(-2).length <= 3 ? parts.at(-3) : parts.at(-2) || parts[0];
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
}
