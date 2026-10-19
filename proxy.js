import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session-token";

/**
 * Proxy do Next.js (convenção oficial do Next.js 16 para middleware).
 * Realiza checagem otimista de autorização (RBAC) na borda:
 * - Rotas `/admin` exigem usuário autenticado com role === 'ADMIN'.
 * - Rotas de usuário autenticado (como `/favoritos`, `/carrinho`) exigem login.
 *
 * NOTA DE SEGURANÇA:
 * Toda rota no servidor (Server Components e Route Handlers) também valida a sessão
 * e a role diretamente no banco relacional (ver `lib/session.js`).
 */

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = cookie ? await verifySessionToken(cookie) : null;

  // Proteção da rota do Painel da Curadoria (Admin)
  if (pathname.startsWith("/admin")) {
    if (!payload) {
      const loginUrl = new URL("/conta/entrar", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (payload.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Proteção das rotas de API administrativas (POST/PUT/DELETE em /api/products, /api/scrape-product, /api/search-multi-stores)
  const isApiProductsAdmin = (pathname === "/api/products" || pathname.startsWith("/api/products/")) &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(method);
  const isScrapeAdmin = pathname.startsWith("/api/scrape-product");
  const isSearchMultiAdmin = pathname.startsWith("/api/search-multi-stores");

  if (isApiProductsAdmin || isScrapeAdmin || isSearchMultiAdmin) {
    if (!payload || payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso restrito à curadoria." }, { status: 403 });
    }
  }

  // Redireciona usuários já logados que tentam acessar login ou cadastro
  if (pathname === "/conta/entrar" || pathname === "/conta/cadastro") {
    if (payload) {
      const nextParam = request.nextUrl.searchParams.get("next");
      const target = nextParam && nextParam.startsWith("/") ? nextParam : "/conta";
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  // Redireciona /checkout imediatamente para /carrinho (The Store atua exclusivamente como agregador de ofertas)
  if (pathname.startsWith("/checkout")) {
    return NextResponse.redirect(new URL("/carrinho", request.url));
  }

  // Rotas restritas a usuários logados
  if (pathname.startsWith("/favoritos") || pathname.startsWith("/carrinho")) {
    if (!payload) {
      const loginUrl = new URL("/conta/entrar", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/products/:path*",
    "/api/products",
    "/api/scrape-product",
    "/api/search-multi-stores",
    "/conta/entrar",
    "/conta/cadastro",
    "/favoritos/:path*",
    "/carrinho/:path*",
    "/checkout/:path*",
  ],
};
