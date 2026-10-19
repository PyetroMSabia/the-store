import { getProduct, recordClick } from "@/lib/products";
import { buildAffiliateUrl } from "@/lib/affiliate";
import { isSafeHttpUrl } from "@/lib/validation";

/**
 * GET /go/:id
 * Registra o clique e redireciona para a URL de afiliado oficial do produto cadastrado.
 * Protegido contra Open Redirect e URLs maliciosas.
 */
export async function GET(request, { params }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return Response.redirect(new URL("/", request.url), 302);
  }

  const { searchParams } = new URL(request.url);
  const offerId = searchParams.get("offer");
  const storeParam = searchParams.get("store");

  let targetOffer = null;
  if (Array.isArray(product.offers) && product.offers.length > 0) {
    if (offerId) {
      targetOffer = product.offers.find((o) => o.id === offerId);
    }
    if (!targetOffer && storeParam) {
      targetOffer = product.offers.find((o) => o.storeName?.toLowerCase() === storeParam.toLowerCase());
    }
  }

  const finalUrl = targetOffer?.affiliateUrl || product.affiliateUrl;
  const finalStore = targetOffer?.storeName || product.storeName;

  if (!finalUrl || !isSafeHttpUrl(finalUrl)) {
    return Response.redirect(new URL(`/produto/${product.id}`, request.url), 302);
  }

  try {
    await recordClick(id);
  } catch (err) {
    console.error("[the-store] Erro ao registrar clique:", err);
  }

  const destination = buildAffiliateUrl(finalStore, finalUrl, product.id);

  if (!isSafeHttpUrl(destination)) {
    return Response.redirect(new URL(`/produto/${product.id}`, request.url), 302);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: destination,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
