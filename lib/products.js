import "server-only";
import crypto from "node:crypto";
import { getDb } from "./db.js";
import { CATEGORIES } from "./catalog.js";
import { isSafeHttpUrl, sanitizeText } from "./validation.js";
import { supabase } from "./supabase.js";

/** Repositório de produtos — a vitrine exibe EXCLUSIVAMENTE o que está nesta tabela. */

const COLUMNS = `id, title, price, old_price, rating, image_url, affiliate_url, source_url,
  store_name, category, description, click_count, available_stores, offers, images, ai_summary, created_at, updated_at`;

export function mapProduct(r) {
  if (Array.isArray(r)) r = r[0];
  if (!r) return null;

  // Galeria de imagens
  let images = [];
  if (r.images) {
    try {
      const parsed = JSON.parse(r.images);
      if (Array.isArray(parsed)) {
        images = parsed.filter((img) => typeof img === "string" && isSafeHttpUrl(img));
      }
    } catch {}
  }
  if (!images.length && r.image_url && isSafeHttpUrl(r.image_url)) {
    images = [r.image_url];
  }

  // Ofertas / Links de múltiplas lojas
  let offers = [];
  if (r.offers) {
    try {
      const parsed = JSON.parse(r.offers);
      if (Array.isArray(parsed) && parsed.length > 0) {
        offers = parsed
          .filter((o) => o && isSafeHttpUrl(o.affiliateUrl) && (toNumber(o.price) > 0 || o.price > 0))
          .map((o, idx) => ({
            id: o.id || `offer-${idx + 1}`,
            storeName: sanitizeText(o.storeName || r.store_name || "Loja Oficial").slice(0, 60),
            affiliateUrl: o.affiliateUrl,
            price: Math.round(Number(o.price) * 100) / 100,
            oldPrice: o.oldPrice != null && Number(o.oldPrice) > 0 ? Math.round(Number(o.oldPrice) * 100) / 100 : null,
            isPrimary: !!o.isPrimary,
          }));
      }
    } catch {}
  }

  // COMPATIBILIDADE COM PRODUTOS JÁ CADASTRADOS (REQ. 4):
  // Se não houver array de ofertas, sintetiza Link 1 usando affiliate_url e price existentes
  if (!offers.length && r.affiliate_url) {
    offers = [
      {
        id: "offer-1",
        storeName: r.store_name || "Loja Oficial",
        affiliateUrl: r.affiliate_url,
        price: r.price,
        oldPrice: r.old_price ?? null,
        isPrimary: true,
      },
    ];
  }

  // Métricas calculadas entre os links/lojas
  const prices = offers.map((o) => o.price).filter((p) => typeof p === "number" && p > 0);
  const minPrice = prices.length ? Math.min(...prices) : r.price;
  const maxPrice = prices.length ? Math.max(...prices) : r.price;
  const sumPrice = prices.reduce((acc, p) => acc + p, 0);
  const avgPrice = prices.length ? Math.round((sumPrice / prices.length) * 100) / 100 : r.price;
  const savings = maxPrice > minPrice
    ? Math.round((maxPrice - minPrice) * 100) / 100
    : (r.old_price && r.old_price > r.price ? Math.round((r.old_price - r.price) * 100) / 100 : 0);

  let availableStores = [];
  if (r.available_stores) {
    try {
      const parsed = JSON.parse(r.available_stores);
      if (Array.isArray(parsed)) availableStores = parsed;
    } catch {}
  }
  const offerStores = offers.map((o) => o.storeName).filter(Boolean);
  const combinedStores = Array.from(new Set([...offerStores, ...availableStores]));
  if (!combinedStores.length && r.store_name) {
    combinedStores.push(r.store_name);
  }

  const primaryOffer = offers.find((o) => o.isPrimary) || offers[0];

  return {
    id: r.id,
    title: r.title,
    price: minPrice || r.price,
    oldPrice: r.old_price ?? (maxPrice > minPrice ? maxPrice : null),
    rating: r.rating ?? null,
    imageUrl: images[0] || r.image_url,
    images,
    affiliateUrl: primaryOffer?.affiliateUrl || r.affiliate_url,
    sourceUrl: r.source_url ?? null,
    storeName: primaryOffer?.storeName || r.store_name,
    category: r.category,
    description: r.description || "",
    aiSummary: r.ai_summary || "",
    offers,
    minPrice,
    maxPrice,
    avgPrice,
    savings,
    availableStores: combinedStores,
    clicks: r.click_count ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? null,
  };
}

