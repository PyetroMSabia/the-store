import { apiUser } from "@/lib/session";
import { removeFavorite, getFavoriteIds } from "@/lib/shopping";

export async function DELETE(_request, { params }) {
  const gate = await apiUser();
  if (gate.response) return gate.response;

  const { id } = await params;
  await removeFavorite(gate.user.id, id);
  const ids = await getFavoriteIds(gate.user.id);

  return Response.json({ ok: true, ids, message: "Produto removido dos favoritos." });
}
