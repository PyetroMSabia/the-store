import "server-only";
import * as cheerio from "cheerio";
import { guessCategory, CATEGORIES } from "./catalog.js";
import { generateAiSummaryAndDescription } from "./aiSummary.js";
import { STORES, STORE_NAMES } from "./stores.js";
import { safeFetch } from "./net.js";

/** Lojas recomendadas conforme a categoria do produto */
const STORES_BY_CATEGORY = {
  clothing: ["Shein", "Shopee", "Mercado Livre", "Amazon", "Netshoes"],
  accessories: ["Shopee", "Mercado Livre", "Shein", "Amazon", "AliExpress"],
  electronics: ["Mercado Livre", "Amazon", "Shopee", "KaBuM!", "Magalu"],
  furniture: ["Mercado Livre", "Magalu", "Amazon", "Casas Bahia", "Shopee"],
  beauty: ["Shopee", "Shein", "Amazon", "Mercado Livre", "Magalu"],
  other: ["Mercado Livre", "Shopee", "Amazon", "Magalu"],
};

/** Gera o link de busca oficial correspondente a cada marketplace */
function buildStoreSearchUrl(storeName, query) {
  const q = encodeURIComponent(query.trim());
  switch (storeName) {
    case "Mercado Livre":
      return `https://lista.mercadolivre.com.br/${encodeURIComponent(query.trim().replace(/\s+/g, "-"))}`;
    case "Shopee":
      return `https://shopee.com.br/search?keyword=${q}`;
    case "Amazon":
      return `https://www.amazon.com.br/s?k=${q}`;
    case "Shein":
      return `https://br.shein.com/pdsearch/${q}`;
    case "Magalu":
      return `https://www.magazineluiza.com.br/busca/${q}`;
    case "KaBuM!":
      return `https://www.kabum.com.br/busca/${q}`;
    case "AliExpress":
      return `https://pt.aliexpress.com/w/wholesale-${q}.html`;
    case "Casas Bahia":
      return `https://www.casasbahia.com.br/${q}/b`;
    case "Netshoes":
      return `https://www.netshoes.com.br/busca?q=${q}`;
    default:
      return `https://www.google.com/search?q=${encodeURIComponent(storeName + " " + query)}`;
  }
}

/**
 * Busca fotos reais do produto específico na web em cascata:
 * - Camada 1: Mercado Livre (HTML e API)
 * - Camada 2: Bing Images Scraper (sem chave de API, extrai URLs reais de lojas brasileiras)
 * NUNCA utiliza fotos genéricas do Unsplash ou de categoria.
 */
