import { listProducts, createProduct, validateProductInput } from "@/lib/products";
import { apiAdmin } from "@/lib/session";
import { readJson, jsonError } from "@/lib/http";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("cat") || undefined;
  const products = await listProducts({ category });
  return Response.json(products);
}

export async function POST(request) {
  // Controle estrito de acesso: apenas ADMIN autenticado
  const gate = await apiAdmin();
  if (gate.response) return gate.response;

  const body = await readJson(request);
  if (!body) return jsonError("Dados inválidos.");

  const { data, error } = validateProductInput(body);
  if (error) return jsonError(error);

  const product = await createProduct(data);
  return Response.json(product, { status: 201 });
}
