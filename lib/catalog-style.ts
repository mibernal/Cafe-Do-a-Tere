import type { Product, ProductCategory } from "@/lib/store-types";

/**
 * Cada perfil conserva el color de la banda de su etiqueta. Se usa para la
 * cinta del nombre, el fondo de la tarjeta y los filtros.
 */
const productBands: Record<string, string> = {
  lena: "#4a2b1c",
  precision: "#b8792a",
  honey: "#c98a2c",
  "honey-red": "#a03a28",
  "honey-black": "#2b211c",
  lavado: "#3d6b5f",
  natural: "#7a2e3a",
};

const categoryBands: Record<ProductCategory, string> = {
  wood: "#4a2b1c",
  precision: "#b8792a",
  honey: "#c98a2c",
  washed: "#3d6b5f",
  natural: "#7a2e3a",
  gift: "#56634a",
};

export function productBand(product: Pick<Product, "id" | "category">) {
  return productBands[product.id] ?? categoryBands[product.category] ?? "#56634a";
}

function luminance(hex: string) {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)!
    .map((part) => parseInt(part, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Texto legible sobre la banda: tinta café en bandas claras, crema en oscuras. */
export function bandInk(color: string) {
  return luminance(color) > 0.2 ? "#2b1b12" : "#f7eddc";
}

/** Variables CSS de la banda de un producto (color y color de texto). */
export function bandVars(colorOrProduct: string | Pick<Product, "id" | "category">) {
  const color = typeof colorOrProduct === "string" ? colorOrProduct : productBand(colorOrProduct);
  return { "--band": color, "--band-ink": bandInk(color) } as React.CSSProperties;
}

export const categoryFilters: { id: "all" | ProductCategory; label: string; band?: string }[] = [
  { id: "all", label: "Todos" },
  { id: "wood", label: "A la leña", band: categoryBands.wood },
  { id: "precision", label: "Precisión", band: categoryBands.precision },
  { id: "honey", label: "Honey", band: categoryBands.honey },
  { id: "washed", label: "Lavado", band: categoryBands.washed },
  { id: "natural", label: "Natural", band: categoryBands.natural },
];

/** Recorrido de procesos: de menos a más fruta acompañando al grano en el secado. */
export const processSpectrum = [
  {
    productId: "lavado",
    name: "Lavado",
    fruit: "Sin mucílago",
    text: "Se despulpa, fermenta y lava. Taza limpia y de acidez brillante.",
  },
  {
    productId: "honey",
    name: "Honey",
    fruit: "Parte del mucílago",
    text: "Se seca con algo de la miel del fruto. Más cuerpo, acidez media.",
  },
  {
    productId: "honey-red",
    name: "Honey Red",
    fruit: "Buena parte del mucílago",
    text: "Secado más lento. Dulzor profundo y notas de fruta roja.",
  },
  {
    productId: "honey-black",
    name: "Honey Black",
    fruit: "Todo el mucílago",
    text: "Secado pausado a la sombra. El honey más dulce e intenso.",
  },
  {
    productId: "natural",
    name: "Natural",
    fruit: "La cereza entera",
    text: "El fruto se seca completo. Taza frutal, dulce y de cuerpo sedoso.",
  },
] as const;

/** Cuántos procesos del recorrido están publicados (la sección pide al menos tres). */
export function spectrumStopCount(products: Pick<Product, "id">[]) {
  return processSpectrum.filter((stop) => products.some((product) => product.id === stop.productId)).length;
}