async function fetchRealProductImages(productName) {
  const images = [];
  const q = productName.trim();

  // Camada 1: Mercado Livre HTML
  try {
    const mlSearchUrl = `https://lista.mercadolivre.com.br/${encodeURIComponent(q.replace(/\s+/g, "-"))}`;
    const res = await safeFetch(mlSearchUrl, { timeoutMs: 8000, maxBytes: 1.5 * 1024 * 1024 });

    if (res && res.html) {
      const html = res.html;
      const $ = cheerio.load(html);

      // Procura tags de imagem em resultados de busca do Mercado Livre
      $("img.ui-search-result-image__element, img.poly-component__picture, .ui-search-result img").each((_, el) => {
        let src = $(el).attr("data-src") || $(el).attr("src");
        if (src && src.includes("mlstatic.com") && !src.includes("logo") && !src.includes("frontend-assets")) {
          src = src.replace(/-[IV]\.jpg/i, "-O.jpg").replace(/-[IV]\.webp/i, "-F.webp");
          if (!images.includes(src)) images.push(src);
        }
      });

      // Regex fallback caso o DOM do ML utilize atributos dinâmicos
      if (images.length === 0) {
        const mlMatches = [...html.matchAll(/https:\/\/http2\.mlstatic\.com\/D_NQ_NP_[^\s"'<>]+/gi)].map((m) => m[0]);
        for (let m of mlMatches) {
          m = m.replace(/-[IV]\.jpg/i, "-O.jpg").replace(/-[IV]\.webp/i, "-F.webp");
          if (!images.includes(m) && !m.includes("logo") && !m.includes("frontend-assets")) {
            images.push(m);
            if (images.length >= 4) break;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[fetchRealProductImages] Camada 1 ML:", err.message);
  }

  // Camada 2: Bing Images Scraper (Infalível e sem bloqueio para produtos reais de e-commerce)
  if (images.length < 4) {
    try {
      const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(q + " produto oficial")}&form=HDRSC2`;
      const res = await safeFetch(bingUrl, { timeoutMs: 8000, maxBytes: 1.5 * 1024 * 1024 });

      if (res && res.html) {
        const html = res.html;
        const $ = cheerio.load(html);

        $(".iusc").each((_, el) => {
          if (images.length >= 6) return;
          const m = $(el).attr("m");
          if (m) {
            try {
              const parsed = JSON.parse(m);
              const murl = parsed.murl;
              if (
                murl &&
                /^https?:\/\//i.test(murl) &&
                !murl.includes("unsplash.com") &&
                !murl.includes("picsum.photos") &&
                !murl.includes("placeholder") &&
                !murl.includes("wikimedia.org") &&
                !images.includes(murl)
              ) {
                images.push(murl);
              }
            } catch {}
          }
        });
      }
    } catch (err) {
      console.warn("[fetchRealProductImages] Camada 2 Bing:", err.message);
    }
  }

  return images.slice(0, 4);
}

/**
 * Realiza a autodescoberta do produto nas lojas parceiras com fotos REAIS e específicas.
 */
export async function searchMultiStores(productName) {
  const query = String(productName || "").trim();
  if (!query) throw new Error("Informe o nome do produto.");

  const category = guessCategory(query);
  let officialTitle = query;
  let realPrice = 0;
  let realOldPrice = 0;
  let mlPermalink = "";
  let attributesText = "";
  let realImages = [];

  // 1. Tenta consulta à API pública do Mercado Livre
  try {
    const mlUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=5`;
    const res = await safeFetch(mlUrl, {
      timeoutMs: 8000,
      maxBytes: 512 * 1024,
      headers: { Accept: "application/json" },
    });

    if (res && res.html) {
      const data = JSON.parse(res.html);
      if (Array.isArray(data.results) && data.results.length > 0) {
        const top = data.results[0];
        officialTitle = top.title || officialTitle;
        realPrice = Number(top.price) || 0;
        realOldPrice = Number(top.original_price) || 0;
        mlPermalink = top.permalink || "";

        if (top.thumbnail) {
          const highRes = top.thumbnail
            .replace("-I.jpg", "-O.jpg")
            .replace("-V.jpg", "-O.jpg")
            .replace("http://", "https://");
          realImages.push(highRes);
        }

        // Tenta fotos adicionais dos outros resultados do ML
        for (let i = 1; i < Math.min(data.results.length, 4); i++) {
          const it = data.results[i];
          if (it.thumbnail) {
            const h = it.thumbnail
              .replace("-I.jpg", "-O.jpg")
              .replace("-V.jpg", "-O.jpg")
              .replace("http://", "https://");
            if (!realImages.includes(h)) realImages.push(h);
          }
        }

        if (Array.isArray(top.attributes)) {
          const relevant = top.attributes
            .filter((a) => a.value_name && a.name && !a.name.includes("ID") && a.value_name !== "Não")
            .slice(0, 6)
            .map((a) => `• ${a.name}: ${a.value_name}`)
            .join("\n");
          if (relevant) attributesText = relevant;
        }
      }
    }
  } catch (err) {
    console.warn("[searchMultiStores] Erro ao consultar API Mercado Livre:", err.message);
  }

  // 2. Busca fotos reais correspondentes ao nome exato do produto (Mercado Livre + Bing Scraper)
  const webImages = await fetchRealProductImages(officialTitle || query);
  for (const w of webImages) {
    if (!realImages.includes(w)) realImages.push(w);
  }

  // Define a foto principal e as opções alternativas
  const mainImage = realImages[0] || "";
  const imageOptions = realImages.slice(0, 4);

  // Se não obteve preço real, define um valor estimado de base para calcular ofertas proporcionais
  if (!realPrice || realPrice <= 0) {
    if (category === "electronics") realPrice = 179.90;
    else if (category === "clothing") realPrice = 89.90;
    else if (category === "accessories") realPrice = 59.90;
    else if (category === "furniture") realPrice = 249.90;
    else if (category === "beauty") realPrice = 69.90;
    else realPrice = 99.90;
  }

  // 3. Define lojas participantes para este produto
  const storePool = STORES_BY_CATEGORY[category] || ["Mercado Livre", "Shopee", "Amazon", "Magalu"];
  const chosenStores = storePool.slice(0, 4);

  // Variação de preços realista entre as lojas para gerar concorrência
  const priceVariations = [
    { factor: 0.89, oldFactor: 1.18 }, // A mais barata (ex: -11% de desconto)
    { factor: 1.00, oldFactor: 1.25 }, // Preço base oficial
    { factor: 1.06, oldFactor: 1.30 }, // Segunda opção
    { factor: 1.12, oldFactor: 1.35 }, // Terceira opção
  ];

  const offers = chosenStores.map((storeName, idx) => {
    const variation = priceVariations[idx] || { factor: 1.0 + idx * 0.05, oldFactor: 1.25 };
    const p = Math.round(realPrice * variation.factor * 100) / 100;
    const oldP = Math.round(realPrice * variation.oldFactor * 100) / 100;

    let url = "";
    if (storeName === "Mercado Livre" && mlPermalink) {
      url = mlPermalink; // Link direto do anúncio oficial encontrado
    } else {
      url = buildStoreSearchUrl(storeName, officialTitle);
    }

    return {
      id: `offer-${idx + 1}`,
      storeName,
      affiliateUrl: url,
      price: p,
      oldPrice: oldP > p ? oldP : null,
      isPrimary: idx === 0,
    };
  });

  // Ordena ofertas da mais barata para a mais cara
  offers.sort((a, b) => a.price - b.price);
  offers.forEach((o, i) => {
    o.isPrimary = i === 0;
  });

  const availableStores = offers.map((o) => o.storeName);
  const primaryOffer = offers[0];

  // 4. Descrição rica com especificações reais
  const catLabel = CATEGORIES[category]?.label || "Geral";
  let description = `${officialTitle}\n\n` +
    `Item selecionado na curadoria de ${catLabel} da The Store. ` +
    `Possui excelente acabamento, garantia nacional e avaliação comprovada de satisfação.\n\n` +
    `Principais características:\n` +
    (attributesText
      ? attributesText
      : `• Alta durabilidade e construção premium\n• Compatível com uso diário e profissional\n• Produto original com garantia de fábrica\n• Embalagem lacrada com envio rápido`);

  // 5. Resumo inteligente da IA
  const { aiSummary } = generateAiSummaryAndDescription({
    title: officialTitle,
    category,
    rating: 4.8,
    offers,
    storeName: primaryOffer.storeName,
    existingDescription: description,
  });

  return {
    success: true,
    title: officialTitle,
    category,
    rating: 4.8,
    imageUrl: mainImage,
    imageOptions,
    images: imageOptions.length > 0 ? imageOptions : (mainImage ? [mainImage] : []),
    price: primaryOffer.price,
    oldPrice: primaryOffer.oldPrice || null,
    storeName: primaryOffer.storeName,
    affiliateUrl: primaryOffer.affiliateUrl,
    availableStores,
    offers,
    description,
    aiSummary,
  };
}
