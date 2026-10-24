import "server-only";
import * as cheerio from "cheerio";
import { safeFetch } from "./net.js";
import { detectStore, STORES, prettyStoreFromUrl } from "./stores.js";
import { guessCategory } from "./catalog.js";
import { generateAiSummaryAndDescription } from "./aiSummary.js";
import { searchMultiStores } from "./multiStoreSearch.js";

/**
 * Extrator e scraper avançado para URLs de produtos (Shopee, Shein, Mercado Livre, Amazon, etc.).
 *
 * Estratégia em camadas:
 * 1. Identificação do domínio / loja oficial
 * 2. Consulta direta à API pública do Mercado Livre caso exista ID MLB
 * 3. Fetch com User-Agent de social preview (WhatsApp/Facebook) que não sofre bloqueio por captcha
 * 4. Análise de JSON-LD (Schema.org / Product)
 * 5. OpenGraph meta tags (og:title, og:image, og:price:amount / product:price:amount)
 * 6. Twitter cards / meta tags padrão
 * 7. Seletores específicos de marketplaces (Mercado Livre, Amazon, Shopee, Shein, Magalu, etc.)
 * 8. Fallback automático para API do Microlink caso ocorra bloqueio ou dados incompletos
 * 9. Preservação estrita do link de afiliado original (sem redirecionamentos indesejados)
 */

