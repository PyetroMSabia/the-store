import { apiUser } from "@/lib/session";
import { getCart, addToCart, clearCart, getCartCount } from "@/lib/shopping";
import { productExists } from "@/lib/products";
import { readJson, jsonError } from "@/lib/http";

export async function GET() {
  const gate = await apiUser();
  if (gate.response) return gate.response;

  const items = await getCart(gate.user.id);
  const count = await getCartCount(gate.user.id);
  const subtotal = items.reduce((s, item) => s + item.product.price * item.quantity, 0);

  return Response.json({ items, count, subtotal });
}

export async function POST(request) {
  const gate = await apiUser();
  if (gate.response) return gate.response;

  const body = await readJson(request);
  if (!body?.productId) return jsonError("ID do produto é obrigatório.");

  if (!(await productExists(body.productId))) {
    return jsonError("Produto não encontrado.", 404);
  }

  const quantity = body.quantity ? Number(body.quantity) : 1;
  await addToCart(gate.user.id, body.productId, quantity);

  const count = await getCartCount(gate.user.id);
  return Response.json({ ok: true, count, message: "Produto adicionado ao carrinho!" });
}

export async function DELETE() {
  const gate = await apiUser();
  if (gate.response) return gate.response;

  await clearCart(gate.user.id);
  return Response.json({ ok: true, count: 0 });
}
