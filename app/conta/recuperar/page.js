"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao solicitar recuperação.");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Erro ao se comunicar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card reveal">
        <Link href="/" aria-label="Ir para a página inicial">
          <img src="/logo.jpg" alt="The Store" />
        </Link>
        <h1>Recuperar senha</h1>
        <p className="muted">Informe o e-mail cadastrado para enviarmos as instruções de redefinição.</p>

        {error && <div className="auth-alert error">{error}</div>}

        {sent ? (
          <div className="auth-alert success" style={{ margin: "20px 0", textAlign: "left" }}>
            <h4 style={{ color: "var(--success)", marginBottom: 6 }}>Instruções enviadas!</h4>
            <p style={{ fontSize: 13, color: "var(--text)" }}>
              Se o e-mail <strong>{email}</strong> estiver cadastrado em nossa base, você receberá um link seguro válido por 1 hora.
            </p>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              (Em ambiente de desenvolvimento, verifique o console do terminal para obter o link direto.)
            </p>
            <div style={{ marginTop: 18 }}>
              <Link href="/conta/entrar" className="btn btn-gold btn-sm">
                Voltar para o login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="forgot-email">Seu e-mail</label>
              <input
                id="forgot-email"
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

            <button
              type="submit"
              className="btn btn-gold"
              id="forgot-submit"
              disabled={loading || !email}
              style={{ width: "100%", marginTop: 8 }}
            >
              {loading ? "Enviando…" : "Enviar link de recuperação"}
            </button>
          </form>
        )}

        <div style={{ marginTop: 22, fontSize: 13, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <Link href="/conta/entrar" className="gold-text">
            ← Voltar para a tela de login
          </Link>
        </div>
      </div>
    </div>
  );
}
