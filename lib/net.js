import "server-only";
import dns from "node:dns/promises";
import net from "node:net";

/**
 * Utilitários de rede com proteção estrita contra SSRF (Server-Side Request Forgery).
 * Garante que requisições de scraper só acessem IPs públicos, portas seguras e protocolos autorizados.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
  "instance-data",
]);

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (link-local / AWS/GCP metadata 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (privada)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (privada)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 100.64.0.0/10 (CGNAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 224.0.0.0/4 (multicast) e 240.0.0.0/4 (reservado)
    if (parts[0] >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:127.") || lower.startsWith("::ffff:10.") || lower.startsWith("::ffff:192.168.")) return true;
    return false;
  }
  return true;
}

export async function assertPublicHostname(hostname) {
  const cleanHost = String(hostname || "").trim().toLowerCase();
  if (!cleanHost || BLOCKED_HOSTNAMES.has(cleanHost) || cleanHost.endsWith(".localhost") || cleanHost.endsWith(".internal") || cleanHost.endsWith(".local")) {
    throw new Error("Hostname proibido ou rede interna bloqueada por política de segurança (SSRF).");
  }

  // Se for um IP direto, checa se é privado
  if (net.isIP(cleanHost)) {
    if (isPrivateIp(cleanHost)) {
      throw new Error("Acesso a endereços IP privados ou de loopback bloqueado por segurança (SSRF).");
    }
    return;
  }

  try {
    const addresses = await dns.lookup(cleanHost, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new Error("Não foi possível resolver o endereço de destino.");
    }
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        throw new Error("Acesso a rede interna bloqueado por segurança (SSRF).");
      }
    }
  } catch (err) {
    if (err.message?.includes("SSRF") || err.message?.includes("bloqueado")) throw err;
    throw new Error(`Falha ao resolver domínio: ${err.message}`);
  }
}

export function validateScrapeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("URL inválida ou ausente.");
  }
  let u;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    throw new Error("URL malformada.");
  }

  // Permite exclusivamente http: e https:, bloqueia file:, ftp:, javascript:, data:
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error(`Protocolo "${u.protocol}" bloqueado. Apenas HTTPS e HTTP são permitidos.`);
  }

  // Rejeita credenciais embutidas na URL
  if (u.username || u.password) {
    throw new Error("URLs com credenciais de autenticação não são permitidas.");
  }

  return u;
}

/**
 * Fetch seguro para web scraping:
 * - Validação estrita do protocolo (apenas HTTP/HTTPS)
 * - Checa resolução DNS contra SSRF em cada salto
 * - Controla redirecionamentos manuais com verificação de segurança
 * - Limite de tamanho máximo de resposta (máx 2MB para proteção de memória)
 * - Timeout estrito de 8 segundos com AbortController
 */
export async function safeFetch(targetUrl, options = {}) {
  const maxRedirects = options.maxRedirects ?? 4;
  const timeoutMs = Math.min(options.timeoutMs ?? 8000, 8000); // Máximo 8 segundos (Pilar 3)
  const maxBytes = Math.min(options.maxBytes ?? 2 * 1024 * 1024, 2 * 1024 * 1024); // Máximo 2MB

  let currentUrl = targetUrl;
  let redirects = 0;

  while (redirects <= maxRedirects) {
    const urlObj = validateScrapeUrl(currentUrl);

    await assertPublicHostname(urlObj.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            options.userAgent ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          ...options.headers,
        },
        redirect: "manual",
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Redirecionamento sem destino informado.");
        const nextUrlObj = new URL(location, currentUrl);

        // Previne redirecionamento para telas de bloqueio/login/verificação
        if (
          nextUrlObj.pathname.includes("/gz/account-verification") ||
          nextUrlObj.pathname.includes("/login") ||
          nextUrlObj.pathname.includes("/signin") ||
          nextUrlObj.pathname.includes("/challenge")
        ) {
          break;
        }
        currentUrl = nextUrlObj.toString();
        redirects++;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Servidor de origem retornou status HTTP ${response.status}`);
      }

      // Lê com limite de bytes em memória
      const reader = response.body.getReader();
      const chunks = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          reader.cancel();
          break;
        }
        chunks.push(value);
      }

      const totalBuffer = Buffer.concat(chunks);
      const text = totalBuffer.toString("utf-8");

      return {
        url: currentUrl,
        finalUrl: currentUrl,
        status: response.status,
        headers: response.headers,
        html: text,
      };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        throw new Error("Tempo limite de 8 segundos esgotado ao acessar a página.");
      }
      throw err;
    }
  }

  throw new Error("Muitos redirecionamentos seguidos ao acessar a URL.");
}
