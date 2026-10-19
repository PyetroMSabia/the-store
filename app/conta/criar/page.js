"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/components/UserContext";
import { passwordStrength } from "@/lib/validation";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { refresh } = useUser();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = passwordStrength(password);
  const strengthLabels = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];
  const strengthColors = ["#ef6a5b", "#ef6a5b", "#f2c14e", "#f2c14e", "#3ecf8e"];

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem. Digite a mesma senha nos dois campos.");
      return;
    }

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
      setError("A senha deve conter letras e números.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar conta.");
        setLoading(false);
        return;
      }

      // Atualiza o contexto do usuário (Sidebar e avatar do topo sincronizados)
      await refresh();
      // Redireciona o usuário recém-cadastrado diretamente para a página inicial
      router.push("/");
      router.refresh();
    } catch {
      setError("Erro de conexão ao tentar cadastrar.");
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card reveal">
        <Link href="/" aria-label="Ir para a página inicial">
          <img src="/logo.jpg" alt="The Store" />
        </Link>
        <h1>Crie sua conta</h1>
        <p className="muted">Tenha sua lista de favoritos e seu carrinho unificado das maiores lojas.</p>

        {error && <div className="auth-alert error">{error}</div>}

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="field">
            <label htmlFor="reg-name">Nome completo</label>
            <input
              id="reg-name"
              className="input"
              type="text"
              autoComplete="off"
              placeholder="Ex: Maria Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="reg-email">Seu e-mail</label>
            <input
              id="reg-email"
              className="input"
              type="email"
              autoComplete="off"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="reg-password">Criar senha</label>
            <input
              id="reg-password"
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {password && (
              <div style={{ marginTop: 6 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    height: 4,
                    borderRadius: 2,
                    overflow: "hidden",
                    background: "var(--surface-3)",
                  }}
                >
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      style={{
                        flex: 1,
                        background: strength >= step ? strengthColors[strength] : "transparent",
                        transition: "background 0.3s",
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--muted)",
                    marginTop: 4,
                  }}
                >
                  <span>
                    Força: <b style={{ color: strengthColors[strength] }}>{strengthLabels[strength]}</b>
                  </span>
                  <span>Mínimo 8 caracteres com letras e números</span>
                </div>
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="reg-confirm-password">Confirmar senha</label>
            <input
              id="reg-confirm-password"
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-gold"
            id="register-submit"
            disabled={loading || !name || !email || !password || !confirmPassword}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading ? "Criando sua conta…" : "Criar minha conta"}
          </button>
        </form>

        <div style={{ marginTop: 22, fontSize: 13, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <span className="muted">Já tem uma conta? </span>
          <Link
            href={`/conta/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="gold-text"
            style={{ fontWeight: 600 }}
          >
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CriarContaPage() {
  return (
    <Suspense fallback={<div className="login-wrap" />}>
      <RegisterForm />
    </Suspense>
  );
}
