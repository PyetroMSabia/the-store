import { getProduct, updateProduct, deleteProduct, validateProductInput } from "@/lib/products";
import { apiAdmin } from "@/lib/session";
import { readJson, jsonError } from "@/lib/http";

export async function GET(_request, { params }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return jsonError("Produto não encontrado.", 404);
  return Response.json(product);
}

export async function PUT(request, { params }) {
  const gate = await apiAdmin();
  if (gate.response) return gate.response;

  const { id } = await params;
  const existing = await getProduct(id);
  if (!existing) return jsonError("Produto não encontrado.", 404);

  const body = await readJson(request);
  if (!body) return jsonError("Dados inválidos.");

  const { data, error } = validateProductInput(body);
  if (error) return jsonError(error);

  const updated = await updateProduct(id, data);
  return Response.json(updated);
}

export async function DELETE(_request, { params }) {
  const gate = await apiAdmin();
  if (gate.response) return gate.response;

  const { id } = await params;
  const deleted = await deleteProduct(id);
  if (!deleted) return jsonError("Produto não encontrado.", 404);

  return Response.json({ ok: true });
}
