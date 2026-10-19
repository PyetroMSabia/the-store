"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import ProductEditor from "./ProductEditor";
import QuickImport from "./QuickImport";
import { StoreChip, Stars, Seal } from "../ProductUI";
import { EditIcon, ExternalIcon, LogoutIcon, PlusIcon, TrashIcon } from "../Icons";
import { CATEGORIES } from "@/lib/catalog";
import { formatBRL, isTopRated } from "@/lib/offers";
import { useUser } from "../UserContext";
import SafeImage from "../SafeImage";

export default function AdminDashboard({ products = [], stats = {} }) {
  const router = useRouter();
  const { logout } = useUser();
  const [editing, setEditing] = useState(null); // null | "new" | product
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const f = filter.toLowerCase().trim();
    if (!f) return products;
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(f) ||
        p.storeName.toLowerCase().includes(f) ||
        (CATEGORIES[p.category]?.label || "").toLowerCase().includes(f)
    );
  }, [products, filter]);

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function remove(p) {
    if (!confirm(`Excluir permanentemente o produto "${p.title}"?`)) return;
    try {
      const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
      if (res.ok) {
        notify("Produto excluído com sucesso.");
        router.refresh();
      }
    } catch {
      notify("Erro ao excluir produto.");
    }
  }

  const sealedCount = products.filter(isTopRated).length;

  return (
    <div className="reveal">
      <div className="admin-head">
        <div>
          <span className="eyebrow" style={{ marginBottom: 6 }}>
            Acesso Restrito · Perfil Administrador (RBAC)
          </span>
          <h1>
            Painel da <span className="gold-text">Curadoria</span>
          </h1>
          <p className="muted">
            Cadastre ofertas, importe produtos diretamente por link e acompanhe métricas de conversão.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" onClick={logout} id="admin-logout">
            <LogoutIcon width={16} height={16} /> Sair
          </button>
          <button className="btn btn-gold" onClick={() => setEditing("new")} id="admin-new">
            <PlusIcon width={16} height={16} /> Cadastro Manual
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpis">
        <div className="kpi">
          <span>Produtos selecionados</span>
          <strong>{products.length}</strong>
          <small className="muted">Itens na vitrine</small>
        </div>
        <div className="kpi">
          <span>Lojas parceiras</span>
          <strong>{stats.stores || 0}</strong>
          <small className="muted">Mercados integrados</small>
        </div>
        <div className="kpi">
          <span>Com Selo (Nota ≥ 4.7)</span>
          <strong className="gold-text">{sealedCount}</strong>
          <small className="muted">Altamente recomendados</small>
        </div>
        <div className="kpi">
          <span>Cliques de Afiliado</span>
          <strong>{stats.clicks || 0}</strong>
          <small className="muted">Redirecionamentos gerados</small>
        </div>
      </div>

      {/* Seção de Importação Rápida por URL */}
      <QuickImport
        onCreated={(msg) => {
          notify(msg);
          router.refresh();
        }}
      />

      {/* Filtro e Listagem */}
      <div className="controls" style={{ marginTop: 32 }}>
        <input
          className="input"
          style={{ maxWidth: 360 }}
          placeholder="Filtrar por título, loja ou categoria…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          id="admin-filter"
        />
        <span className="muted" style={{ fontSize: 13 }}>
          Exibindo {visible.length} de {products.length} produtos cadastrados
        </span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 64 }}>Foto</th>
              <th>Produto</th>
              <th>Loja</th>
              <th>Preço</th>
              <th>Nota</th>
              <th>Selo</th>
              <th>Cliques</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visible.length > 0 ? (
              visible.map((p) => (
                <tr key={p.id}>
                  <td>
                    <SafeImage
                      className="thumb"
                      src={p.imageUrl}
                      alt={p.title}
                    />
                  </td>
                  <td>
                    <b>{p.title}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {CATEGORIES[p.category]?.label || p.category}
                    </div>
                  </td>
                  <td>
                    <StoreChip storeName={p.storeName} />
                  </td>
                  <td>
                    <b>{formatBRL(p.price)}</b>
                    {p.oldPrice && (
                      <div className="old-price" style={{ fontSize: 12 }}>
                        {formatBRL(p.oldPrice)}
                      </div>
                    )}
                  </td>
                  <td>
                    {p.rating != null ? <Stars rating={p.rating} /> : <span className="muted">—</span>}
                  </td>
                  <td>{isTopRated(p) ? <Seal /> : <span className="muted">Normal</span>}</td>
                  <td>
                    <strong>{p.clicks || 0}</strong>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link
                        href={`/produto/${p.id}`}
                        target="_blank"
                        className="icon-btn"
                        aria-label="Ver na loja"
                        title="Ver na loja"
                      >
                        <ExternalIcon />
                      </Link>
                      <button
                        className="icon-btn"
                        aria-label="Editar"
                        title="Editar produto"
                        onClick={() => setEditing(p)}
                        id={`edit-${p.id}`}
                      >
                        <EditIcon />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Excluir"
                        title="Excluir produto"
                        onClick={() => remove(p)}
                        id={`delete-${p.id}`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "40px 20px" }} className="muted">
                  Nenhum produto cadastrado ainda. Use o campo de importação acima para publicar sua primeira oferta real!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductEditor
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            notify(msg);
            router.refresh();
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
