"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useNav } from "./NavContext";
import { useUser } from "./UserContext";
import {
  GridIcon,
  HelpIcon,
  HomeIcon,
  LayersIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
  HeartIcon,
  CartIcon,
  LogoutIcon,
} from "./Icons";

function resolveNav(pathname, searchParams, currentHash) {
  if (!pathname) return "inicio";
  if (pathname.startsWith("/favoritos")) return "favoritos";
  if (pathname.startsWith("/carrinho")) return "carrinho";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/conta")) return "conta";
  if (pathname.startsWith("/ajuda") || pathname.startsWith("/como-funciona")) return "como-funciona";

  if (pathname === "/") {
    const normHash = (currentHash || "").toLowerCase();
    const cat = searchParams?.get("cat");
    const hasCatFilter = Boolean(cat && cat !== "");

    if (normHash === "#catalogo" || normHash === "#destaques" || hasCatFilter) {
      return "catalogo";
    }
    if (normHash === "#categorias") {
      return "categorias";
    }
    if (normHash === "#como-funciona") {
      return "como-funciona";
    }
    if (normHash === "#hero") {
      return "inicio";
    }
    return "inicio";
  }

  return "";
}

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { open, setOpen } = useNav();
  const { user, favoriteIds, cartCount, logout } = useUser();
  const [mounted, setMounted] = useState(false);
  const [activeNav, setActiveNav] = useState(() => {
    if (typeof window !== "undefined") {
      return resolveNav(pathname, searchParams, window.location.hash);
    }
    return pathname === "/" ? "inicio" : "";
  });

  const isClickingRef = useRef(false);
  const clickTimeoutRef = useRef(null);

  // Sincroniza estado ativo com a rota atual, searchParams e hash
  useEffect(() => {
    setMounted(true);
    const hash = window.location.hash;
    setActiveNav(resolveNav(pathname, searchParams, hash));

    const onHashChange = () => {
      if (!isClickingRef.current) {
        setActiveNav(resolveNav(pathname, searchParams, window.location.hash));
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [pathname, searchParams]);

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  // Handler de clique imediato com rolagem suave
  const handleNavClick = useCallback(
    (key, targetHash, targetPath = "/") =>
      (e) => {
        setActiveNav(key);
        setOpen(false);

        isClickingRef.current = true;
        if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = setTimeout(() => {
          isClickingRef.current = false;
        }, 900);

        if (pathname === targetPath) {
          if (targetHash) {
            const targetId = targetHash.replace("#", "");
            const el = document.getElementById(targetId);
            if (el) {
              e.preventDefault();
              window.history.pushState(null, "", targetHash);
              el.scrollIntoView({ behavior: "smooth" });
            }
          } else if (key === "inicio") {
            e.preventDefault();
            window.history.pushState(null, "", "/");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }
      },
    [pathname, setOpen]
  );

  // IntersectionObserver nas seções da página inicial
  useEffect(() => {
    if (pathname !== "/") return;

    const sectionIds = ["hero", "categorias", "como-funciona", "catalogo"];
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isClickingRef.current) return;

        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          const topVisibleId = visible[0].target.id;
          if (topVisibleId === "hero") {
            setActiveNav("inicio");
          } else if (topVisibleId === "categorias") {
            setActiveNav("categorias");
          } else if (topVisibleId === "como-funciona") {
            setActiveNav("como-funciona");
          } else if (topVisibleId === "catalogo") {
            setActiveNav("catalogo");
          }
        }
      },
      {
        rootMargin: "-20% 0px -40% 0px",
        threshold: [0.15, 0.4, 0.7],
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, [pathname]);

  return (
    <>
      <aside className={`sidebar ${open ? "open" : ""}`} id="sidebar">
        <Link
          href="/"
          className="sidebar-logo"
          aria-label="The Store — Início"
          onClick={handleNavClick("inicio", "#hero", "/")}
        >
          <img src="/logo.jpg" alt="The Store" />
        </Link>

        <p className="nav-label">Navegar</p>
        <nav className="nav">
          <Link
            href="/"
            id="nav-inicio"
            className={`nav-link ${activeNav === "inicio" ? "active" : ""}`}
            onClick={handleNavClick("inicio", "#hero", "/")}
          >
            <HomeIcon /> Início
          </Link>
          <Link
            href="/#categorias"
            id="nav-categorias"
            className={`nav-link ${activeNav === "categorias" ? "active" : ""}`}
            onClick={handleNavClick("categorias", "#categorias", "/")}
          >
            <LayersIcon /> Categorias
          </Link>
          <Link
            href="/?cat=todos#catalogo"
            id="nav-ver-tudo"
            className={`nav-link ${activeNav === "catalogo" ? "active" : ""}`}
            onClick={handleNavClick("catalogo", "#catalogo", "/")}
          >
            <GridIcon /> Catálogo
          </Link>
          <Link
            href="/#como-funciona"
            id="nav-ajuda"
            className={`nav-link ${activeNav === "como-funciona" ? "active" : ""}`}
            onClick={handleNavClick("como-funciona", "#como-funciona", "/")}
          >
            <HelpIcon /> Como funciona
          </Link>
        </nav>

        <p className="nav-label">Minha Área</p>
        <nav className="nav">
          <Link
            href="/favoritos"
            id="nav-favoritos"
            className={`nav-link ${activeNav === "favoritos" ? "active" : ""}`}
            onClick={() => {
              setActiveNav("favoritos");
              setOpen(false);
            }}
          >
            <HeartIcon filled={mounted && favoriteIds.length > 0} />
            <span>Favoritos</span>
            {mounted && favoriteIds.length > 0 && (
              <span className="nav-badge">{favoriteIds.length}</span>
            )}
          </Link>

          <Link
            href="/carrinho"
            id="nav-carrinho"
            className={`nav-link ${activeNav === "carrinho" ? "active" : ""}`}
            onClick={() => {
              setActiveNav("carrinho");
              setOpen(false);
            }}
          >
            <CartIcon />
            <span>Carrinho</span>
            {mounted && cartCount > 0 && (
              <span className="nav-badge gold">{cartCount}</span>
            )}
          </Link>

          <Link
            href={mounted && user ? "/conta" : "/conta/entrar"}
            id="nav-conta"
            className={`nav-link ${activeNav === "conta" ? "active" : ""}`}
            onClick={() => {
              setActiveNav("conta");
              setOpen(false);
            }}
          >
            <UserIcon /> {mounted && user ? user.name.split(" ")[0] : "Minha Conta"}
          </Link>

          {mounted && user && (
            <button
              type="button"
              className="nav-link"
              onClick={logout}
              id="sidebar-logout"
              style={{ color: "var(--danger)" }}
            >
              <LogoutIcon /> Sair da conta
            </button>
          )}
        </nav>

        {mounted && user?.role === "ADMIN" && (
          <>
            <p className="nav-label">Curadoria</p>
            <nav className="nav">
              <Link
                href="/admin"
                id="nav-admin"
                className={`nav-link ${activeNav === "admin" ? "active" : ""}`}
                onClick={() => {
                  setActiveNav("admin");
                  setOpen(false);
                }}
              >
                <SettingsIcon /> Painel da curadoria
              </Link>
            </nav>
          </>
        )}

        <div className="sidebar-card">
          <span className="seal">
            <ShieldIcon /> Selo The Store
          </span>
          <h4>Curadoria Verificada</h4>
          <p>Seleção diária das melhores ofertas com avaliação comprovada nas maiores lojas.</p>
        </div>
      </aside>
      <div className={`sidebar-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
    </>
  );
}

export default function Sidebar() {
  return (
    <Suspense fallback={<aside className="sidebar" id="sidebar" />}>
      <SidebarInner />
    </Suspense>
  );
}
