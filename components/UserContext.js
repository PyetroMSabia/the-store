"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const UserContext = createContext({
  user: null,
  loading: true,
  favoriteIds: [],
  cartCount: 0,
  isFavorite: () => false,
  toggleFavorite: async () => {},
  addToCart: async () => {},
  refresh: async () => {},
  logout: async () => {},
});

export function UserProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setFavoriteIds(data.favoriteIds || []);
        setCartCount(data.cartCount || 0);
      } else {
        setUser(null);
        setFavoriteIds([]);
        setCartCount(0);
      }
    } catch {
      // offline / erro de rede
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isFavorite = useCallback(
    (productId) => favoriteIds.includes(productId),
    [favoriteIds]
  );

  const toggleFavorite = useCallback(
    async (productId) => {
      if (!user) {
        router.push(`/conta/entrar?next=${encodeURIComponent(window.location.pathname)}`);
        return false;
      }

      const already = favoriteIds.includes(productId);
      // Atualização otimista
      setFavoriteIds((prev) =>
        already ? prev.filter((id) => id !== productId) : [...prev, productId]
      );

      try {
        const res = await fetch(already ? `/api/favorites/${productId}` : "/api/favorites", {
          method: already ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: already ? undefined : JSON.stringify({ productId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ids) setFavoriteIds(data.ids);
          return true;
        }
      } catch {
        // Reverte em caso de erro
        refresh();
      }
      return false;
    },
    [user, favoriteIds, router, refresh]
  );

  const addToCart = useCallback(
    async (productId, quantity = 1) => {
      if (!user) {
        router.push(`/conta/entrar?next=${encodeURIComponent(window.location.pathname)}`);
        return false;
      }

      // Otimista
      setCartCount((c) => c + quantity);

      try {
        const res = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, quantity }),
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.count === "number") setCartCount(data.count);
          return true;
        }
      } catch {
        refresh();
      }
      return false;
    },
    [user, router, refresh]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // fallback
    }
    setUser(null);
    setFavoriteIds([]);
    setCartCount(0);
    router.push("/");
    router.refresh();
  }, [router]);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        favoriteIds,
        cartCount,
        isFavorite,
        toggleFavorite,
        addToCart,
        refresh,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