export async function listProducts({ category } = {}) {
  try {
    let query = supabase.from("products").select("*").order("created_at", { ascending: false });
    if (category) {
      query = query.eq("category", category);
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      return data.map(mapProduct);
    }
  } catch (err) {
    console.warn("[the-store] Falha ao consultar Supabase em listProducts, usando fallback local:", err.message);
  }
  try {
    const db = getDb();
    if (db) {
      const rows = category
        ? db.prepare(`SELECT ${COLUMNS} FROM products WHERE category = ? ORDER BY created_at DESC`).all(category)
        : db.prepare(`SELECT ${COLUMNS} FROM products ORDER BY created_at DESC`).all();
      return rows.map(mapProduct);
    }
  } catch (sqlErr) {
    console.warn("[the-store] Falha ao consultar produtos no SQLite local:", sqlErr.message);
  }
  return [];
}

export async function getProduct(id) {
  if (typeof id !== "string" || id.length > 120) return null;
  try {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (!error && data) {
      return mapProduct(data);
    }
  } catch (err) {
    console.warn("[the-store] Falha ao consultar Supabase em getProduct, usando fallback local:", err.message);
  }
  try {
    const db = getDb();
    if (db) {
      return mapProduct(db.prepare(`SELECT ${COLUMNS} FROM products WHERE id = ?`).get(id));
    }
  } catch (sqlErr) {
    console.warn("[the-store] Falha ao consultar produto no SQLite local:", sqlErr.message);
  }
  return null;
}

export async function productExists(id) {
  if (!id) return false;
  try {
    const { data, error } = await supabase.from("products").select("id").eq("id", String(id)).maybeSingle();
    if (!error && data) return true;
  } catch {}
  try {
    const db = getDb();
    if (db) {
      return !!db.prepare("SELECT 1 FROM products WHERE id = ?").get(String(id));
    }
  } catch {}
  return false;
}

export async function listRelated(product, limit = 4) {
  if (!product) return [];
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("category", product.category)
      .neq("id", product.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && Array.isArray(data)) {
      return data.map(mapProduct);
    }
  } catch (err) {
    console.warn("[the-store] Falha ao consultar Supabase em listRelated:", err.message);
  }
  try {
    const db = getDb();
    if (db) {
      return db
        .prepare(`SELECT ${COLUMNS} FROM products WHERE category = ? AND id <> ? ORDER BY created_at DESC LIMIT ?`)
        .all(product.category, product.id, limit)
        .map(mapProduct);
    }
  } catch {}
  return [];
}

export async function recordClick(id) {
  try {
    const db = getDb();
    if (db) {
      db.prepare("UPDATE products SET click_count = click_count + 1 WHERE id = ?").run(id);
    }
  } catch {}

  try {
    const { data } = await supabase.from("products").select("click_count").eq("id", id).maybeSingle();
    if (data) {
      await supabase.from("products").update({ click_count: (data.click_count || 0) + 1 }).eq("id", id);
    }
  } catch (err) {
    console.warn("[the-store] Falha ao registrar clique no Supabase:", err.message);
  }
}

export async function productStats() {
  try {
    const { data: prods, error } = await supabase.from("products").select("store_name, click_count");
    if (!error && Array.isArray(prods)) {
      const stores = new Set(prods.map((p) => p.store_name).filter(Boolean));
      const clicks = prods.reduce((sum, p) => sum + (p.click_count || 0), 0);
      return {
        products: prods.length,
        stores: stores.size,
        clicks,
      };
    }
  } catch (err) {
    console.warn("[the-store] Falha ao obter stats do Supabase:", err.message);
  }

  try {
    const db = getDb();
    if (db) {
      return {
        products: db.prepare("SELECT COUNT(*) AS n FROM products").get().n,
        stores: db.prepare("SELECT COUNT(DISTINCT store_name) AS n FROM products").get().n,
        clicks: db.prepare("SELECT COALESCE(SUM(click_count), 0) AS n FROM products").get().n,
      };
    }
  } catch {}

  return { products: 0, stores: 0, clicks: 0 };
}

/* ---------- Escrita (somente via rotas protegidas por ADMIN) ---------- */

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)
    .replace(/-$/, "");
}

