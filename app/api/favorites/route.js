import { apiUser } from "@/lib/session";
import { listFavorites, addFavorite, getFavoriteIds } from "@/lib/shopping";
import { productExists } from "@/lib/products";
import { readJson, jsonError } from "@/lib/http";

export async function GET() {
  const gate = await apiUser();
  if (gate.response) return gate.response;

  const items = await listFavorites(gate.user.id);
  const ids = await getFavoriteIds(gate.user.id);

  return Response.json({ items, ids });
}

export async function POST(request) {
  const gate = await apiUser();
  if (gate.response) return gate.response;

  const body = await readJson(request);
  if (!body?.productId) return jsonError("ID do produto é obrigatório.");

  if (!(await productExists(body.productId))) {
    return jsonError("Produto não encontrado.", 404);
  }

  await addFavorite(gate.user.id, body.productId);
  const ids = await getFavoriteIds(gate.user.id);

  return Response.json({ ok: true, ids, message: "Produto salvo nos favoritos!" });
}
