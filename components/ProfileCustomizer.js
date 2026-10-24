"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "./UserContext";
import { SparkIcon, CheckIcon, UserIcon } from "./Icons";

const AVAILABLE_PREFERENCES = [
  { id: "electronics", label: "Eletrônicos", icon: "⚡" },
  { id: "clothing", label: "Roupas & Calçados", icon: "👕" },
  { id: "accessories", label: "Acessórios", icon: "🕶️" },
  { id: "furniture", label: "Casa & Móveis", icon: "🛋️" },
  { id: "beauty", label: "Beleza", icon: "✨" },
  { id: "ofertas", label: "Ofertas", icon: "🏷️" },
  { id: "games", label: "Games & Periféricos", icon: "🎮" },
  { id: "smartphones", label: "Smartphones", icon: "📱" },
];

export default function ProfileCustomizer({ initialUser }) {
  const router = useRouter();
  const { refresh } = useUser();
  const fileInputRef = useRef(null);

  const [name, setName] = useState(initialUser?.name || "");
  const [bio, setBio] = useState(initialUser?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(initialUser?.avatarUrl || "");
  const [preferences, setPreferences] = useState(() => {
    return Array.isArray(initialUser?.preferences) ? initialUser.preferences : [];
  });

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Otimização e compressão de imagem enviada localmente
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Por favor, selecione um arquivo de imagem válido (JPG, PNG ou WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setAvatarUrl(dataUrl);
        setErrorMsg("");
      };
      img.src = event.target?.result;
    };
    reader.readAsDataURL(file);
  }

  function togglePreference(prefId) {
    setPreferences((prev) =>
      prev.includes(prefId) ? prev.filter((p) => p !== prefId) : [...prev, prefId]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setStatusMsg("");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim(),
          avatarUrl: avatarUrl.trim() || null,
          preferences,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Erro ao salvar perfil.");
        setSaving(false);
        return;
      }

      setStatusMsg("Perfil e preferências atualizados com sucesso!");
      await refresh();
      router.refresh();
      setTimeout(() => setStatusMsg(""), 4500);
    } catch {
      setErrorMsg("Erro de conexão ao salvar alterações de perfil.");
    } finally {
      setSaving(false);
    }
  }

  const userInitial = (name || initialUser?.name || "U").charAt(0).toUpperCase();

  return (
    <div
      className="profile-customizer-card"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        marginTop: "24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div
          className="how-icon"
          style={{ width: 40, height: 40, marginBottom: 0, background: "rgba(242, 193, 78, 0.12)", color: "var(--gold)" }}
        >
          <SparkIcon width={20} height={20} />
        </div>
        <div>
          <h2 style={{ fontSize: 20, margin: 0 }}>Personalizar Meu Perfil</h2>
          <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
            Edite sua foto, biografia e escolha seus gostos para receber recomendações exclusivas na vitrine da The Store.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div
          className="auth-alert reveal"
          style={{
            background: "rgba(46, 204, 113, 0.12)",
            border: "1px solid rgba(46, 204, 113, 0.4)",
            color: "#2ecc71",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span>✓</span>
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="auth-alert error" style={{ marginBottom: 20 }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* SEÇÃO 1: FOTO DE PERFIL */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            paddingBottom: 22,
            borderBottom: "1px solid var(--border)",
            flexWrap: "wrap",
          }}
        >
          {/* Avatar Preview Circular */}
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              border: "2px solid var(--gold)",
              background: "var(--surface-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
              boxShadow: "0 0 16px rgba(242, 193, 78, 0.2)",
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 32, fontWeight: 700, color: "var(--gold)" }}>
                {userInitial}
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Foto de Perfil
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                📁 Enviar foto do dispositivo
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: "#e74c3c" }}
                  onClick={() => setAvatarUrl("")}
                >
                  Remover foto
                </button>
              )}
            </div>

            <div style={{ marginTop: 10 }}>
              <input
                type="url"
                className="input"
                style={{ fontSize: 12.5, height: 38 }}
                placeholder="Ou cole aqui uma URL direta de imagem (https://...)..."
                value={avatarUrl.startsWith("data:") ? "" : avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: DADOS DE EXIBIÇÃO */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginTop: 20 }}>
          <div className="field">
            <label htmlFor="pf-name">Nome de Exibição</label>
            <input
              id="pf-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo ou apelido..."
              required
              maxLength={100}
            />
          </div>

          <div className="field">
            <label htmlFor="pf-bio">Biografia</label>
            <textarea
              id="pf-bio"
              className="input"
              rows={3}
              style={{ height: "auto", padding: 12, lineHeight: 1.5 }}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Conte um pouco sobre você ou o que gosta de comprar..."
              maxLength={500}
            />
            <span className="muted" style={{ fontSize: 11.5, marginTop: 4, display: "block" }}>
              {bio.length}/500 caracteres
            </span>
          </div>
        </div>

        {/* SEÇÃO 3: PREFERÊNCIAS DE RECOMENDAÇÃO */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            🎯 Preferências de Itens para Recomendação
          </label>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
            Selecione as categorias que você mais gosta para priorizarmos na nova vitrine e em todas as ofertas da plataforma:
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {AVAILABLE_PREFERENCES.map((pref) => {
              const active = preferences.includes(pref.id);
              return (
                <button
                  key={pref.id}
                  type="button"
                  onClick={() => togglePreference(pref.id)}
                  style={{
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 20,
                    fontSize: 13,
                    border: active ? "1px solid var(--gold)" : "1px solid var(--border)",
                    background: active ? "rgba(242, 193, 78, 0.16)" : "var(--surface-2)",
                    color: active ? "var(--gold)" : "var(--fg)",
                    fontWeight: active ? 700 : 500,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{pref.icon}</span>
                  <span>{pref.label}</span>
                  {active && <CheckIcon width={12} height={12} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* BOTÃO SALVAR */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
          <button
            type="submit"
            className="btn btn-gold"
            id="btn-save-profile"
            disabled={saving || !name.trim()}
            style={{ padding: "12px 24px", fontSize: 14, fontWeight: 700 }}
          >
            {saving ? "Salvando Perfil…" : "Salvar Alterações do Perfil"}
          </button>
        </div>
      </form>
    </div>
  );
}
