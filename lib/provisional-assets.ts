import type { Product } from "@/lib/store-types";

/**
 * Imágenes de producto empacado (public/assets/pack-*.png): la bolsa con la
 * etiqueta aplicada, una por presentación y molienda. Se generan con
 * scripts/packaging/ a partir de las etiquetas cafe-*-front.jpg.
 *
 * Cada etiqueta conocida apunta a su bolsa, así una variante que en la base
 * de datos todavía guarda la ruta de la etiqueta muestra igual la bolsa.
 */
const PACKS = [
  "lena-250",
  "lena-500-ground",
  "lena-500-beans",
  "precision-250",
  "precision-500",
  ...["honey-red", "honey-black", "lavado", "natural"].flatMap((coffee) =>
    [250, 500].flatMap((weight) => [`${coffee}-${weight}`, `${coffee}-${weight}-beans`]),
  ),
];

const LABEL_TO_PACK: Record<string, string> = Object.fromEntries(
  PACKS.map((name) => [`/assets/cafe-${name}-front.jpg`, `/assets/pack-${name}.png`]),
);

/** Ruta de la bolsa para una etiqueta conocida; cualquier otra ruta no cambia. */
export function packFor(path: string) {
  return LABEL_TO_PACK[path] ?? path;
}

/**
 * Bolsas cuya etiqueta es ilustrativa: se derivaron de las etiquetas
 * originales (Tostado a la leña 250 g y 500 g, Tostión de precisión 500 g)
 * mientras llegan los empaques definitivos. La tienda las muestra con el
 * aviso «Empaque ilustrativo».
 *
 * Para publicar la definitiva, reemplaza la etiqueta cafe-*-front.jpg,
 * vuelve a generar la bolsa (scripts/packaging/README.md) y quita el nombre
 * de esta lista.
 */
export const ILLUSTRATIVE_PACKS = new Set([
  "pack-precision-250.png",
  ...["honey-red", "honey-black", "lavado", "natural"].flatMap((coffee) =>
    [250, 500].flatMap((weight) => [`pack-${coffee}-${weight}.png`, `pack-${coffee}-${weight}-beans.png`]),
  ),
]);

function fileName(src: string) {
  return src.split(/[?#]/)[0].split("/").pop() ?? "";
}

/** Imagen de bolsa empacada (PNG con transparencia). */
export function isPackShot(src: string) {
  return /^pack-[^/]+\.png$/.test(fileName(src));
}

/** Bolsa o etiqueta: se muestra como empaque y no como foto de fondo. */
export function isPackArt(src: string) {
  return isPackShot(src) || src.endsWith("-front.jpg");
}

export function isIllustrativePack(src: string) {
  return ILLUSTRATIVE_PACKS.has(fileName(src));
}

/** Bolsa de la presentación más grande de un café (para la portada y el comparador). */
export function largestPack(product: Product) {
  const variants = product.variants.filter((variant) => isPackArt(variant.image));
  if (!variants.length) return undefined;
  return variants.reduce((big, variant) => (variant.weightGrams > big.weightGrams ? variant : big)).image;
}

/** Peso en gramos que muestra una bolsa o etiqueta, según su nombre de archivo. */
export function packWeight(src: string) {
  const match = /-(\d+)(?:-ground|-beans)?(?:-front)?\.(?:png|jpe?g)$/.exec(fileName(src));
  return match ? Number(match[1]) : null;
}

/**
 * Una bolsa solo se muestra si su peso coincide con el de la presentación
 * (el peso guardado y, si lo trae, el nombre visible, p. ej. «340 g»). Así una
 * presentación nueva o editada en el panel nunca muestra la bolsa de otro peso.
 */
export function packMatches(src: string, variant: { weightGrams: number; label: string }) {
  const weight = packWeight(src);
  if (weight === null) return true;
  const labelGrams = /(\d+)\s*g\b/i.exec(variant.label);
  return weight === variant.weightGrams && (!labelGrams || Number(labelGrams[1]) === weight);
}

const KNOWN_PACKS = new Set(Object.values(LABEL_TO_PACK));

/**
 * Bolsa en grano que acompaña a una bolsa molida del mismo café y peso, si
 * existe. Sirve para variantes que venden "En grano" pero aún no tienen
 * bean_image_url en la base (p. ej. antes de aplicar la migración 008).
 */
export function beansPackFor(pack: string) {
  const candidate = pack.replace(/(?:-ground)?\.png$/, "-beans.png");
  return candidate !== pack && KNOWN_PACKS.has(candidate) ? candidate : null;
}
