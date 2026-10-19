"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { passwordStrength } from "@/lib/validation";
import { EyeIcon, EyeOffIcon } from "@/components/Icons";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);


  const strength = passwordStrength(password);
  const strengthLabels = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];
  const strengthColors = ["#ef6a5b", "#ef6a5b", "#f2c14e", "#f2c14e", "#3ecf8e"];

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Token de redefinição não encontrado ou link inválido.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As duas senhas digitadas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao redefinir senha.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/conta/entrar");
      }, 3000);
    } catch {
      setError("Erro ao se conectar com o servidor.");
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card reveal">
        <Link href="/" aria-label="Ir para a página inicial">
          <img src="/logo.jpg" alt="The Store" />
        </Link>
        <h1>Redefinir sua senha</h1>
        <p className="muted">Escolha uma nova senha forte para proteger sua conta.</p>

        {error && <div className="auth-alert error">{error}</div>}

        {success ? (
          <div className="auth-alert success" style={{ margin: "20px 0" }}>
            <h4 style={{ color: "var(--success)" }}>Senha alterada com sucesso!</h4>
            <p style={{ fontSize: 13, color: "var(--text)", marginTop: 6 }}>
              Você será redirecionado para a tela de login em instantes...
            </p>
            <div style={{ marginTop: 16 }}>
              <Link href="/conta/entrar" className="btn btn-gold btn-sm">
                Ir para o login agora
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="new-password">Nova senha</label>
              <div className="password-input-wrap" style={{ position: "relative", width: "100%" }}>
                <input
                  id="new-password"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
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
                  {showPassword ? (
                    <EyeOffIcon width={18} height={18} />
                  ) : (
                    <EyeIcon width={18} height={18} />
                  )}
                </button>
              </div>
              {password && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: "flex", gap: 4, height: 4, borderRadius: 2, overflow: "hidden", background: "var(--surface-3)" }}>
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
                    <span>Força: <b style={{ color: strengthColors[strength] }}>{strengthLabels[strength]}</b></span>
                    <span>Mínimo 8 caracteres</span>
                  </div>
                </div>
              )}
            </div>

            <div className="field">
              <label htmlFor="confirm-password">Confirme a nova senha</label>
              <div className="password-input-wrap" style={{ position: "relative", width: "100%" }}>
                <input
                  id="confirm-password"
                  className="input"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  {showConfirmPassword ? (
                    <EyeOffIcon width={18} height={18} />
                  ) : (
                    <EyeIcon width={18} height={18} />
                  )}
                </button>
              </div>
              {confirmPassword && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    marginTop: 6,
                    color: password === confirmPassword ? "#3ecf8e" : "#ef6a5b",
                    fontWeight: 500,
                    textAlign: "left",
                  }}
                >
                  {password === confirmPassword ? (
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
              id="reset-submit"
              disabled={loading || !password || !confirmPassword || !token}
              style={{ width: "100%", marginTop: 8 }}
            >
              {loading ? "Salvando nova senha…" : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="login-wrap" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
