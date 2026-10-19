import { apiUser } from "@/lib/session";
import { setCartQuantity, removeFromCart, getCartCount } from "@/lib/shopping";
import { readJson, jsonError } from "@/lib/http";

export async function PATCH(request, { params }) {
  const gate = await apiUser();
  if (gate.response) return gate.response;

  const { id } = await params;
  const body = await readJson(request);
  if (body?.quantity == null) return jsonError("Quantidade obrigatória.");

  await setCartQuantity(gate.user.id, id, body.quantity);
  const count = await getCartCount(gate.user.id);

  return Response.json({ ok: true, count });
}

export async function DELETE(_request, { params }) {
  const gate = await apiUser();
  if (gate.response) return gate.response;

  const { id } = await params;
  await removeFromCart(gate.user.id, id);
  const count = await getCartCount(gate.user.id);

  return Response.json({ ok: true, count, message: "Item removido do carrinho." });
}
