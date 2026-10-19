import Link from "next/link";
import { ArrowRight, ScaleIcon, ShieldIcon, TruckIcon } from "@/components/Icons";
import { MIN_RATING } from "@/lib/offers";

export const metadata = {
  title: "Como funciona a The Store",
  description: "Entenda o Selo Compra Validada, nossa curadoria de ofertas e nossa transparência com links afiliados.",
};

export default function AjudaPage() {
  return (
    <div className="prose reveal">
      <nav className="breadcrumbs" aria-label="Trilha">
        <Link href="/">Início</Link> <span>/</span>
        <span style={{ color: "var(--text)" }}>Como funciona</span>
      </nav>

      <h1>
        O Grande Diferencial da <span className="gold-text">The Store</span>
      </h1>
      <p>
        Para que você não precise abrir vários aplicativos (como Mercado Livre, Shopee, Amazon ou Shein) e se perder
        em dezenas de anúncios repetidos ou ofertas duvidosas, a <strong>The Store</strong> entrega três vantagens claras:
      </p>

      <h2>1. Selo "Compra Validada"</h2>
      <p>
        Aplicamos um critério de curadoria rigoroso antes de disponibilizar qualquer produto em nossa vitrine:
      </p>
      <ul>
        <li>
          <strong>Nota de avaliação:</strong> apenas anúncios com nota igual ou superior a{" "}
          <code>{MIN_RATING} estrelas</code> recebem o selo dourado.
        </li>
        <li>
          <strong>Procedência e Loja Oficial:</strong> verificação da loja de origem (Shopee Oficial, Mercado Livre Oficial, Amazon, Shein, etc.).
        </li>
        <li>
          <strong>Preço Real e Transparente:</strong> exibição do preço atual sem maquiagem e do histórico quando em promoção.
        </li>
      </ul>

      <h2>2. Agregador Oficial de Afiliados</h2>
      <p>
        Reunimos as melhores oportunidades das maiores lojas online em um único lugar. Você navega pelo catálogo unificado,
        salva seus produtos em <strong>Favoritos</strong> e gerencia seus itens desejados no <strong>Carrinho</strong>.
      </p>

      <div className="how" style={{ margin: "28px 0" }}>
        <div className="how-card">
          <div className="how-icon"><ShieldIcon /></div>
          <h3>Curadoria Verificada</h3>
          <p>Todos os itens são rigorosamente selecionados e validados por nossa equipe.</p>
        </div>
        <div className="how-card">
          <div className="how-icon"><ScaleIcon /></div>
          <h3>Preços e Ofertas Claras</h3>
          <p>Identificamos descontos comprovados e calculamos a economia em relação ao preço anterior.</p>
        </div>
        <div className="how-card">
          <div className="how-icon"><TruckIcon /></div>
          <h3>Compra na Loja Oficial</h3>
          <p>O pagamento, o estoque e a entrega são 100% garantidos pela plataforma parceira oficial.</p>
        </div>
      </div>

      <h2 id="afiliados">3. Transparência & Links Parceiros</h2>
      <p>
        A The Store funciona por meio de <strong>programas oficiais de afiliados</strong> (Shopee, Shein, Mercado Livre,
        Amazon, Magalu e outros).
      </p>
      <p>
        Quando você clica em <em>“Ir para a loja”</em> ou <em>“Comprar”</em>, você é direcionado diretamente para o
        site ou app oficial do parceiro através de um link rastreado seguro. Caso realize a compra, a loja parceira pode
        nos repassar uma pequena porcentagem em comissão — <strong>sem você pagar nem um centavo a mais pelo produto</strong>.
      </p>

      <div style={{ marginTop: 36 }}>
        <Link href="/?cat=todos#catalogo" className="btn btn-gold">
          Explorar Catálogo Validado <ArrowRight width={16} height={16} />
        </Link>
      </div>
    </div>
  );
}
