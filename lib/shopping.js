import "server-only";
import { getDb } from "./db.js";
import { mapProduct } from "./products.js";
import { supabase } from "./supabase.js";

/** Favoritos e carrinho dos usuários logados conectados ao Supabase. */

const PRODUCT_COLS = `p.id, p.title, p.price, p.old_price, p.rating, p.image_url, p.affiliate_url, p.source_url,
  p.store_name, p.category, p.description, p.click_count, p.available_stores, p.offers, p.images, p.ai_summary, p.created_at, p.updated_at`;

/* ---------- Favoritos ---------- */

export async function getFavoriteIds(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map((r) => r.product_id);
    }
  } catch (err) {
    console.warn("[the-store] Falha ao consultar favoritos no Supabase:", err.message);
  }
  return getDb()
    .prepare("SELECT product_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId)
    .map((r) => r.product_id);
}

export async function listFavorites(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from("favorites")
      .select("product_id, products(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map((r) => mapProduct(r.products)).filter(Boolean);
    }
  } catch (err) {
    console.warn("[the-store] Falha ao listar favoritos no Supabase:", err.message);
  }
  return getDb()
    .prepare(
      `SELECT ${PRODUCT_COLS} FROM favorites f JOIN products p ON p.id = f.product_id
        WHERE f.user_id = ? ORDER BY f.created_at DESC`
    )
    .all(userId)
    .map(mapProduct);
}

export async function addFavorite(userId, productId) {
  if (!userId || !productId) return;
  try {
    await supabase.from("favorites").upsert({ user_id: userId, product_id: productId });
  } catch (err) {
    console.warn("[the-store] Falha ao salvar favorito no Supabase:", err.message);
  }
  getDb().prepare("INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)").run(userId, productId);
}

export async function removeFavorite(userId, productId) {
  if (!userId || !productId) return;
  try {
    await supabase.from("favorites").delete().match({ user_id: userId, product_id: productId });
  } catch (err) {
    console.warn("[the-store] Falha ao remover favorito no Supabase:", err.message);
  }
  getDb().prepare("DELETE FROM favorites WHERE user_id = ? AND product_id = ?").run(userId, productId);
}

/* ---------- Carrinho ---------- */

export const MAX_QTY = 99;

export async function getCartCount(userId) {
  if (!userId) return 0;
  try {
    const { data, error } = await supabase.from("cart_items").select("quantity").eq("user_id", userId);
    if (!error && Array.isArray(data)) {
      return data.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }
  } catch (err) {
    console.warn("[the-store] Falha ao consultar total do carrinho no Supabase:", err.message);
  }
  return getDb().prepare("SELECT COALESCE(SUM(quantity), 0) AS n FROM cart_items WHERE user_id = ?").get(userId).n;
}

export async function getCart(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from("cart_items")
      .select("quantity, products(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error && Array.isArray(data)) {
      return data
        .map((r) => {
          const prodData = Array.isArray(r.products) ? r.products[0] : r.products;
          return { product: mapProduct(prodData), quantity: r.quantity };
        })
        .filter((it) => !!it.product);
    }
  } catch (err) {
    console.warn("[the-store] Falha ao listar carrinho no Supabase:", err.message);
  }
  return getDb()
    .prepare(
      `SELECT ${PRODUCT_COLS}, c.quantity FROM cart_items c JOIN products p ON p.id = c.product_id
        WHERE c.user_id = ? ORDER BY c.created_at DESC`
    )
    .all(userId)
    .map((r) => ({ product: mapProduct(r), quantity: r.quantity }));
}

export async function addToCart(userId, productId, quantity = 1) {
  const q = Math.max(1, Math.min(MAX_QTY, Math.trunc(quantity) || 1));

  // Supabase
  try {
    const { data: existing } = await supabase
      .from("cart_items")
      .select("quantity")
      .match({ user_id: userId, product_id: productId })
      .maybeSingle();

    if (existing) {
      const newQty = Math.min(MAX_QTY, (existing.quantity || 0) + q);
      await supabase.from("cart_items").update({ quantity: newQty }).match({ user_id: userId, product_id: productId });
    } else {
      await supabase.from("cart_items").insert({ user_id: userId, product_id: productId, quantity: q });
    }
  } catch (err) {
    console.warn("[the-store] Falha ao adicionar ao carrinho no Supabase:", err.message);
  }

  // SQLite local
  getDb()
    .prepare(
      `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
       ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = MIN(${MAX_QTY}, quantity + excluded.quantity)`
    )
    .run(userId, productId, q);
}

export async function setCartQuantity(userId, productId, quantity) {
  const q = Math.trunc(Number(quantity));
  if (!(q >= 1)) return removeFromCart(userId, productId);
  const finalQty = Math.min(MAX_QTY, q);

  // Supabase
  try {
    await supabase.from("cart_items").update({ quantity: finalQty }).match({ user_id: userId, product_id: productId });
  } catch (err) {
    console.warn("[the-store] Falha ao atualizar quantidade do carrinho no Supabase:", err.message);
  }

  // SQLite
  getDb()
    .prepare("UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?")
    .run(finalQty, userId, productId);
}

export async function removeFromCart(userId, productId) {
  try {
    await supabase.from("cart_items").delete().match({ user_id: userId, product_id: productId });
  } catch (err) {
    console.warn("[the-store] Falha ao remover item do carrinho no Supabase:", err.message);
  }
  getDb().prepare("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?").run(userId, productId);
}

export async function clearCart(userId) {
  try {
    await supabase.from("cart_items").delete().eq("user_id", userId);
  } catch (err) {
    console.warn("[the-store] Falha ao limpar carrinho no Supabase:", err.message);
  }
  getDb().prepare("DELETE FROM cart_items WHERE user_id = ?").run(userId);
}

export async function filterCartByStore(userId, storeName) {
  try {
    const { data: nonStoreProducts } = await supabase
      .from("products")
      .select("id")
      .neq("store_name", storeName);
    if (nonStoreProducts && nonStoreProducts.length > 0) {
      const idsToRemove = nonStoreProducts.map((p) => p.id);
      await supabase.from("cart_items").delete().eq("user_id", userId).in("product_id", idsToRemove);
    }
  } catch (err) {
    console.warn("[the-store] Falha ao filtrar carrinho no Supabase:", err.message);
  }

  getDb()
    .prepare(
      `DELETE FROM cart_items
        WHERE user_id = ?
          AND product_id IN (
            SELECT id FROM products WHERE store_name != ?
          )`
    )
    .run(userId, storeName);
}

