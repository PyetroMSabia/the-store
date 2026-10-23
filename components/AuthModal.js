"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "./UserContext";
import { EyeIcon, EyeOffIcon, XIcon } from "./Icons";
import { passwordStrength } from "@/lib/validation";

export default function AuthModal() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, refresh } = useUser();

  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("login"); // "login" | "register"
  const [dismissed, setDismissed] = useState(false);

  // Estados da aba Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Estados da aba Cadastro
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Força da senha no cadastro
  const strength = passwordStrength(regPassword);
  const strengthLabels = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];
  const strengthColors = ["#ef6a5b", "#ef6a5b", "#f2c14e", "#f2c14e", "#3ecf8e"];

  // Se estiver carregando a sessão, se já estiver logado, se foi fechado pelo visitante
  // ou se o usuário já estiver navegando em páginas dedicadas de autenticação, não exibe
  const isAuthPage =
    pathname?.startsWith("/conta/entrar") ||
    pathname?.startsWith("/conta/criar") ||
    pathname?.startsWith("/conta/cadastro") ||
    pathname?.startsWith("/conta/redefinir") ||
    pathname?.startsWith("/conta/recuperar");

  if (!mounted || loading || user || dismissed || isAuthPage) {
    return null;
  }

  // Submit de Login
  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        throw new Error("Não foi possível processar o login no servidor.");
      }

      if (!res.ok) {
        setLoginError(data?.error || "E-mail ou senha incorretos.");
        setLoginLoading(false);
        return;
      }

      // Atualiza a sessão e fecha o modal automaticamente liberando a navegação
      await refresh();
      router.refresh();
    } catch (err) {
      setLoginError(err?.message || "Erro de conexão ao tentar fazer login.");
      setLoginLoading(false);
    }
  }

  // Submit de Cadastro
  async function handleRegisterSubmit(e) {
    e.preventDefault();
    setRegError("");

    if (regPassword !== regConfirmPassword) {
      setRegError("As senhas não coincidem. Digite a mesma senha nos dois campos.");
      return;
    }

    if (regPassword.length < 8) {
      setRegError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (!/[A-Za-zÀ-ÿ]/.test(regPassword) || !/\d/.test(regPassword)) {
      setRegError("A senha deve conter letras e números.");
      return;
    }

    setRegLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
        }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        throw new Error("Não foi possível processar o cadastro no servidor.");
      }

      if (!res.ok) {
        setRegError(data?.error || "Erro ao criar conta.");
        setRegLoading(false);
        return;
      }

      // Atualiza a sessão e fecha o modal automaticamente liberando a navegação
      await refresh();
      router.refresh();
    } catch (err) {
      setRegError(err?.message || "Erro de conexão ao tentar cadastrar.");
      setRegLoading(false);
    }
  }

  return (
    <div
      className="auth-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "rgba(5, 5, 7, 0.82)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        animation: "fadeIn 0.25s ease",
      }}
    >
      <div
        className="auth-modal-card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          maxHeight: "92vh",
          overflowY: "auto",
          background: "var(--surface)",
          border: "1px solid rgba(242, 193, 78, 0.35)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 30px 80px -15px rgba(0, 0, 0, 0.95), 0 0 45px -10px rgba(242, 193, 78, 0.25)",
          padding: "30px 26px 26px",
          textAlign: "center",
        }}
      >
        {/* Botão Fechar / Continuar como Visitante */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          title="Fechar e explorar como visitante"
          aria-label="Fechar modal"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--border)",
            borderRadius: "50%",
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted)",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text)";
            e.currentTarget.style.borderColor = "var(--gold)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--muted)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <XIcon width={16} height={16} />
        </button>

        {/* Logo Circular com glow */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <img
            src="/logo.jpg"
            alt="The Store"
            style={{
              width: 76,
              height: 76,
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid rgba(242, 193, 78, 0.4)",
              boxShadow: "0 8px 24px -6px rgba(242, 193, 78, 0.4)",
            }}
          />
        </div>

        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, margin: "0 0 4px" }}>
          Bem-vindo à <span className="gold-text">The Store</span>
        </h2>
        <p className="muted" style={{ fontSize: 13, margin: "0 auto 16px", maxWidth: 360, lineHeight: 1.4 }}>
          Acesse sua conta ou cadastre-se para salvar favoritos e aproveitar a curadoria oficial das maiores lojas.
        </p>

        {/* Abas Alternáveis com 1 Clique */}
        <div
          style={{
            display: "flex",
            gap: 6,
            background: "var(--surface-2)",
            padding: 4,
            borderRadius: 12,
            border: "1px solid var(--border)",
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTab("login");
              setLoginError("");
              setRegError("");
            }}
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: tab === "login" ? "var(--gold-grad)" : "transparent",
              color: tab === "login" ? "#0d0d0f" : "var(--muted)",
              boxShadow: tab === "login" ? "0 4px 14px rgba(242, 193, 78, 0.35)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            Entrar na Conta
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("register");
              setLoginError("");
              setRegError("");
            }}
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: tab === "register" ? "var(--gold-grad)" : "transparent",
              color: tab === "register" ? "#0d0d0f" : "var(--muted)",
              boxShadow: tab === "register" ? "0 4px 14px rgba(242, 193, 78, 0.35)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            Criar Conta
          </button>
        </div>

        {/* ABA 1: ENTRAR NA CONTA */}
        {tab === "login" && (
          <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
            {loginError && <div className="auth-alert error">{loginError}</div>}

            <div className="field">
              <label htmlFor="modal-login-email">Seu e-mail</label>
              <input
                id="modal-login-email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="modal-login-password">Sua senha</label>
                <Link
                  href="/conta/recuperar"
                  onClick={() => setDismissed(true)}
                  className="gold-text"
                  style={{ fontSize: 12 }}
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="password-input-wrap" style={{ position: "relative", width: "100%" }}>
                <input
                  id="modal-login-password"
                  className="input"
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className={`password-toggle-btn ${showLoginPassword ? "active" : ""}`}
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  title={showLoginPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-label={showLoginPassword ? "Ocultar senha" : "Mostrar senha"}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: showLoginPassword ? "var(--gold)" : "var(--muted)",
                    padding: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showLoginPassword ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-gold"
              disabled={loginLoading || !loginEmail || !loginPassword}
              style={{ width: "100%", marginTop: 6 }}
            >
              {loginLoading ? "Entrando…" : "Entrar na The Store"}
            </button>
          </form>
        )}

        {/* ABA 2: CRIAR CONTA GRATUITAMENTE */}
        {tab === "register" && (
          <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
            {regError && <div className="auth-alert error">{regError}</div>}

            <div className="field">
              <label htmlFor="modal-reg-name">Nome completo</label>
              <input
                id="modal-reg-name"
                className="input"
                type="text"
                placeholder="Ex: Maria Silva"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="modal-reg-email">Seu e-mail</label>
              <input
                id="modal-reg-email"
                className="input"
                type="email"
                placeholder="seu@email.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="modal-reg-password">Criar senha</label>
              <div className="password-input-wrap" style={{ position: "relative", width: "100%" }}>
                <input
                  id="modal-reg-password"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className={`password-toggle-btn ${showPassword ? "active" : ""}`}
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: showPassword ? "var(--gold)" : "var(--muted)",
                    padding: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showPassword ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
                </button>
              </div>
              {regPassword && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", gap: 3, height: 3, borderRadius: 2, overflow: "hidden", background: "var(--surface-3)" }}>
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
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    <span>
                      Força: <b style={{ color: strengthColors[strength] }}>{strengthLabels[strength]}</b>
                    </span>
                    <span>Mínimo 8 caracteres</span>
                  </div>
                </div>
              )}
            </div>

            <div className="field">
              <label htmlFor="modal-reg-confirm">Confirmar senha</label>
              <div className="password-input-wrap" style={{ position: "relative", width: "100%" }}>
                <input
                  id="modal-reg-confirm"
                  className="input"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className={`password-toggle-btn ${showConfirmPassword ? "active" : ""}`}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  title={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: showConfirmPassword ? "var(--gold)" : "var(--muted)",
                    padding: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showConfirmPassword ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
                </button>
              </div>

              {regConfirmPassword && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    marginTop: 4,
                    color: regPassword === regConfirmPassword ? "#3ecf8e" : "#ef6a5b",
                    fontWeight: 500,
                  }}
                >
                  {regPassword === regConfirmPassword ? (
                    <span>✓ As senhas coincidem</span>
                  ) : (
                    <span>✕ As senhas precisam ser iguais</span>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-gold"
              disabled={regLoading || !regName || !regEmail || !regPassword || !regConfirmPassword}
              style={{ width: "100%", marginTop: 6 }}
            >
              {regLoading ? "Criando conta…" : "Criar minha conta"}
            </button>
          </form>
        )}

        {/* Rodapé de navegação livre */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12.5 }}>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="gold-text"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 12.5,
              padding: "4px 8px",
            }}
          >
            Continuar explorando como visitante →
          </button>
        </div>
      </div>
    </div>
  );
}
