import { searchMultiStores } from "@/lib/multiStoreSearch";
import { readJson, jsonError, clientIp, rateLimit, tooMany } from "@/lib/http";
import { apiAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request) {
  // Controle estrito de acesso: apenas ADMIN autenticado
  const gate = await apiAdmin();
  if (gate.response) return gate.response;

  const ip = clientIp(request);
  const limit = rateLimit(`search-multi:${ip}`, { limit: 40, windowMs: 15 * 60 * 1000 });
  if (!limit.ok) return tooMany(limit.retryAfter);

  const body = await readJson(request);
  if (!body) return jsonError("Corpo da requisição inválido.");

  const productName = String(body.productName || "").trim();
  if (productName.length < 2) {
    return jsonError("Informe pelo menos 2 caracteres do nome do produto para buscar.");
  }

  try {
    const result = await searchMultiStores(productName);
    return Response.json(result);
  } catch (err) {
    console.error("[POST /api/search-multi-stores] Erro:", err);
    return jsonError(err.message || "Erro ao pesquisar produto nas lojas parceiras.", 500);
  }
}