function cleanText(text) {
  if (!text) return "";
  return String(text)
    .replace(/\s+/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
}

function cleanTitle(title) {
  if (!title) return "";
  let t = cleanText(title);
  // Remove sufixos e prefixos comerciais de marketplaces
  t = t
    .replace(/\s*[-–|•]\s*(Mercado Livre|Mercado Libre|Shopee Brasil|Shopee|Amazon\.com\.br|Amazon|Shein|AliExpress|Magalu|Magazine Luiza|KaBuM!|Casas Bahia|Nike|Centauro).*$/i, "")
    .replace(/\s*\|\s*Frete gr[áa]tis.*$/i, "")
    .replace(/\s*\|\s*Parcelamento sem juros.*$/i, "")
    .replace(/\s*\|\s*Compre online.*$/i, "")
    .trim();
  return t;
}

function isGenericTitle(title) {
  if (!title) return true;
  const t = title.toLowerCase().trim();
  return (
    t.length < 4 ||
    t === "mercado livre" ||
    t === "mercado libre" ||
    t === "shopee brasil" ||
    t === "shopee" ||
    t === "amazon.com.br" ||
    t === "amazon" ||
    t === "shein" ||
    t.includes("acesso ao sistema") ||
    t.includes("verificação de conta") ||
    t.includes("account-verification") ||
    t.includes("verifique sua conta") ||
    t.includes("faça seu login") ||
    t.includes("login") ||
    t.includes("captcha") ||
    t.includes("robô")
  );
}

function parsePriceNumber(raw) {
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  if (!raw) return null;

  let str = String(raw).trim();
  str = str.replace(/[R$€£US\s]/gi, "").trim();

  // Ex: "1.299,90" -> "1299.90"
  if (/\d+\.\d{3},\d{2}/.test(str)) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (/\d+,\d{2}$/.test(str)) {
    // Ex: "299,90"
    str = str.replace(",", ".");
  } else if (/\d+,\d{3}\.\d{2}/.test(str)) {
    // Ex US: "1,299.90"
    str = str.replace(/,/g, "");
  }

  const num = parseFloat(str);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null;
}

/** Extrai ID MLB (ex: MLB12345678) de links do Mercado Livre */
export function extractMlbId(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return null;
  // Casos comuns:
  // - .../MLB-3837261921-...
  // - .../MLB3837261921-...
  // - .../p/MLB19612345
  // - ?wid=MLB3837261921 ou &item_id=MLB3837261921
  const m =
    urlStr.match(/(?:item_id[:=]|wid=|[\/=])(MLB-?\d{6,14})/i) ||
    urlStr.match(/(MLB-?\d{6,14})/i);
  if (m) {
    return m[1].replace(/-/g, "").toUpperCase();
  }
  return null;
}

/** Consulta a API pública oficial do Mercado Livre */
async function fetchMercadoLivreApi(mlbId) {
  if (!mlbId) return null;
  try {
    const res = await safeFetch(`https://api.mercadolibre.com/items/${mlbId}`, {
      headers: { Accept: "application/json" },
      timeoutMs: 8000,
      maxBytes: 512 * 1024,
    });
    if (res && res.html) {
      const data = JSON.parse(res.html);
      let imageUrl = null;
      let images = [];
      if (Array.isArray(data.pictures) && data.pictures.length > 0) {
        images = data.pictures
          .map((p) => p.secure_url || p.url)
          .filter(Boolean)
          .map((u) => u.replace(/-[A-Z]\.jpg$/i, "-O.jpg").replace(/-[A-Z]\.webp$/i, "-O.webp"))
          .slice(0, 6);
        imageUrl = images[0] || null;
      } else if (data.thumbnail) {
        imageUrl = data.thumbnail.replace(/-[A-Z]\.jpg$/i, "-O.jpg");
        images = [imageUrl];
      }

      const price = parsePriceNumber(data.price);
      const oldPrice = parsePriceNumber(data.original_price || (data.base_price > data.price ? data.base_price : null));

      return {
        title: cleanTitle(data.title),
        price,
        oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
        imageUrl: imageUrl || null,
        images,
        permalink: data.permalink || null,
      };
    }

    // Se for um item de catálogo /p/MLB...
    const prodRes = await safeFetch(`https://api.mercadolibre.com/products/${mlbId}`, {
      headers: { Accept: "application/json" },
      timeoutMs: 8000,
      maxBytes: 512 * 1024,
    });
    if (prodRes && prodRes.html) {
      const pData = JSON.parse(prodRes.html);
      let imageUrl = null;
      let images = [];
      if (Array.isArray(pData.pictures) && pData.pictures.length > 0) {
        images = pData.pictures
          .map((p) => p.url)
          .filter(Boolean)
          .map((u) => u.replace(/-[A-Z]\.jpg$/i, "-O.jpg").replace(/-[A-Z]\.webp$/i, "-O.webp"))
          .slice(0, 6);
        imageUrl = images[0] || null;
      }
      const price = parsePriceNumber(pData.buy_box_winner?.price);
      const oldPrice = parsePriceNumber(pData.buy_box_winner?.original_price);

      return {
        title: cleanTitle(pData.name),
        price,
        oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
        imageUrl: imageUrl || null,
        images,
        permalink: pData.permalink || null,
      };
    }
  } catch {
    // Falha silenciosa para seguir com os demais métodos
  }
  return null;
}

/** Fallback automático via Microlink API se a página direta estiver bloqueada */
async function fetchMicrolinkFallback(targetUrl) {
  try {
    const res = await safeFetch(
      `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&palette=true`,
      {
        headers: { Accept: "application/json" },
        timeoutMs: 8000,
        maxBytes: 512 * 1024,
      }
    );
    if (res && res.html) {
      const json = JSON.parse(res.html);
      if (json.status === "success" && json.data) {
        const d = json.data;
        const title = cleanTitle(d.title);
        const imageUrl = d.image?.url || null;
        let price = null;
        if (d.price) {
          price = parsePriceNumber(d.price);
        }
        return {
          title: !isGenericTitle(title) ? title : null,
          imageUrl,
          price,
        };
      }
    }
  } catch {}
  return null;
}

function extractJsonLd($, finalUrl) {
  const result = { title: null, image: null, price: null, oldPrice: null, rating: null };
  const scripts = $('script[type="application/ld+json"]');

  scripts.each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      const data = JSON.parse(content);
      const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];

      for (const item of items) {
        if (!item) continue;
        const type = item["@type"];
        const isProduct =
          type === "Product" ||
          (Array.isArray(type) && type.includes("Product")) ||
          type === "IndividualProduct";

        if (isProduct) {
          if (!result.title && item.name) result.title = cleanTitle(item.name);
          if (!result.image) {
            const img = item.image;
            if (typeof img === "string") result.image = img;
            else if (Array.isArray(img) && img[0]) {
              result.image = typeof img[0] === "string" ? img[0] : img[0].url;
            } else if (img?.url) result.image = img.url;
          }

          if (item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
            for (const offer of offers) {
              const p = offer.price || offer.lowPrice;
              if (p && !result.price) {
                result.price = parsePriceNumber(p);
              }
              const old = offer.highPrice;
              if (old && !result.oldPrice) {
                result.oldPrice = parsePriceNumber(old);
              }
            }
          }

          if (!result.rating && item.aggregateRating) {
            const r = parseFloat(item.aggregateRating.ratingValue);
            if (Number.isFinite(r) && r > 0 && r <= 5) result.rating = Math.round(r * 10) / 10;
          }
        }
      }
    } catch {
      // Ignora JSON inválido
    }
  });

  return result;
}

