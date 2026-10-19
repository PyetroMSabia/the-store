"use client";

import { useState, useRef } from "react";
import { CATEGORIES } from "@/lib/catalog";
import { STORE_NAMES, detectStore, STORES } from "@/lib/stores";
import { XIcon, PlusIcon, TrashIcon, SparkIcon, LinkIcon } from "../Icons";
import { StoreChip } from "../ProductUI";
import SafeImage from "../SafeImage";
import { calculateOfferStats, generateAiSummaryAndDescription } from "@/lib/aiSummary";
import { formatBRL } from "@/lib/offers";

export default function ProductEditor({ product, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    if (product) {
      const initialOffers = Array.isArray(product.offers) && product.offers.length > 0
        ? product.offers
        : [
            {
              id: "offer-1",
              storeName: product.storeName || "Shopee",
              affiliateUrl: product.affiliateUrl || "",
              price: product.price || "",
              oldPrice: product.oldPrice || "",
              isPrimary: true,
            },
          ];

      const initialImages = Array.isArray(product.images) && product.images.length > 0
        ? product.images
        : (product.imageUrl ? [product.imageUrl] : []);

      return {
        title: product.title || "",
        price: product.price || "",
        oldPrice: product.oldPrice || "",
        rating: product.rating != null ? product.rating : 4.8,
        imageUrl: product.imageUrl || initialImages[0] || "",
        images: initialImages,
        affiliateUrl: product.affiliateUrl || "",
        storeName: product.storeName || "Shopee",
        category: product.category || "clothing",
        description: product.description || "",
        aiSummary: product.aiSummary || "",
        offers: initialOffers,
        availableStores: Array.isArray(product.availableStores) && product.availableStores.length > 0
          ? product.availableStores
          : [product.storeName || "Shopee"],
      };
    }

    return {
      title: "",
      price: "",
      oldPrice: "",
      rating: 4.8,
      imageUrl: "",
      images: [],
      affiliateUrl: "",
      storeName: "Shopee",
      category: "clothing",
      description: "",
      aiSummary: "",
      offers: [
        {
          id: "offer-1",
          storeName: "Shopee",
          affiliateUrl: "",
          price: "",
          oldPrice: "",
          isPrimary: true,
        },
      ],
      availableStores: ["Shopee"],
    };
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [scrapingIndex, setScrapingIndex] = useState(null);
  const [searchingMulti, setSearchingMulti] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState("");
  const [imageOptions, setImageOptions] = useState(() => {
    return Array.isArray(product?.images) && product.images.length > 0
      ? product.images
      : (product?.imageUrl ? [product.imageUrl] : []);
  });
  const debounceTimerRef = useRef(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSearchMulti(queryOverride) {
    const query = String(queryOverride || form.title || "").trim();
    if (query.length < 2) {
      setError("Digite pelo menos 2 caracteres do nome do produto para buscar.");
      return;
    }

    setSearchingMulti(true);
    setSearchFeedback("");
    setError("");

    try {
      const res = await fetch("/api/search-multi-stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: query }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível localizar o produto nas lojas parceiras.");
        setSearchingMulti(false);
        return;
      }

      const opts = Array.isArray(data.imageOptions) && data.imageOptions.length > 0
        ? data.imageOptions
        : (Array.isArray(data.images) && data.images.length > 0 ? data.images : (data.imageUrl ? [data.imageUrl] : []));
      setImageOptions(opts);

      setForm((prev) => ({
        ...prev,
        title: data.title || prev.title,
        category: data.category || prev.category,
        rating: data.rating != null ? data.rating : prev.rating,
        imageUrl: data.imageUrl || prev.imageUrl,
        images: opts.length > 0 ? opts : prev.images,
        price: data.price != null ? data.price : prev.price,
        oldPrice: data.oldPrice != null ? data.oldPrice : prev.oldPrice,
        storeName: data.storeName || prev.storeName,
        affiliateUrl: data.affiliateUrl || prev.affiliateUrl,
        availableStores: Array.isArray(data.availableStores) && data.availableStores.length > 0 ? data.availableStores : prev.availableStores,
        offers: Array.isArray(data.offers) && data.offers.length > 0 ? data.offers : prev.offers,
        description: data.description || prev.description,
        aiSummary: data.aiSummary || prev.aiSummary,
      }));

      const numOffers = data.offers?.length || 0;
      const storeList = data.availableStores?.join(", ") || "";
      setSearchFeedback(`✓ Encontradas ${numOffers} ofertas com fotos reais (${storeList})!`);
    } catch {
      setError("Erro de conexão ao buscar produto nas lojas parceiras.");
    } finally {
      setSearchingMulti(false);
    }
  }

  function addOffer(customStore = "") {
    const cur = form.offers || [];
    const newOffer = {
      id: `offer-${Date.now()}`,
      storeName: customStore || "Mercado Livre",
      affiliateUrl: "",
      price: "",
      oldPrice: "",
      isPrimary: cur.length === 0,
    };
    const next = [...cur, newOffer];
    updateOffers(next);
  }

  function removeOffer(idx) {
    if (form.offers.length <= 1) return;
    const next = form.offers.filter((_, i) => i !== idx);
    if (!next.some((o) => o.isPrimary)) {
      next[0].isPrimary = true;
    }
    updateOffers(next);
  }

  function setPrimaryOffer(idx) {
    const next = form.offers.map((o, i) => ({
      ...o,
      isPrimary: i === idx,
    }));
    const primary = next[idx];
    setForm((prev) => ({
      ...prev,
      offers: next,
      storeName: primary.storeName,
      affiliateUrl: primary.affiliateUrl || prev.affiliateUrl,
      price: primary.price || prev.price,
    }));
  }

  function updateOfferField(idx, field, val) {
    const next = form.offers.map((o, i) => {
      if (i !== idx) return o;
      return { ...o, [field]: val };
    });
    updateOffers(next);
  }

  async function handleOfferUrlPasteOrBlur(idx, targetUrl) {
    const trimmed = (targetUrl || "").trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return;

    const detectedKey = detectStore(trimmed);
    const detectedName = detectedKey ? STORES[detectedKey].name : null;
    if (detectedName) {
      updateOfferField(idx, "storeName", detectedName);
    }

    setScrapingIndex(idx);
    try {
      const res = await fetch("/api/scrape-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      if (res.ok) {
        const json = await res.json();
        const d = json.data;
        if (d) {
          const next = form.offers.map((o, i) => {
            if (i !== idx) return o;
            return {
              ...o,
              storeName: d.storeName || detectedName || o.storeName,
              price: d.price || o.price,
              oldPrice: d.oldPrice || o.oldPrice,
            };
          });
          updateOffers(next);
        }
      }
    } catch {}
    finally {
      setScrapingIndex(null);
    }
  }

  function updateOffers(nextOffers) {
    const stats = calculateOfferStats(nextOffers);
    const offerStores = nextOffers.map((o) => o.storeName).filter(Boolean);
    const combinedStores = Array.from(new Set([...(form.availableStores || []), ...offerStores]));
    const primary = nextOffers.find((o) => o.isPrimary) || nextOffers[0];

    setForm((prev) => ({
      ...prev,
      offers: nextOffers,
      availableStores: combinedStores,
      price: primary?.price || stats.minPrice || prev.price,
      storeName: primary?.storeName || prev.storeName,
      affiliateUrl: primary?.affiliateUrl || prev.affiliateUrl,
    }));
  }

  function handleRegenerateAi() {
    const ai = generateAiSummaryAndDescription({
      title: form.title,
      category: form.category,
      rating: form.rating,
      offers: form.offers,
      storeName: form.storeName,
    });
    setForm((prev) => ({
      ...prev,
      aiSummary: ai.aiSummary,
      description: ai.description,
    }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(product ? `/api/products/${product.id}` : "/api/products", {
        method: product ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erro ao salvar produto.");
        setSaving(false);
        return;
      }

      onSaved(product ? "Produto atualizado com sucesso!" : "Novo produto cadastrado!");
    } catch {
      setError("Erro de conexão ao salvar produto.");
      setSaving(false);
    }
  }

  const offerStats = calculateOfferStats(form.offers);

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(6px)",
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        className="modal"
        onSubmit={save}
        style={{
          width: "100%",
          maxWidth: 780,
          maxHeight: "88vh",
          overflowY: "auto",
          margin: "auto",
          padding: 28,
          boxSizing: "border-box",
        }}
      >
        <div className="modal-head" style={{ padding: "0 0 16px", borderBottom: "1px solid var(--border)", marginBottom: 18 }}>
          <h2>{product ? "Editar Anúncio Multi-Lojas" : "Cadastrar Novo Anúncio"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <XIcon />
          </button>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          <div className="editor-top">
            <div>
              {form.imageUrl ? (
                <SafeImage
                  className="preview-img"
                  src={form.imageUrl}
                  alt="Prévia"
                  style={{ aspectRatio: "1/1", objectFit: "cover", borderRadius: "var(--radius-md)" }}
                />
              ) : (
                <div className="preview-img" style={{ display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 13 }}>
                  Prévia da imagem
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <StoreChip storeName={form.storeName} />
              </div>

              {imageOptions && imageOptions.length > 1 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, fontWeight: 500 }}>
                    Fotos reais encontradas (clique para alternar):
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {imageOptions.map((optUrl, idx) => {
                      const isSelected = form.imageUrl === optUrl;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => set("imageUrl", optUrl)}
                          style={{
                            width: 44,
                            height: 44,
                            padding: 0,
                            borderRadius: 6,
                            overflow: "hidden",
                            border: isSelected ? "2px solid var(--gold)" : "1px solid var(--border)",
                            boxShadow: isSelected ? "0 0 10px rgba(242, 193, 78, 0.45)" : "none",
                            background: "#000",
                            cursor: "pointer",
                            transition: "all 0.15s",
                            opacity: isSelected ? 1 : 0.65,
                          }}
                          title={`Selecionar foto ${idx + 1}`}
                        >
                          <img
                            src={optUrl}
                            alt={`Opção ${idx + 1}`}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="form-grid">
              <div className="field full">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label htmlFor="f-title" style={{ margin: 0 }}>Nome do Produto</label>
                  <button
                    type="button"
                    className="btn btn-gold btn-sm"
                    id="btn-search-multi-stores"
                    onClick={() => handleSearchMulti()}
                    disabled={searchingMulti || !form.title || form.title.trim().length < 2}
                    style={{ padding: "4px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {searchingMulti ? "🔍 Buscando nas lojas…" : "🔍 Buscar em todas as lojas"}
                  </button>
                </div>
                <input
                  id="f-title"
                  className="input"
                  value={form.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    set("title", val);
                    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                    if (val.trim().length >= 4) {
                      debounceTimerRef.current = setTimeout(() => {
                        handleSearchMulti(val);
                      }, 1400);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                      handleSearchMulti();
                    }
                  }}
                  placeholder="Nome exato do item (ex: Fone Bluetooth, Vestido Canelado, Echo Dot...)"
                  required
                />
                {searchFeedback && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--success, #3ecf8e)", fontWeight: 500 }}>
                    {searchFeedback}
                  </div>
                )}
              </div>

              <div className="field">
                <label htmlFor="f-category">Categoria</label>
                <select
                  id="f-category"
                  className="input"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  {Object.entries(CATEGORIES).map(([k, c]) => (
                    <option key={k} value={k}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="f-rating">Avaliação / Nota (0 a 5)</label>
                <input
                  id="f-rating"
                  className="input"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={form.rating}
                  onChange={(e) => set("rating", e.target.value)}
                />
              </div>

              <div className="field full">
                <label htmlFor="f-image">URL da foto principal</label>
                <input
                  id="f-image"
                  className="input"
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => set("imageUrl", e.target.value)}
                  placeholder="https://..."
                  required
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO MULTI-LINKS E OFERTAS */}
          <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                  <LinkIcon width={16} height={16} style={{ color: "var(--gold)" }} />
                  Links e Preços das Lojas Cadastradas
                </h3>
                <span className="muted" style={{ fontSize: 12 }}>
                  Adicione links de outras lojas. Ao colar cada URL, a loja e o preço são detectados automaticamente.
                </span>
              </div>

              <button
                type="button"
                onClick={() => addOffer()}
                className="btn btn-ghost"
                style={{ fontSize: 12.5, height: 36, padding: "0 12px" }}
              >
                <PlusIcon width={13} height={13} /> + Adicionar link de outra loja
              </button>
            </div>

            {/* Chips de Lojas Rápidas */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {STORE_NAMES.map((store) => {
                const hasOffer = (form.offers || []).some(
                  (o) => o.storeName?.toLowerCase() === store.toLowerCase()
                );
                return (
                  <button
                    key={store}
                    type="button"
                    onClick={() => addOffer(store)}
                    style={{
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 9px",
                      borderRadius: 14,
                      fontSize: 11,
                      border: hasOffer ? "1px solid var(--gold)" : "1px solid var(--border)",
                      background: hasOffer ? "rgba(242, 193, 78, 0.15)" : "var(--surface)",
                      color: hasOffer ? "var(--gold)" : "var(--muted)",
                    }}
                  >
                    <span>{store}</span>
                    <span style={{ opacity: 0.6 }}>+</span>
                  </button>
                );
              })}
            </div>

            {/* Lista de Ofertas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {form.offers.map((offer, idx) => {
                const isCheapest =
                  offerStats &&
                  offerStats.count > 1 &&
                  Number(offer.price) > 0 &&
                  Math.round(Number(offer.price) * 100) / 100 === offerStats.minPrice;
                const isScrapingThis = scrapingIndex === idx;

                return (
                  <div
                    key={offer.id || idx}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: offer.isPrimary ? "1px solid var(--gold)" : "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                          Link {idx + 1}
                        </span>
                        <StoreChip storeName={offer.storeName} />
                        {isCheapest && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#2ecc71", background: "rgba(46,204,113,0.15)", padding: "1px 6px", borderRadius: 8 }}>
                            ★ Menor Preço
                          </span>
                        )}
                        {offer.isPrimary ? (
                          <span style={{ fontSize: 10.5, fontWeight: 700, background: "var(--gold)", color: "#000", padding: "1px 6px", borderRadius: 8 }}>
                            Principal
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPrimaryOffer(idx)}
                            style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
                          >
                            Definir principal
                          </button>
                        )}
                      </div>

                      {form.offers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOffer(idx)}
                          className="icon-btn"
                          style={{ width: 28, height: 28, color: "#e74c3c" }}
                          title="Remover link"
                        >
                          <TrashIcon width={13} height={13} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 130px 130px", gap: 8 }}>
                      <div>
                        <select
                          className="input"
                          style={{ fontSize: 12.5, height: 38 }}
                          value={offer.storeName}
                          onChange={(e) => updateOfferField(idx, "storeName", e.target.value)}
                        >
                          {STORE_NAMES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <input
                          type="url"
                          className="input"
                          style={{ fontSize: 12.5, height: 38 }}
                          placeholder={`Link na ${offer.storeName}... ${isScrapingThis ? "⚡ (Buscando...)" : ""}`}
                          value={offer.affiliateUrl}
                          onChange={(e) => updateOfferField(idx, "affiliateUrl", e.target.value)}
                          onBlur={(e) => handleOfferUrlPasteOrBlur(idx, e.target.value)}
                          onPaste={(e) => {
                            const pasted = e.clipboardData?.getData("text") || "";
                            if (pasted.startsWith("http")) {
                              setTimeout(() => handleOfferUrlPasteOrBlur(idx, pasted), 50);
                            }
                          }}
                          required
                        />
                      </div>

                      <div>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="input"
                          style={{ fontSize: 12.5, height: 38, fontWeight: 600, color: "var(--gold)" }}
                          placeholder="Preço R$"
                          value={offer.price}
                          onChange={(e) => updateOfferField(idx, "price", e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <input
                          type="number"
                          step="0.01"
                          className="input"
                          style={{ fontSize: 12.5, height: 38 }}
                          placeholder="De R$ (opc)"
                          value={offer.oldPrice || ""}
                          onChange={(e) => updateOfferField(idx, "oldPrice", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Média de Preço e Estatísticas */}
            {offerStats && offerStats.count > 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: "var(--radius-md)",
                  background: "rgba(242, 193, 78, 0.05)",
                  border: "1px solid rgba(242, 193, 78, 0.25)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div>
                    <span className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>
                      Média ({offerStats.count} lojas)
                    </span>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)" }}>
                      {formatBRL(offerStats.avgPrice)}
                    </div>
                  </div>
                  {offerStats.count > 1 && (
                    <div>
                      <span className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>
                        Menor Preço
                      </span>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#2ecc71" }}>
                        {formatBRL(offerStats.minPrice)}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleRegenerateAi}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, height: 32, padding: "0 10px" }}
                >
                  <SparkIcon width={12} height={12} /> Atualizar Resumo por IA
                </button>
              </div>
            )}
          </div>

          {/* SEÇÃO DESCRIÇÃO E IA SUMMARY */}
          <div style={{ marginTop: 22, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div className="field full" style={{ marginBottom: 12 }}>
              <label htmlFor="f-desc">Descrição do Produto</label>
              <textarea
                id="f-desc"
                className="textarea"
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Detalhes e diferenciais do produto..."
              />
            </div>

            <div className="field full">
              <label htmlFor="f-ai" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--gold)" }}>
                <SparkIcon width={13} height={13} />
                <span>Resumo do Produto por IA (Análise de Qualidade, Preço & Veredito)</span>
              </label>
              <textarea
                id="f-ai"
                className="textarea"
                rows={3}
                style={{
                  border: "1px solid rgba(242, 193, 78, 0.4)",
                  background: "rgba(242, 193, 78, 0.03)",
                }}
                value={form.aiSummary}
                onChange={(e) => set("aiSummary", e.target.value)}
                placeholder="Análise The Store AI..."
              />
            </div>
          </div>
        </div>

        <div className="modal-foot" style={{ padding: "18px 0 0", borderTop: "1px solid var(--border)", marginTop: 22, position: "static", background: "none" }}>
          <span className="error">{error}</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn btn-gold" disabled={saving} id="save-product">
              {saving ? "Salvando…" : product ? "Atualizar produto" : "Publicar produto"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
