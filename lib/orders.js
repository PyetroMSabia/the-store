import "server-only";
import crypto from "node:crypto";
import { getDb } from "./db.js";
import { supabase } from "./supabase.js";

function mapOrder(r) {
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    storeName: r.store_name,
    subtotal: r.subtotal,
    shippingAmount: r.shipping_amount,
    totalAmount: r.total_amount,
    status: r.status,
    paymentMethod: r.payment_method,
    trackingCode: r.tracking_code,
    deliveryAddress: typeof r.delivery_address === "string" ? JSON.parse(r.delivery_address) : r.delivery_address,
    items: typeof r.items === "string" ? JSON.parse(r.items) : r.items,
    createdAt: r.created_at,
  };
}

export function generateTrackingCode() {
  const prefix = "BR";
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${ts}-${rand}`;
}

export async function createOrder({
  userId,
  storeName,
  subtotal,
  shippingAmount = 0,
  totalAmount,
  paymentMethod,
  deliveryAddress,
  items,
}) {
  const id = crypto.randomUUID();
  const trackingCode = generateTrackingCode();
  const addrJson = JSON.stringify(deliveryAddress);
  const itemsJson = JSON.stringify(items);

  // Supabase
  try {
    const { error } = await supabase.from("orders").insert({
      id,
      user_id: userId,
      store_name: storeName,
      subtotal,
      shipping_amount: shippingAmount,
      total_amount: totalAmount,
      status: "CONFIRMED",
      payment_method: paymentMethod,
      tracking_code: trackingCode,
      delivery_address: addrJson,
      items: itemsJson,
    });
    if (error) {
      console.error("[the-store] Erro ao gravar pedido no Supabase:", error.message);
    }
  } catch (err) {
    console.error("[the-store] Exceção ao gravar pedido no Supabase:", err);
  }

  // SQLite local
  const db = getDb();
  db.prepare(
    `INSERT INTO orders (
      id, user_id, store_name, subtotal, shipping_amount, total_amount,
      status, payment_method, tracking_code, delivery_address, items
    ) VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    storeName,
    subtotal,
    shippingAmount,
    totalAmount,
    paymentMethod,
    trackingCode,
    addrJson,
    itemsJson
  );

  return getOrderById(id, userId);
}

export async function getOrderById(orderId, userId = null) {
  try {
    let q = supabase.from("orders").select("*").eq("id", orderId);
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q.maybeSingle();
    if (!error && data) return mapOrder(data);
  } catch (err) {
    console.warn("[the-store] Falha ao consultar pedido no Supabase:", err.message);
  }

  const db = getDb();
  let row;
  if (userId) {
    row = db.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").get(orderId, userId);
  } else {
    row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  }
  return mapOrder(row);
}

export async function listUserOrders(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error && Array.isArray(data)) return data.map(mapOrder);
  } catch (err) {
    console.warn("[the-store] Falha ao listar pedidos no Supabase:", err.message);
  }

  const db = getDb();
  const rows = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  return rows.map(mapOrder);
}