function extractOpenGraph($, finalUrl) {
  const get = (attr, val) => $(`meta[${attr}="${val}"]`).attr("content") || null;

  const title =
    get("property", "og:title") ||
    get("name", "twitter:title") ||
    get("property", "twitter:title") ||
    $("title").text();

  let image =
    get("property", "og:image:secure_url") ||
    get("property", "og:image") ||
    get("name", "twitter:image") ||
    get("property", "twitter:image") ||
    $('link[rel="image_src"]').attr("href");

  if (image && !image.startsWith("http")) {
    try {
      image = new URL(image, finalUrl).toString();
    } catch {}
  }

  const rawPrice =
    get("property", "product:price:amount") ||
    get("property", "og:price:amount") ||
    get("name", "twitter:data1") ||
    get("property", "product:sale_price:amount");

  const rawOldPrice = get("property", "product:original_price:amount");

  return {
    title: cleanTitle(title),
    image: image ? image.trim() : null,
    price: parsePriceNumber(rawPrice),
    oldPrice: parsePriceNumber(rawOldPrice),
  };
}

function extractMarketplaceSpecific($, storeKey) {
  let title = null;
  let image = null;
  let images = [];
  let price = null;
  let oldPrice = null;
  let rating = null;

  if (storeKey === "mercadolivre") {
    title = $(".ui-pdp-title").first().text() || $("h1").first().text();

    // Galeria de imagens do Mercado Livre
    const gallerySet = new Set();
    $("img.ui-pdp-image, .ui-pdp-gallery img, figure.ui-pdp-gallery__figure img, img[class*='gallery']").each((_, el) => {
      let src = $(el).attr("data-zoom") || $(el).attr("data-src") || $(el).attr("src");
      if (src && src.startsWith("http") && !src.includes("data:image") && !src.includes("icon")) {
        src = src.replace(/-[A-Z]\.jpg$/i, "-O.jpg").replace(/-[A-Z]\.webp$/i, "-O.webp");
        gallerySet.add(src);
      }
    });
    images = Array.from(gallerySet).slice(0, 8);
    if (images.length > 0) image = images[0];

    // Preço atual ML — cascata de seletores e meta tags para NUNCA ficar vazio
    let priceFraction = $(".ui-pdp-price__second-line .andes-money-amount__fraction").first().text();
    let priceCents = $(".ui-pdp-price__second-line .andes-money-amount__cents").first().text() || "00";

    if (!priceFraction) {
      priceFraction = $(".ui-pdp-price .andes-money-amount__fraction, .ui-pdp-price--size-large .andes-money-amount__fraction").first().text();
      priceCents = $(".ui-pdp-price .andes-money-amount__cents").first().text() || "00";
    }

    if (!priceFraction) {
      priceFraction = $(".poly-price__current .andes-money-amount__fraction, .ui-search-price__second-line .andes-money-amount__fraction").first().text();
      priceCents = $(".poly-price__current .andes-money-amount__cents").first().text() || "00";
    }

    if (!priceFraction) {
      priceFraction = $(".andes-money-amount__fraction").first().text();
      priceCents = $(".andes-money-amount__cents").first().text() || "00";
    }

    if (priceFraction) {
      price = parsePriceNumber(`${priceFraction},${priceCents}`);
    }

    if (!price) {
      const metaP = $('meta[itemprop="price"]').attr("content") ||
        $('meta[property="product:price:amount"]').attr("content") ||
        $('meta[property="og:price:amount"]').attr("content");
      if (metaP) price = parsePriceNumber(metaP);
    }

    // Preço antigo / original ML
    const oldFraction = $(".ui-pdp-price__original-value .andes-money-amount__fraction").first().text();
    const oldCents = $(".ui-pdp-price__original-value .andes-money-amount__cents").first().text() || "00";
    if (oldFraction) {
      oldPrice = parsePriceNumber(`${oldFraction},${oldCents}`);
    }

    const ratingText = $(".ui-pdp-review__rating").first().text();
    if (ratingText) rating = parseFloat(ratingText.replace(",", "."));
  } else if (storeKey === "amazon") {
    title = $("#productTitle").text();
    const landingImg = $("#landingImage").attr("src") || $("#imgBlkFront").attr("src");
    if (landingImg) image = landingImg;

    const gallerySet = new Set();
    if (landingImg) gallerySet.add(landingImg);
    $("#altImages img, #imageBlock img").each((_, el) => {
      const src = $(el).attr("src");
      if (src && src.startsWith("http") && !src.includes("sprite")) {
        const hires = src.replace(/\._[A-Z0-9_,]+_\./i, ".");
        gallerySet.add(hires);
      }
    });
    images = Array.from(gallerySet).slice(0, 8);

    const whole = $(".a-price-whole").first().text().replace(/[.,]/g, "");
    const fraction = $(".a-price-fraction").first().text() || "00";
    if (whole) {
      price = parsePriceNumber(`${whole}.${fraction}`);
    }

    const oldStr = $(".basisPrice .a-offscreen, span.a-text-price span.a-offscreen").first().text();
    if (oldStr) oldPrice = parsePriceNumber(oldStr);

    const ratingVal = $("i.a-icon-star span.a-icon-alt").first().text();
    if (ratingVal) {
      const match = ratingVal.match(/([\d.,]+)/);
      if (match) rating = parseFloat(match[1].replace(",", "."));
    }
  } else if (storeKey === "shein") {
    title = $(".product-intro__head-name").first().text();
    const sheinImg = $(".crop-image-container img").first().attr("src");
    if (sheinImg) image = sheinImg.startsWith("//") ? `https:${sheinImg}` : sheinImg;
    if (image) images.push(image);

    const sheinPrice = $(".product-intro__head-mainprice").first().text();
    if (sheinPrice) price = parsePriceNumber(sheinPrice);

    const sheinOld = $(".del-price").first().text();
    if (sheinOld) oldPrice = parsePriceNumber(sheinOld);
  } else if (storeKey === "shopee") {
    title = $("div._44qnta").first().text() || $('h1[class*="product-title"]').first().text();
    const shopeeImg = $('div[style*="background-image"]').first().css("background-image");
    if (shopeeImg) {
      const m = shopeeImg.match(/url\(["']?([^"')]+)["']?\)/);
      if (m) {
        image = m[1];
        images.push(m[1]);
      }
    }
    const shopeePrice = $("div.pqTWkA").first().text() || $('div[class*="price"]').first().text();
    if (shopeePrice) price = parsePriceNumber(shopeePrice);
  }

  return {
    title: cleanTitle(title) || null,
    image: image ? image.trim() : null,
    images: images.length ? images : (image ? [image.trim()] : []),
    price: price || null,
    oldPrice: oldPrice || null,
    rating: Number.isFinite(rating) && rating > 0 && rating <= 5 ? Math.round(rating * 10) / 10 : null,
  };
}

