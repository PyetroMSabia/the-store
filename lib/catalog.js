/** Categorias da vitrine e sugestão automática de categoria pelo título. */

export const CATEGORIES = {
  clothing: { label: "Roupas & Calçados", short: "Roupas" },
  accessories: { label: "Acessórios", short: "Acessórios" },
  electronics: { label: "Eletrônicos", short: "Eletrônicos" },
  furniture: { label: "Casa & Móveis", short: "Casa" },
  beauty: { label: "Beleza & Cuidados", short: "Beleza" },
  other: { label: "Outros achados", short: "Outros" },
};

/** Abas do catálogo (topo + filtro). */
export const TABS = [
  { key: "todos", label: "Ver tudo" },
  { key: "novidades", label: "Novidades" },
  { key: "clothing", label: "Roupas" },
  { key: "accessories", label: "Acessórios" },
  { key: "electronics", label: "Eletrônicos" },
  { key: "furniture", label: "Casa" },
  { key: "beauty", label: "Beleza" },
  { key: "other", label: "Outros" },
  { key: "ofertas", label: "Ofertas" },
];

const fold = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// A ordem importa: "relógio inteligente" deve cair em eletrônicos antes de "relógio" (acessórios).
const RULES = [
  ["electronics", "fone|headset|headphone|earbuds?|airpods|smartwatch|smart watch|relogio inteligente|smartband|celular|smartphone|iphone|galaxy|redmi|xiaomi|carregador|cabo usb|power ?bank|notebook|laptop|tablet|ipad|teclado|mouse|monitor|caixa de som|speaker|bluetooth|projetor|camera|webcam|ssd|hd externo|pen ?drive|console|playstation|xbox|nintendo|controle|smart tv|televisao|alexa|echo dot|kindle|roteador|microfone|ring light|drone|gamer|placa de video|processador"],
  ["beauty", "perfume|batom|maquiagem|rimel|mascara de cilios|serum|hidratante|protetor solar|shampoo|condicionador|skin ?care|esmalte|secador|chapinha|prancha de cabelo|sabonete|desodorante|paleta de sombras?|delineador|corretivo|po compacto|creme|oleo capilar|body splash|base liquida|pincel de maquiagem|cilios"],
  ["clothing", "vestido|camisa|camiseta|blusa|calca|shorts?|bermuda|saia|jaqueta|casaco|moletom|cropped|conjunto|biquini|maio|lingerie|sutia|calcinha|cueca|meias?|pijama|tenis|sapato|sandalia|chinelo|bota|sapatilha|salto|scarpin|blazer|regata|legging|body|jeans|sueter|cardigan|trench ?coat|macacao|polo"],
  ["accessories", "bolsa|mochila|carteira|relogio|oculos|colar|brincos?|pulseira|anel|aneis|cinto|bone|chapeu|lenco|joias?|bijuterias?|pingente|necessaire|mala de viagem|tiara|piercing"],
  ["furniture", "mesa|cadeira|estante|sofa|poltrona|luminaria|abajur|tapete|cortina|prateleira|organizador|rack|cama|colchao|travesseiro|almofada|quadro|espelho|panela|cozinha|utensilios?|decoracao|vaso|banqueta|escrivaninha|guarda-?roupa|armario|jogo de cama|toalha|edredom|lencol|garrafa termica|copo termico|airfryer|air fryer|liquidificador|cafeteira"],
];
const COMPILED = RULES.map(([cat, words]) => [cat, new RegExp(`\\b(${words})\\b`)]);

export function guessCategory(title) {
  const t = fold(title);
  for (const [cat, re] of COMPILED) if (re.test(t)) return cat;
  return "other";
}

export { fold };
