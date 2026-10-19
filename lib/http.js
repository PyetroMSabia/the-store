import "server-only";

/** Utilitários HTTP para Route Handlers. */

export async function readJson(request, maxBytes = 64 * 1024) {
  const text = await request.text().catch(() => "");
  if (text.length > maxBytes) return null;
  try {
    const data = JSON.parse(text || "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export const jsonError = (error, status = 400, extra = {}) => Response.json({ error, ...extra }, { status });

export function clientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local"
  );
}

/**
 * Rate limit em memória (janela deslizante). Suficiente para uma instância única;
 * em produção multi-instância, troque por Redis/Upstash mantendo a assinatura.
 */
const buckets = (globalThis.__theStoreRate ||= new Map());

export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return { ok: true };
}

export const tooMany = (retryAfter) =>
  Response.json(
    { error: `Muitas tentativas. Tente novamente em ${Math.ceil(retryAfter / 60)} min.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );

export function appOrigin(request) {
  if (request?.headers) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || "https";
    if (host && !host.includes("localhost")) {
      return `${proto}://${host}`;
    }
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured && (process.env.NODE_ENV !== "production" || !configured.includes("localhost"))) {
    return configured;
  }

  return request ? new URL(request.url).origin : "http://localhost:3000";
}
