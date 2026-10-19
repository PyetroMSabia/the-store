"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/components/UserContext";
import { safeNextPath } from "@/lib/validation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"), "/conta");
  const { refresh } = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Erro ${res.status}: Não foi possível processar o login no servidor.`);
      }

      if (!res.ok) {
        setError(data?.error || `Erro ${res.status} ao entrar.`);
        setLoading(false);
        return;
      }

      await refresh();
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err?.message || "Erro de conexão ao tentar fazer login.");
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card reveal">
        <Link href="/" aria-label="Ir para a página inicial">
          <img src="/logo.jpg" alt="The Store" />
        </Link>
        <h1>Acesse sua conta</h1>
        <p className="muted">Entre para salvar seus favoritos e gerenciar seu carrinho.</p>

        {error && <div className="auth-alert error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Seu e-mail</label>
            <input
              id="login-email"
              className="input"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="login-password">Sua senha</label>
              <Link href="/conta/recuperar" className="gold-text" style={{ fontSize: 12 }}>
                Esqueceu a senha?
              </Link>
            </div>
            <input
              id="login-password"
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-gold"
            id="login-submit"
            disabled={loading || !email || !password}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading ? "Entrando…" : "Entrar na The Store"}
          </button>
        </form>

        <div style={{ marginTop: 22, fontSize: 13, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <span className="muted">Ainda não tem conta? </span>
          <Link href={`/conta/criar${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="gold-text" style={{ fontWeight: 600 }}>
            Criar conta gratuitamente
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-wrap" />}>
      <LoginForm />
    </Suspense>
  );
}