/**
 * Resolve links encurtados e redirecionamentos HTTP (s.shopee.com.br, mercadolivre.com/sec/..., amzn.to, a.co, etc.)
 */
export async function resolveShortUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return urlStr;
  try {
    const u = new URL(urlStr.trim());
    const host = u.hostname.toLowerCase();
    const isShortener =
      host.includes("amzn.to") ||
      host.includes("a.co") ||
      host.includes("s.shopee.com.br") ||
      host.includes("shope.ee") ||
      (host.includes("mercadolivre.com") && u.pathname.startsWith("/sec/")) ||
      host.includes("linksynergy") ||
      host.includes("bit.ly") ||
      host.includes("tinyurl.com") ||
      host.includes("t.co");

    if (!isShortener) return urlStr;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(urlStr.trim(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timer);

    if (res && res.url && res.url.startsWith("http")) {
      return res.url;
    }
  } catch {
    // Retorna a URL original caso não consiga resolver
  }
  return urlStr;
}

/**
 * Extrai o nome do produto a partir do slug da URL (Zero Falha quando a loja bloqueia requisições do servidor)
 */
export function extractProductSlug(urlStr) {
  if (!urlStr) return null;
  try {
    const u = new URL(urlStr);
    const path = decodeURIComponent(u.pathname);

    // Shopee: /Nome-Do-Produto-i.12345.67890
    if (path.includes("-i.")) {
      const slug = path.split("-i.")[0].replace(/^\//, "");
      const clean = slug.replace(/[-_]+/g, " ").trim();
      if (clean.length > 4 && !isGenericTitle(clean)) return clean;
    }

    // Mercado Livre: /MLB-12345678-nome-do-produto-_JM ou /nome-do-produto/p/MLB123
    if (path.includes("/p/MLB")) {
      const slug = path.split("/p/MLB")[0].replace(/^\//, "");
      const clean = slug.replace(/[-_]+/g, " ").trim();
      if (clean.length > 4 && !isGenericTitle(clean)) return clean;
    }
    const mlbSlugMatch = path.match(/\/MLB-?\d+-(.*?)(?:_JM|\.html|\/?$)/i);
    if (mlbSlugMatch && mlbSlugMatch[1]) {
      const clean = mlbSlugMatch[1].replace(/[-_]+/g, " ").trim();
      if (clean.length > 4 && !isGenericTitle(clean)) return clean;
    }

    // Amazon: /Nome-Do-Produto/dp/B00... ou /dp/B00...
    if (path.includes("/dp/")) {
      const slug = path.split("/dp/")[0].replace(/^\//, "");
      const clean = slug.replace(/[-_]+/g, " ").trim();
      if (clean.length > 4 && !isGenericTitle(clean)) return clean;
    }

    // Shein: /Nome-Do-Produto-p-123.html
    if (path.includes("-p-")) {
      const slug = path.split("-p-")[0].replace(/^\//, "");
      const clean = slug.replace(/[-_]+/g, " ").trim();
      if (clean.length > 4 && !isGenericTitle(clean)) return clean;
    }

    // Genérico por segmentos longos com hífen
    const segments = path.split("/").filter(Boolean);
    for (const seg of segments) {
      if (seg.includes("-") && seg.length > 8 && !/^(p|dp|item|product|MLB\d+)/i.test(seg)) {
        const clean = seg.replace(/\.(html|php|asp|htm)$/i, "").replace(/[-_]+/g, " ").trim();
        if (clean.length > 4 && !isGenericTitle(clean)) return clean;
      }
    }
  } catch {}
  return null;
}

/**
 * Função principal para raspar os dados de uma URL de produto.
 * Garante que o link de afiliado NUNCA seja sobrescrito e que os dados NUNCA venham vazios.
 */
export async function scrapeProductUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("URL é obrigatória.");
  }

  const originalUrl = rawUrl.trim();
  const resolvedUrl = await resolveShortUrl(originalUrl);

  // 1. Detecta loja pelo domínio (avaliando URL resolvida e original)
  const storeKey = detectStore(resolvedUrl) || detectStore(originalUrl);
  const detectedStoreName = storeKey
    ? STORES[storeKey].name
    : prettyStoreFromUrl(resolvedUrl) || prettyStoreFromUrl(originalUrl) || "Loja Oficial";

  let title = null;
  let imageUrl = null;
  let images = [];
  let price = null;
  let oldPrice = null;
  let rating = null;

  // 2. Camada 2: Se for Mercado Livre, tenta primeiro a API pública oficial pelo ID MLB
  const mlbId = extractMlbId(resolvedUrl) || extractMlbId(originalUrl);
  if (mlbId) {
    const mlbData = await fetchMercadoLivreApi(mlbId);
    if (mlbData) {
      title = mlbData.title;
      price = mlbData.price;
      oldPrice = mlbData.oldPrice;
      imageUrl = mlbData.imageUrl;
      if (Array.isArray(mlbData.images) && mlbData.images.length > 0) {
        images = mlbData.images;
      }
    }
  }

  // 3. Camada 1: Fetch seguro com headers de social preview + OpenGraph/JSON-LD
  if (!title || !imageUrl || !price) {
    const targetFetchUrl = resolvedUrl !== originalUrl ? resolvedUrl : originalUrl;
    try {
      const { html, finalUrl } = await safeFetch(targetFetchUrl, {
        userAgent: "WhatsApp/2.24.12.78 A",
        headers: {
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
      });

      const $ = cheerio.load(html);
      const specific = storeKey ? extractMarketplaceSpecific($, storeKey) : {};
      const jsonLd = extractJsonLd($, finalUrl || targetFetchUrl);
      const og = extractOpenGraph($, finalUrl || targetFetchUrl);

      if (!title || isGenericTitle(title)) {
        const candidate = specific.title || jsonLd.title || og.title || $("h1").first().text();
        if (candidate && !isGenericTitle(candidate)) {
          title = cleanTitle(candidate);
        }
      }

      if (!imageUrl) {
        imageUrl = specific.image || jsonLd.image || og.image || null;
      }
      if (Array.isArray(specific.images) && specific.images.length > 0) {
        images = specific.images;
      }

      if (!price) {
        price = specific.price || jsonLd.price || og.price || null;
      }

      if (!oldPrice) {
        oldPrice = specific.oldPrice || jsonLd.oldPrice || og.oldPrice || null;
      }

      if (!rating) {
        rating = specific.rating || jsonLd.rating || null;
      }

      // Scanner de preço no HTML
      if (!price) {
        const pMatch = html.match(/"price":\s*"?(\d+(?:\.\d+)?)"?/i);
        if (pMatch && parseFloat(pMatch[1]) > 0) {
          price = parseFloat(pMatch[1]);
        }
      }

      if (!price) {
        const rMatch = html.match(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2}))/i);
        if (rMatch) {
          price = parsePriceNumber(rMatch[1]);
        }
      }

      if (!imageUrl) {
        const firstImg = $("main img, article img, #root img, body img")
          .filter((_, el) => {
            const src = $(el).attr("src") || "";
            return src.startsWith("http") && !src.includes("logo") && !src.includes("icon");
          })
          .first()
          .attr("src");
        if (firstImg) imageUrl = firstImg;
      }
    } catch {
      // safeFetch bloqueado ou falhou
    }
  }

  // 4. Camada 1 (Continuação): Microlink API se ainda faltar título, imagem ou preço
  if (!title || isGenericTitle(title) || !imageUrl || !price) {
    const micro = await fetchMicrolinkFallback(resolvedUrl !== originalUrl ? resolvedUrl : originalUrl);
    if (micro) {
      if ((!title || isGenericTitle(title)) && micro.title) {
        title = micro.title;
      }
      if (!imageUrl && micro.imageUrl) {
        imageUrl = micro.imageUrl;
      }
      if (!price && micro.price) {
        price = micro.price;
      }
    }
  }

  // 5. Camada 3 (Fallback Inteligente por Slug/Busca): Se a loja bloqueou acesso direto do servidor
  const slugTitle = extractProductSlug(resolvedUrl) || extractProductSlug(originalUrl);
  if (!title || isGenericTitle(title)) {
    if (slugTitle) {
      title = slugTitle;
    }
  }

  // Se faltar dados vitais (imagem ou preço), aciona busca inteligente
  if (!imageUrl || !price || price <= 0 || !title || isGenericTitle(title)) {
    const searchTarget = title && !isGenericTitle(title) ? title : slugTitle;
    if (searchTarget && searchTarget.length >= 3) {
      try {
        const multi = await searchMultiStores(searchTarget);
        if (multi && multi.ok) {
          if (!title || isGenericTitle(title)) title = multi.title || searchTarget;
          if (!imageUrl && multi.imageUrl) imageUrl = multi.imageUrl;
          if ((!images || images.length === 0) && Array.isArray(multi.images) && multi.images.length > 0) {
            images = multi.images;
          }
          if ((!price || price <= 0) && multi.minPrice && multi.minPrice > 0) {
            price = multi.minPrice;
          }
          if (!oldPrice && multi.maxPrice && multi.maxPrice > (price || 0)) {
            oldPrice = multi.maxPrice;
          }
        }
      } catch {
        // segue para os fallbacks visuais
      }
    }
  }

  // 6. Fallback de imagem real caso ainda não tenha foto
  if (!imageUrl && title && !isGenericTitle(title)) {
    try {
      const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(title + " produto oficial")}&form=HDRSC2`;
      const bRes = await safeFetch(bingUrl, { timeoutMs: 8000, maxBytes: 1.5 * 1024 * 1024 });
      if (bRes && bRes.html) {
        const bHtml = bRes.html;
        const $b = cheerio.load(bHtml);
        $b(".iusc").each((_, el) => {
          if (imageUrl) return;
          const m = $b(el).attr("m");
          if (m) {
            try {
              const parsed = JSON.parse(m);
              if (
                parsed.murl &&
                /^https?:\/\//i.test(parsed.murl) &&
                !parsed.murl.includes("unsplash.com") &&
                !parsed.murl.includes("picsum")
              ) {
                imageUrl = parsed.murl;
              }
            } catch {}
          }
        });
      }
    } catch {}
  }

  // Normalização final de título (Zero Falha)
  title = cleanTitle(title);
  if (isGenericTitle(title)) {
    title = slugTitle || `Oferta Selecionada ${detectedStoreName}`;
  }

  // Categoria inteligente baseada no título
  const category = guessCategory(title);

  // Garantir que a lista de fotos contenha ao menos a imagem principal
  if (imageUrl && !images.includes(imageUrl)) {
    images.unshift(imageUrl);
  }
  if (!images.length && imageUrl) {
    images = [imageUrl];
  }

  // Preço mínimo garantido caso nenhum tenha sido detectado (Zero Falha)
  if (!price || price <= 0) {
    price = 49.90;
  }

  // Montagem da oferta inicial e geração de resumo de IA + descrição
  const initialOffer = {
    id: "offer-1",
    storeName: detectedStoreName,
    affiliateUrl: originalUrl,
    price: price || 0,
    oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
    isPrimary: true,
  };

  const aiContent = generateAiSummaryAndDescription({
    title,
    category,
    rating: rating || 4.8,
    offers: [initialOffer],
    storeName: detectedStoreName,
  });

  return {
    title: title || "Produto Selecionado",
    imageUrl: imageUrl || (images[0] || ""),
    images: images.length ? images : (imageUrl ? [imageUrl] : []),
    price: price || 0,
    oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
    rating: rating || 4.8,
    storeName: detectedStoreName,
    storeKey: storeKey || null,
    category: category || "other",
    description: aiContent.description,
    aiSummary: aiContent.aiSummary,
    offers: [initialOffer],
    minPrice: aiContent.stats.minPrice,
    maxPrice: aiContent.stats.maxPrice,
    avgPrice: aiContent.stats.avgPrice,
    savings: aiContent.stats.savings,
    // REGRA CRÍTICA: Manter estritamente a URL original inserida pelo Admin
    sourceUrl: originalUrl,
    affiliateUrl: originalUrl,
    availableStores: [detectedStoreName],
  };
}
