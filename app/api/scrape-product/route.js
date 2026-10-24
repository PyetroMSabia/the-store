import { apiAdmin } from "@/lib/session";
import { scrapeProductUrl } from "@/lib/scraper";
import { readJson, jsonError } from "@/lib/http";
import { validateScrapeUrl } from "@/lib/net";
import { sanitizeText, isSafeHttpUrl } from "@/lib/validation";

export async function POST(request) {
  // Controle estrito de acesso: apenas ADMIN autenticado
  const gate = await apiAdmin();
  if (gate.response) return gate.response;

  const body = await readJson(request);
  if (!body || !body.url) {
    return jsonError("Informe a URL do produto.");
  }

  const rawUrl = String(body.url).trim();
  try {
    validateScrapeUrl(rawUrl);
  } catch (err) {
    return jsonError(err.message || "URL bloqueada por política de segurança SSRF.");
  }

  try {
    const scraped = await scrapeProductUrl(rawUrl);

    // Sanitização de segurança de dados extraídos de sites terceiros (anti-XSS)
    const sanitizedData = {
      ...scraped,
      title: scraped.title ? sanitizeText(scraped.title).slice(0, 300) : "",
      description: scraped.description ? sanitizeText(scraped.description).slice(0, 5000) : "",
      imageUrl: scraped.imageUrl && isSafeHttpUrl(scraped.imageUrl) ? scraped.imageUrl : null,
      images: Array.isArray(scraped.images) ? scraped.images.filter((img) => isSafeHttpUrl(img)) : [],
    };

    return Response.json({
      ok: true,
      data: sanitizedData,
    });
  } catch (err) {
    console.error("[the-store] Falha no scrape:", err);
    return jsonError(
      `Não foi possível extrair automaticamente os dados desta página: ${err.message}. Você ainda pode preencher os campos manualmente.`,
      422
    );
  }
}