const toNumber = (v) => {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

/** Valida e normaliza a entrada do painel. Retorna `{ data }` ou `{ error }`. */
export function validateProductInput(input = {}) {
  const title = sanitizeText(input.title || "").trim().replace(/\s+/g, " ");
  let price = toNumber(input.price);
  let oldPrice = toNumber(input.oldPrice);
  const rating = toNumber(input.rating);
  let imageUrl = String(input.imageUrl || "").trim();
  let affiliateUrl = String(input.affiliateUrl || "").trim();
  const sourceUrl = String(input.sourceUrl || "").trim();
  let storeName = sanitizeText(input.storeName || "").trim().slice(0, 60);
  const category = String(input.category || "");
  const description = sanitizeText(input.description || "").trim();
  const aiSummary = sanitizeText(input.aiSummary || input.ai_summary || "").trim();

  // Tratamento da lista de ofertas/links de múltiplas lojas
  let offers = [];
  if (Array.isArray(input.offers)) {
    offers = input.offers
      .filter((o) => o && isSafeHttpUrl(o.affiliateUrl) && (toNumber(o.price) > 0 || o.price > 0))
      .map((o, idx) => {
        const oPrice = Math.round(toNumber(o.price) * 100) / 100;
        const oOld = toNumber(o.oldPrice);
        return {
          id: String(o.id || `offer-${idx + 1}`).slice(0, 50),
          storeName: sanitizeText(o.storeName || "Loja Oficial").trim().slice(0, 60),
          affiliateUrl: String(o.affiliateUrl).trim(),
          price: oPrice,
          oldPrice: oOld && oOld > oPrice ? Math.round(oOld * 100) / 100 : null,
          isPrimary: !!o.isPrimary,
        };
      });
  }

  // Se não informou lista de ofertas mas informou affiliateUrl e price, sintetiza o primeiro link
  if (!offers.length && isSafeHttpUrl(affiliateUrl) && price > 0) {
    offers = [
      {
        id: "offer-1",
        storeName: storeName || "Loja Oficial",
        affiliateUrl,
        price,
        oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
        isPrimary: true,
      },
    ];
  }

  // Se temos ofertas, garante que ao menos uma esteja marcada como principal
  if (offers.length > 0) {
    const hasPrimary = offers.some((o) => o.isPrimary);
    if (!hasPrimary) {
      offers[0].isPrimary = true;
    }
    const primaryOffer = offers.find((o) => o.isPrimary) || offers[0];
    if (!price || price <= 0) price = primaryOffer.price;
    if (!affiliateUrl) affiliateUrl = primaryOffer.affiliateUrl;
    if (!storeName) storeName = primaryOffer.storeName;
  }

  // Tratamento da galeria de imagens
  let images = [];
  if (Array.isArray(input.images)) {
    images = input.images
      .filter((img) => typeof img === "string" && isSafeHttpUrl(img))
      .map((img) => img.trim());
  }
  if (!images.length && imageUrl && isSafeHttpUrl(imageUrl)) {
    images = [imageUrl];
  }
  if (images.length > 0 && !imageUrl) {
    imageUrl = images[0];
  }

  if (title.length < 3) return { error: "Informe o título do produto." };
  if (title.length > 300) return { error: "Título muito longo (máx. 300 caracteres)." };
  if (!(price > 0) || price > 10_000_000) return { error: "Informe um preço válido ou ao menos uma oferta com preço." };
  if (Number.isNaN(oldPrice) || (oldPrice != null && oldPrice <= 0)) return { error: "Preço anterior inválido." };
  if (Number.isNaN(rating) || (rating != null && (rating < 0 || rating > 5))) return { error: "A nota deve estar entre 0 e 5." };
  if (!isSafeHttpUrl(imageUrl)) return { error: "Informe a URL da foto real do produto (http/https seguro)." };
  if (!isSafeHttpUrl(affiliateUrl)) return { error: "Informe um link de afiliado válido (http/https seguro)." };
  if (sourceUrl && !isSafeHttpUrl(sourceUrl)) return { error: "URL de origem inválida." };
  if (!storeName || storeName.length > 60) return { error: "Informe a loja de origem." };
  if (!CATEGORIES[category]) return { error: "Selecione uma categoria válida." };
  if (description.length > 5000) return { error: "Descrição muito longa (máx. 5000 caracteres)." };
  if (aiSummary.length > 5000) return { error: "Resumo muito longo (máx. 5000 caracteres)." };

  let availableStores = [];
  if (Array.isArray(input.availableStores)) {
    availableStores = input.availableStores
      .filter((s) => typeof s === "string" && s.trim())
      .map((s) => sanitizeText(s).slice(0, 60));
  }
  const offerStores = offers.map((o) => o.storeName).filter(Boolean);
  const combinedStores = Array.from(new Set([...offerStores, ...availableStores]));
  if (!combinedStores.length && storeName) {
    combinedStores.push(storeName);
  }

  return {
    data: {
      title,
      price: Math.round(price * 100) / 100,
      oldPrice: oldPrice != null && oldPrice > price ? Math.round(oldPrice * 100) / 100 : null,
      rating: rating != null ? Math.round(rating * 10) / 10 : null,
      imageUrl,
      images,
      affiliateUrl,
      sourceUrl: sourceUrl || null,
      storeName,
      category,
      description: description || null,
      aiSummary: aiSummary || null,
      availableStores: combinedStores,
      offers,
    },
  };
}

export async function createProduct(data) {
  const id = `${slugify(data.title) || "produto"}-${crypto.randomBytes(3).toString("hex")}`;
  const storesJson = JSON.stringify(data.availableStores?.length ? data.availableStores : [data.storeName]);
  const offersJson = JSON.stringify(data.offers?.length ? data.offers : []);
  const imagesJson = JSON.stringify(data.images?.length ? data.images : [data.imageUrl]);

  // Grava no Supabase
  try {
    const { error } = await supabase.from("products").insert({
      id,
      title: data.title,
      price: data.price,
      old_price: data.oldPrice,
      rating: data.rating,
      image_url: data.imageUrl,
      affiliate_url: data.affiliateUrl,
      source_url: data.sourceUrl,
      store_name: data.storeName,
      category: data.category,
      description: data.description,
      available_stores: storesJson,
      offers: offersJson,
      images: imagesJson,
      ai_summary: data.aiSummary || null,
    });
    if (error) {
      console.error("[the-store] Erro ao inserir produto no Supabase:", error.message);
    }
  } catch (err) {
    console.error("[the-store] Exceção ao inserir produto no Supabase:", err);
  }

  // Grava no SQLite local como cache/fallback
  try {
    const db = getDb();
    if (db) {
      db.prepare(
        `INSERT INTO products (id, title, price, old_price, rating, image_url, affiliate_url, source_url,
                               store_name, category, description, available_stores, offers, images, ai_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id, data.title, data.price, data.oldPrice, data.rating, data.imageUrl, data.affiliateUrl,
        data.sourceUrl, data.storeName, data.category, data.description, storesJson,
        offersJson, imagesJson, data.aiSummary || null
      );
    }
  } catch (err) {
    console.warn("[the-store] Aviso ao gravar produto no SQLite local:", err.message);
  }

  return getProduct(id);
}

export async function updateProduct(id, data) {
  const storesJson = JSON.stringify(data.availableStores?.length ? data.availableStores : [data.storeName]);
  const offersJson = JSON.stringify(data.offers?.length ? data.offers : []);
  const imagesJson = JSON.stringify(data.images?.length ? data.images : [data.imageUrl]);

  // Atualiza no Supabase
  try {
    const { error } = await supabase.from("products").update({
      title: data.title,
      price: data.price,
      old_price: data.oldPrice,
      rating: data.rating,
      image_url: data.imageUrl,
      affiliate_url: data.affiliateUrl,
      source_url: data.sourceUrl,
      store_name: data.storeName,
      category: data.category,
      description: data.description,
      available_stores: storesJson,
      offers: offersJson,
      images: imagesJson,
      ai_summary: data.aiSummary || null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) {
      console.error("[the-store] Erro ao atualizar produto no Supabase:", error.message);
    }
  } catch (err) {
    console.error("[the-store] Exceção ao atualizar produto no Supabase:", err);
  }

  // Atualiza no SQLite local
  try {
    const db = getDb();
    if (db) {
      db.prepare(
        `UPDATE products SET title = ?, price = ?, old_price = ?, rating = ?, image_url = ?, affiliate_url = ?,
                source_url = ?, store_name = ?, category = ?, description = ?, available_stores = ?,
                offers = ?, images = ?, ai_summary = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ?`
      ).run(
        data.title, data.price, data.oldPrice, data.rating, data.imageUrl, data.affiliateUrl,
        data.sourceUrl, data.storeName, data.category, data.description, storesJson,
        offersJson, imagesJson, data.aiSummary || null, id
      );
    }
  } catch (err) {
    console.warn("[the-store] Aviso ao atualizar produto no SQLite local:", err.message);
  }

  return getProduct(id);
}

export async function deleteProduct(id) {
  let deletedInSupabase = false;
  // Deleta no Supabase
  try {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) {
      deletedInSupabase = true;
    } else {
      console.error("[the-store] Erro ao deletar produto no Supabase:", error.message);
    }
  } catch (err) {
    console.error("[the-store] Exceção ao deletar produto no Supabase:", err);
  }

  try {
    const db = getDb();
    if (db) {
      const localRes = db.prepare("DELETE FROM products WHERE id = ?").run(id);
      return localRes.changes > 0 || deletedInSupabase;
    }
  } catch (err) {
    console.warn("[the-store] Aviso ao deletar produto no SQLite local:", err.message);
  }

  return deletedInSupabase;
}
