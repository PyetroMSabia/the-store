"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useNav } from "./NavContext";
import { useUser } from "./UserContext";
import { MenuIcon, SearchIcon, UserIcon, HeartIcon, CartIcon } from "./Icons";

const TOP_TABS = [
  { key: "novidades", label: "Novidades" },
  { key: "clothing", label: "Roupas" },
  { key: "accessories", label: "Acessórios" },
  { key: "electronics", label: "Eletrônicos" },
  { key: "furniture", label: "Casa & Móveis" },
  { key: "beauty", label: "Beleza" },
  { key: "ofertas", label: "Ofertas", sale: true },
];

export default function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { setOpen } = useNav();
  const { user, favoriteIds, cartCount } = useUser();
  const currentCat = pathname === "/" ? params.get("cat") : null;
  const [q, setQ] = useState(params.get("q") || "");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => setQ(params.get("q") || ""), [params]);

  function onSubmit(e) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/?q=${encodeURIComponent(term)}#catalogo` : "/#catalogo");
  }

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" id="menu-toggle" aria-label="Abrir menu" onClick={() => setOpen(true)}>
        <MenuIcon />
      </button>

      <nav className="top-tabs" aria-label="Categorias">
        {TOP_TABS.map((t) => (
          <Link
            key={t.key}
            id={`tab-${t.key}`}
            href={`/?cat=${t.key}#catalogo`}
            className={`top-tab ${t.sale ? "sale" : ""} ${currentCat === t.key ? "active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <form className="search" role="search" onSubmit={onSubmit}>
        <SearchIcon />
        <label htmlFor="search-input" className="sr-only">Buscar produtos</label>
        <input
          id="search-input"
          type="search"
          placeholder="Buscar produto, loja ou categoria…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>

      <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Favoritos */}
        <Link
          href="/favoritos"
          className="icon-btn"
          id="favorites-btn"
          aria-label={`Meus Favoritos (${mounted ? favoriteIds.length : 0})`}
          title="Meus Favoritos"
          style={{ position: "relative" }}
        >
          <HeartIcon filled={mounted && favoriteIds.length > 0} width={18} height={18} />
          {mounted && favoriteIds.length > 0 && (
            <span className="badge-count" id="fav-count">
              {favoriteIds.length}
            </span>
          )}
        </Link>

        {/* Carrinho */}
        <Link
          href="/carrinho"
          className="icon-btn"
          id="cart-btn"
          aria-label={`Meu Carrinho (${mounted ? cartCount : 0})`}
          title="Meu Carrinho"
          style={{ position: "relative" }}
        >
          <CartIcon width={18} height={18} />
          {mounted && cartCount > 0 && (
            <span className="badge-count" id="cart-count">
              {cartCount}
            </span>
          )}
        </Link>

        {/* Minha Conta / Admin */}
        <Link
          href={mounted && user ? "/conta" : "/conta/entrar"}
          className={`icon-btn ${mounted && user ? "user-active" : ""}`}
          id="account-btn"
          aria-label="Minha conta"
          title={mounted && user ? `${user.name} (${user.role})` : "Minha Conta / Entrar"}
        >
          {mounted && user ? (
            user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <span className="user-initial">{user.name.charAt(0).toUpperCase()}</span>
            )
          ) : (
            <UserIcon />
          )}
        </Link>
      </div>
    </header>
  );
}
