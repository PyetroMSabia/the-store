"use client";

import { useState, useRef } from "react";
import { SparkIcon, LinkIcon, CheckIcon, PlusIcon, TrashIcon, RefreshIcon } from "../Icons";
import { CATEGORIES } from "@/lib/catalog";
import { STORE_NAMES, detectStore, STORES } from "@/lib/stores";
import { StoreChip } from "../ProductUI";
import SafeImage from "../SafeImage";
import { calculateOfferStats, generateAiSummaryAndDescription } from "@/lib/aiSummary";
import { formatBRL } from "@/lib/offers";

export default function QuickImport({ onCreated }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  // Formulário editável de curadoria completa
  const [editForm, setEditForm] = useState(null);
  const [autoPublished, setAutoPublished] = useState(false);
  const [scrapingOfferIndex, setScrapingOfferIndex] = useState(null);
  const lastScrapedRef = useRef("");

  async function triggerScrape(rawUrl) {
    const trimmed = (rawUrl || "").trim();
    if (!trimmed || !trimmed.startsWith("http")) return;
    if (loading) return;

    lastScrapedRef.current = trimmed;
    setLoading(true);
    setError("");
    setPreview(null);
    setEditForm(null);
    setAutoPublished(false);

    try {
      const res = await fetch("/api/scrape-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Não foi possível extrair os dados desta URL.");
        setLoading(false);
        return;
      }

      const d = json.data || {};
      const primaryStore = d.storeName || "Shopee";

      // Constrói oferta inicial extraída
      const initialOffer = {
        id: "offer-1",
        storeName: primaryStore,
        affiliateUrl: d.affiliateUrl || trimmed,
        price: d.price || "",
        oldPrice: d.oldPrice || "",
        isPrimary: true,
      };

      const initialOffers = Array.isArray(d.offers) && d.offers.length > 0 ? d.offers : [initialOffer];
      const initialImages = Array.isArray(d.images) && d.images.length > 0
        ? d.images
        : (d.imageUrl ? [d.imageUrl] : []);

      const availableStores = Array.from(new Set([
        primaryStore,
        ...(Array.isArray(d.availableStores) ? d.availableStores : []),
        ...initialOffers.map((o) => o.storeName).filter(Boolean),
      ]));

      // Gera cópia inteligente por IA
      const ai = generateAiSummaryAndDescription({
        title: d.title || "",
        category: d.category || "clothing",
        rating: d.rating != null ? d.rating : 4.8,
        offers: initialOffers,
        storeName: primaryStore,
        existingDescription: d.description || "",
      });

      const formPayload = {
        title: d.title || "",
        price: d.price || "",
        oldPrice: d.oldPrice || "",
        rating: d.rating != null ? d.rating : 4.8,
        imageUrl: initialImages[0] || d.imageUrl || "",
        images: initialImages,
        affiliateUrl: d.affiliateUrl || trimmed,
        sourceUrl: d.sourceUrl || trimmed,
        storeName: primaryStore,
        category: d.category || "clothing",
        description: d.description || ai.description,
        aiSummary: d.aiSummary || ai.aiSummary,
        offers: initialOffers,
        availableStores,
      };

      // Publicação direta e automática no banco de dados (REQUISITO 3: Publicação Direta e Automática)
      let publishedProduct = null;
      try {
        const pubRes = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formPayload),
        });
        if (pubRes.ok) {
          publishedProduct = await pubRes.json();
          if (onCreated) onCreated("Produto importado e publicado automaticamente na vitrine!");
        }
      } catch (pubErr) {
        console.warn("[the-store] Aviso ao salvar automaticamente:", pubErr);
      }

      setPreview(d);
      setEditForm({
        ...formPayload,
        id: publishedProduct?.id || null,
      });
      setAutoPublished(Boolean(publishedProduct));
    } catch {
      setError("Erro de rede ao conectar com o serviço de extração.");
    } finally {
      setLoading(false);
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData?.getData("text") || "";
    const trimmed = pasted.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      setUrl(trimmed);
      triggerScrape(trimmed);
    }
  }

  function handleInputChange(e) {
    const val = e.target.value;
    setUrl(val);
    const trimmed = val.trim();
    if (
      (trimmed.startsWith("http://") || trimmed.startsWith("https://")) &&
      trimmed.length > 15 &&
      trimmed !== lastScrapedRef.current &&
      !loading
    ) {
      triggerScrape(trimmed);
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (url.trim()) {
      triggerScrape(url.trim());
    }
  }

  // --- Gerenciamento de Ofertas Múltiplas ---
  function addOffer(customStore = "") {
    if (!editForm) return;
    const current = editForm.offers || [];
    const newOffer = {
      id: `offer-${Date.now()}`,
      storeName: customStore || "Mercado Livre",
      affiliateUrl: "",
      price: "",
      oldPrice: "",
      isPrimary: current.length === 0,
    };
    const nextOffers = [...current, newOffer];
    updateOffersAndSync(nextOffers);
  }

  function removeOffer(index) {
    if (!editForm || editForm.offers.length <= 1) return;
    const next = editForm.offers.filter((_, i) => i !== index);
    if (!next.some((o) => o.isPrimary)) {
      next[0].isPrimary = true;
    }
    updateOffersAndSync(next);
  }

  function setPrimaryOffer(index) {
    if (!editForm) return;
    const next = editForm.offers.map((o, i) => ({
      ...o,
      isPrimary: i === index,
    }));
    const primary = next[index];
    setEditForm({
      ...editForm,
      offers: next,
      storeName: primary.storeName,
      affiliateUrl: primary.affiliateUrl || editForm.affiliateUrl,
      price: primary.price || editForm.price,
    });
  }

  function updateOfferField(index, field, value) {
    if (!editForm) return;
    const next = editForm.offers.map((o, i) => {
      if (i !== index) return o;
      return { ...o, [field]: value };
    });
    updateOffersAndSync(next);
  }

  // Automação: ao colar ou digitar uma nova URL de loja parceira, busca loja e preço automaticamente
  async function handleOfferUrlPasteOrBlur(index, targetUrl) {
    const trimmed = (targetUrl || "").trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return;

    // Detecta loja imediatamente pelo domínio
    const detectedKey = detectStore(trimmed);
    const detectedName = detectedKey ? STORES[detectedKey].name : null;

    if (detectedName) {
      updateOfferField(index, "storeName", detectedName);
    }

    // Busca preço na rota de scraping
    setScrapingOfferIndex(index);
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
          const next = editForm.offers.map((o, i) => {
            if (i !== index) return o;
            return {
              ...o,
              storeName: d.storeName || detectedName || o.storeName,
              price: d.price || o.price,
              oldPrice: d.oldPrice || o.oldPrice,
            };
          });
          updateOffersAndSync(next);
        }
      }
    } catch {
      // Preenchimento manual mantido
    } finally {
      setScrapingOfferIndex(null);
    }
  }

  function updateOffersAndSync(nextOffers) {
    const stats = calculateOfferStats(nextOffers);
    const offerStores = nextOffers.map((o) => o.storeName).filter(Boolean);
    const combinedStores = Array.from(new Set([...(editForm.availableStores || []), ...offerStores]));
    const primaryOffer = nextOffers.find((o) => o.isPrimary) || nextOffers[0];

    setEditForm((prev) => ({
      ...prev,
      offers: nextOffers,
      availableStores: combinedStores,
      price: primaryOffer?.price || stats.minPrice || prev.price,
      storeName: primaryOffer?.storeName || prev.storeName,
      affiliateUrl: primaryOffer?.affiliateUrl || prev.affiliateUrl,
    }));
  }

  function handleRegenerateAi() {
    if (!editForm) return;
    const ai = generateAiSummaryAndDescription({
      title: editForm.title,
      category: editForm.category,
      rating: editForm.rating,
      offers: editForm.offers,
      storeName: editForm.storeName,
    });
    setEditForm((prev) => ({
      ...prev,
      aiSummary: ai.aiSummary,
      description: ai.description,
    }));
  }

  function handleStoreChipClick(storeName) {
    if (!editForm) return;
    const exists = (editForm.offers || []).some((o) => o.storeName.toLowerCase() === storeName.toLowerCase());
    if (exists) {
      const cur = editForm.availableStores || [];
      const next = cur.includes(storeName) ? cur.filter((s) => s !== storeName) : [...cur, storeName];
      setEditForm({ ...editForm, availableStores: next.length ? next : [editForm.storeName] });
    } else {
      addOffer(storeName);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!editForm) return;

    setSaving(true);
    setError("");

    try {
      const isUpdate = Boolean(editForm.id);
      const endpoint = isUpdate ? `/api/products/${editForm.id}` : "/api/products";
      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erro ao salvar produto.");
        setSaving(false);
        return;
      }

      setUrl("");
      setPreview(null);
      setEditForm(null);
      setAutoPublished(false);
      lastScrapedRef.current = "";
      if (onCreated) {
        onCreated(isUpdate ? "Ajustes do anúncio salvos com sucesso na vitrine!" : "Produto cadastrado e publicado com sucesso na vitrine!");
      }
    } catch {
      setError("Erro ao salvar produto.");
    } finally {
      setSaving(false);
    }
  }

  const offerStats = editForm ? calculateOfferStats(editForm.offers) : null;

  return (
    <div className="quick-import-card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div className="how-icon" style={{ width: 36, height: 36, marginBottom: 0 }}>
          <SparkIcon width={18} height={18} />
        </div>
        <div>
          <h2 style={{ fontSize: 20 }}>Importação Rápida por Link Oficial</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Cole o link do produto para geração e publicação automática na vitrine. Em seguida, adicione quantos links de outras lojas desejar!
          </p>
        </div>
      </div>

      <form onSubmit={handleManualSubmit} style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 280 }}>
          <LinkIcon
            width={16}
            height={16}
            style={{ position: "absolute", left: 14, top: 13, color: "var(--muted)" }}
          />
          <input
            type="url"
            className="input"
            style={{ paddingLeft: 38 }}
            placeholder="Cole o link do anúncio oficial (Shopee, Mercado Livre, Amazon, Shein, Magalu...)..."
            value={url}
            onPaste={handlePaste}
            onChange={handleInputChange}
            disabled={loading}
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-gold"
          id="btn-quick-import"
          disabled={loading || !url.trim()}
          style={{ whiteSpace: "nowrap" }}
        >
          {loading ? "⚡ Importando & Publicando…" : "⚡ Importar / Publicar"}
        </button>
      </form>

      {/* Indicador de extração */}
      {loading && (
        <div
          className="auth-alert"
          style={{
            marginTop: 14,
            background: "rgba(242, 193, 78, 0.08)",
            border: "1px solid rgba(242, 193, 78, 0.3)",
            color: "var(--gold)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16 }}>⚡</span>
          <div>
            <strong>Extraindo dados oficiais do produto...</strong>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              Consultando API e metadados das lojas para preencher nome limpo, galeria em alta resolução e preço verificado.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="auth-alert error" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}

      {/* Pré-visualização e Edição */}
      {preview && editForm && (
        <div className="import-preview-box reveal" style={{ marginTop: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <span className="eyebrow" style={{ color: "var(--gold)" }}>
              <CheckIcon width={12} height={12} /> Curadoria Inteligente The Store
            </span>
            <span className="muted" style={{ fontSize: 12.5 }}>
              Ofertas cadastradas: <strong>{editForm.offers?.length || 1}</strong> loja(s) · Revise e complete os dados
            </span>
          </div>

          <form onSubmit={handleSave}>
            {autoPublished && (
              <div
                className="auth-alert"
                style={{
                  background: "rgba(46, 204, 113, 0.12)",
                  border: "1px solid rgba(46, 204, 113, 0.4)",
                  color: "#2ecc71",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 20 }}>✅</span>
                <div>
                  <strong style={{ fontSize: 14 }}>Anúncio gerado e publicado automaticamente na vitrine!</strong>
                  <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>
                    Título limpo, categoria inteligente, fotos oficiais e resumo por IA foram salvos no catálogo. Caso deseje personalizar algum detalhe, edite os campos abaixo e clique em salvar.
                  </div>
                </div>
              </div>
            )}
            <div className="import-preview-layout">
              {/* Coluna da Imagem e Galeria */}
              <div className="import-preview-image-col">
                {editForm.imageUrl ? (
                  <SafeImage
                    src={editForm.imageUrl}
                    alt={editForm.title}
                    className="preview-img"
                    style={{ aspectRatio: "1/1", objectFit: "cover", borderRadius: "var(--radius-md)" }}
                  />
                ) : (
                  <div className="preview-img" style={{ display: "grid", placeItems: "center", color: "var(--muted)" }}>
                    Sem imagem detectada
                  </div>
                )}

                {/* Miniaturas da Galeria */}
                {Array.isArray(editForm.images) && editForm.images.length > 1 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto", paddingBottom: 4 }}>
                    {editForm.images.slice(0, 5).map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, imageUrl: img })}
                        style={{
                          border: editForm.imageUrl === img ? "2px solid var(--gold)" : "1px solid var(--border)",
                          borderRadius: 6,
                          overflow: "hidden",
                          width: 44,
                          height: 44,
                          flexShrink: 0,
                          cursor: "pointer",
                          background: "none",
                          padding: 0,
                        }}
                      >
                        <SafeImage src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <StoreChip storeName={editForm.storeName} />
                </div>
              </div>

              {/* Informações Principais */}
              <div className="form-grid" style={{ flex: 1 }}>
                <div className="field full">
                  <label htmlFor="pv-title">Nome do Produto</label>
                  <input
                    id="pv-title"
                    className="input"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="pv-category">Categoria</label>
                  <select
                    id="pv-category"
                    className="input"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  >
                    {Object.entries(CATEGORIES).map(([k, c]) => (
                      <option key={k} value={k}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="pv-rating">Avaliação / Nota (0 a 5)</label>
                  <input
                    id="pv-rating"
                    className="input"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={editForm.rating}
                    onChange={(e) => setEditForm({ ...editForm, rating: e.target.value })}
                  />
                </div>

                <div className="field full">
                  <label htmlFor="pv-image-url">URL da foto principal</label>
                  <input
                    id="pv-image-url"
                    className="input"
                    type="url"
                    value={editForm.imageUrl}
                    onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 1: LINKS & OFERTAS MULTI-LOJAS */}
            <div style={{ marginTop: 26, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <LinkIcon width={16} height={16} style={{ color: "var(--gold)" }} />
                    Múltiplos Links de Lojas Cadastradas
                  </h3>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    Cadastre os links do mesmo produto em diferentes lojas. Ao colar cada URL, a loja e o preço são detectados automaticamente!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => addOffer()}
                  className="btn btn-ghost"
                  style={{ fontSize: 13, padding: "6px 14px", height: 38 }}
                >
                  <PlusIcon width={14} height={14} /> + Adicionar link de outra loja
                </button>
              </div>

              {/* Chips de Lojas Rápidas */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                <span className="muted" style={{ fontSize: 12, alignSelf: "center", marginRight: 4 }}>
                  Adicionar por loja:
                </span>
                {STORE_NAMES.map((store) => {
                  const hasOffer = (editForm.offers || []).some(
                    (o) => o.storeName?.toLowerCase() === store.toLowerCase()
                  );
                  return (
                    <button
                      key={store}
                      type="button"
                      onClick={() => handleStoreChipClick(store)}
                      style={{
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "4px 10px",
                        borderRadius: 16,
                        fontSize: 11.5,
                        border: hasOffer ? "1px solid var(--gold)" : "1px solid var(--border)",
                        background: hasOffer ? "rgba(242, 193, 78, 0.15)" : "var(--surface)",
                        color: hasOffer ? "var(--gold)" : "var(--muted)",
                        fontWeight: hasOffer ? 600 : 400,
                      }}
                      title={hasOffer ? `Já possui link da ${store}` : `Adicionar link da ${store}`}
                    >
                      {hasOffer && <CheckIcon width={10} height={10} />}
                      <span>{store}</span>
                      {!hasOffer && <span style={{ opacity: 0.6 }}>+</span>}
                    </button>
                  );
                })}
              </div>

              {/* Cards Horizontais Empilhados de Cada Link */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {editForm.offers.map((offer, idx) => {
                  const isCheapest =
                    offerStats &&
                    offerStats.count > 1 &&
                    Number(offer.price) > 0 &&
                    Math.round(Number(offer.price) * 100) / 100 === offerStats.minPrice;
                  const isScrapingThis = scrapingOfferIndex === idx;

                  return (
                    <div
                      key={offer.id || idx}
                      style={{
                        background: "var(--surface)",
                        border: offer.isPrimary
                          ? "1px solid var(--gold)"
                          : "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        padding: 14,
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 10,
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              background: "rgba(255,255,255,0.06)",
                              padding: "2px 8px",
                              borderRadius: 4,
                              color: "var(--muted)",
                            }}
                          >
                            Link {idx + 1}
                          </span>

                          <StoreChip storeName={offer.storeName} />

                          {isCheapest && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                background: "rgba(46, 204, 113, 0.2)",
                                color: "#2ecc71",
                                border: "1px solid rgba(46, 204, 113, 0.4)",
                                padding: "2px 8px",
                                borderRadius: 12,
                              }}
                            >
                              ★ Menor Preço
                            </span>
                          )}

                          {offer.isPrimary ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                background: "var(--gold)",
                                color: "#000",
                                padding: "2px 8px",
                                borderRadius: 12,
                              }}
                            >
                              Oferta Principal
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPrimaryOffer(idx)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "var(--muted)",
                                fontSize: 11.5,
                                cursor: "pointer",
                                textDecoration: "underline",
                              }}
                            >
                              Definir como principal
                            </button>
                          )}
                        </div>

                        {editForm.offers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeOffer(idx)}
                            className="icon-btn"
                            style={{ width: 32, height: 32, color: "#e74c3c" }}
                            title="Remover este link"
                          >
                            <TrashIcon width={14} height={14} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 140px 140px", gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 11.5, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                            Loja
                          </label>
                          <select
                            className="input"
                            style={{ fontSize: 13, height: 40 }}
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
                          <label style={{ fontSize: 11.5, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                            URL de Afiliado / Compra {isScrapingThis && "⚡ (Buscando preço...)"}
                          </label>
                          <input
                            type="url"
                            className="input"
                            style={{ fontSize: 13, height: 40 }}
                            placeholder="Cole aqui o link desta loja..."
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
                          <label style={{ fontSize: 11.5, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                            Preço Atual (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="input"
                            style={{ fontSize: 13, height: 40, fontWeight: 600, color: "var(--gold)" }}
                            placeholder="Ex: 89.90"
                            value={offer.price}
                            onChange={(e) => updateOfferField(idx, "price", e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 11.5, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                            De / Original (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            style={{ fontSize: 13, height: 40 }}
                            placeholder="Ex: 129.90"
                            value={offer.oldPrice || ""}
                            onChange={(e) => updateOfferField(idx, "oldPrice", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Média de Preço entre Sites */}
              {offerStats && offerStats.count > 0 && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: "var(--radius-md)",
                    background: "rgba(242, 193, 78, 0.05)",
                    border: "1px solid rgba(242, 193, 78, 0.25)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <div className="muted" style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Média entre {offerStats.count} {offerStats.count === 1 ? "loja" : "lojas"}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>
                        {formatBRL(offerStats.avgPrice)}
                      </div>
                    </div>

                    {offerStats.count > 1 && (
                      <>
                        <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 16 }}>
                          <div className="muted" style={{ fontSize: 11.5, textTransform: "uppercase" }}>
                            Menor Preço ({offerStats.cheapestOffer?.storeName})
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#2ecc71" }}>
                            {formatBRL(offerStats.minPrice)}
                          </div>
                        </div>

                        <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 16 }}>
                          <div className="muted" style={{ fontSize: 11.5, textTransform: "uppercase" }}>
                            Economia Máxima
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#2ecc71" }}>
                            {formatBRL(offerStats.savings)} ({offerStats.savingsPct}%)
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleRegenerateAi}
                    className="btn btn-ghost"
                    style={{ fontSize: 12.5, height: 36, padding: "0 12px" }}
                    title="Regera a descrição e a análise da IA com base nos preços e lojas atuais"
                  >
                    <RefreshIcon width={13} height={13} /> Atualizar Resumo por IA
                  </button>
                </div>
              )}
            </div>

            {/* SEÇÃO 2: DESCRIÇÃO E RESUMO INTELIGENTE POR IA */}
            <div style={{ marginTop: 26, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
              <div className="field full" style={{ marginBottom: 16 }}>
                <label htmlFor="pv-desc" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Descrição do Produto</span>
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    Editável pelo curador
                  </span>
                </label>
                <textarea
                  id="pv-desc"
                  className="input"
                  rows={3}
                  style={{ height: "auto", padding: 10, lineHeight: 1.5 }}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Descrição completa do produto..."
                />
              </div>

              <div className="field full">
                <label
                  htmlFor="pv-ai-summary"
                  style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--gold)" }}
                >
                  <SparkIcon width={14} height={14} />
                  <span>Resumo do Produto por IA (Análise de Qualidade, Preço & Veredito)</span>
                </label>
                <textarea
                  id="pv-ai-summary"
                  className="input"
                  rows={4}
                  style={{
                    height: "auto",
                    padding: 12,
                    lineHeight: 1.5,
                    border: "1px solid rgba(242, 193, 78, 0.4)",
                    background: "rgba(242, 193, 78, 0.03)",
                  }}
                  value={editForm.aiSummary}
                  onChange={(e) => setEditForm({ ...editForm, aiSummary: e.target.value })}
                  placeholder="Resumo gerado automaticamente pela The Store AI..."
                />
                <span className="muted" style={{ fontSize: 12, marginTop: 4, display: "block" }}>
                  Este resumo sintetiza o veredito da curadoria e compara a economia entre as lojas cadastradas.
                </span>
              </div>
            </div>

            {/* Botões de Ação */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setPreview(null);
                  setEditForm(null);
                  lastScrapedRef.current = "";
                }}
              >
                Descartar
              </button>
              <button
                type="submit"
                className="btn btn-gold"
                id="btn-confirm-publish"
                disabled={saving}
              >
                {saving ? "Salvando…" : editForm.id ? "Salvar Ajustes do Anúncio" : "Confirmar e Publicar na Vitrine"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
