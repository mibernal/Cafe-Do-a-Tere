import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Product, ShippingZone } from "@/lib/store-types";
import { freshFetch } from "@/lib/supabase/admin";
import { GRIND_OPTIONS, GROUND_GRIND_VALUES } from "@/lib/grind-options";
import { asset, isStaticSite } from "@/lib/site-target";
import { beansPackFor, packFor, packMatches } from "@/lib/provisional-assets";
import { site } from "@/lib/site";

const ALL_GRINDS = GRIND_OPTIONS.map((option) => option.value);

function referenceVariant(
  id: string,
  label: string,
  weightGrams: number,
  image: string,
  options: { grinds?: string[]; beanImage?: string } = {},
) {
  // Sin base de datos no hay precios: nunca se inventan cifras en el código.
  return {
    id,
    label,
    weightGrams,
    priceCop: 0,
    priceConfirmed: false,
    available: false,
    lowStock: false,
    grinds: options.grinds ?? [...ALL_GRINDS],
    image,
    beanImage: options.beanImage ?? null,
  };
}

/**
 * Catálogo de referencia para explorar la tienda sin base de datos: los tres
 * cafés que la finca ofrece hoy. Los precios no están confirmados y el
 * checkout permanece cerrado. Lavado, Natural y Honey Black existen en la base
 * de datos, ocultos hasta que haya lote.
 */
export const previewCatalog: Product[] = [
  {
    id: "lena",
    slug: "tostado-a-la-lena",
    category: "wood",
    name: "Tostado a la leña",
    subtitle: "La tradición de la casa",
    description:
      "Cacao oscuro, frutos secos y una nota cítrica suave que termina con el carácter inconfundible de la leña.",
    process: "Tostión a la leña",
    origin: "Finca La Libertad, Cachipay",
    altitude: site.altitude,
    notes: ["Cacao", "Frutos secos", "Final ahumado"],
    badge: "El favorito de casa",
    image: "/assets/beans.jpg",
    variants: [
      referenceVariant("lena-250", "250 g", 250, "/assets/pack-lena-250.png", { grinds: [...GROUND_GRIND_VALUES] }),
      referenceVariant("lena-500", "500 g", 500, "/assets/pack-lena-500-ground.png", {
        beanImage: "/assets/pack-lena-500-beans.png",
      }),
    ],
  },
  {
    id: "precision",
    slug: "tostion-de-precision",
    category: "precision",
    name: "Tostión de precisión",
    subtitle: "Una taza luminosa y dulce",
    description:
      "Un perfil amable de naranja y mandarina, acompañado por panela, almendra y chocolate con leche.",
    process: "Tostión media",
    origin: "Finca La Libertad, Cachipay",
    altitude: site.altitude,
    notes: ["Naranja", "Panela", "Almendra"],
    badge: "Perfil de taza",
    image: "/assets/roasting.jpg",
    variants: [
      referenceVariant("precision-500", "500 g", 500, "/assets/pack-precision-500.png", { grinds: [...GROUND_GRIND_VALUES] }),
    ],
  },
  {
    id: "honey-red",
    slug: "honey-red",
    category: "honey",
    name: "Honey Red",
    subtitle: "Microlote de la finca",
    description:
      "Un lote pequeño de la finca en proceso honey: conservamos buena parte del mucílago y secamos el grano con calma. Una taza dulce y redonda, de cuerpo medio-alto y acidez media.",
    process: "Honey Red",
    origin: "Finca La Libertad, Cachipay",
    altitude: site.altitude,
    notes: ["Dulce y redondo", "Cuerpo medio-alto", "Acidez media"],
    badge: "Microlote",
    image: "/assets/cafe-honey-beans-closeup.jpg",
    variants: [
      referenceVariant("honey-red-250", "250 g", 250, "/assets/pack-honey-red-250.png", {
        beanImage: "/assets/pack-honey-red-250-beans.png",
      }),
      referenceVariant("honey-red-500", "500 g", 500, "/assets/pack-honey-red-500.png", {
        beanImage: "/assets/pack-honey-red-500-beans.png",
      }),
    ],
  },
];

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // En el sitio estático la lectura ocurre una vez, durante el build; un
  // fetch "no-store" convertiría la página en dinámica y la exportación fallaría.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: isStaticSite ? fetch : freshFetch },
  });
}

/**
 * Rutas de imagen listas para publicar (con el basePath del sitio estático).
 * Una variante que todavía guarda la ruta de su etiqueta muestra la bolsa
 * empacada con esa etiqueta (ver lib/provisional-assets.ts). Si la bolsa es de
 * otro peso que la presentación, se muestra la foto del café en su lugar.
 */
function withAssetPaths(products: Product[]): Product[] {
  return products.map((product) => ({
    ...product,
    image: asset(product.image),
    variants: product.variants.map((variant) => {
      const pack = packFor(variant.image);
      const label = isMissingAsset(pack) || !packMatches(pack, variant) ? product.image : pack;
      const sellsBeans = variant.grinds.includes("En grano");
      const beans = variant.beanImage ? packFor(variant.beanImage) : sellsBeans ? beansPackFor(pack) : null;
      const beanImage = beans && !isMissingAsset(beans) && packMatches(beans, variant) ? beans : null;
      return { ...variant, image: asset(label), beanImage: beanImage ? asset(beanImage) : null };
    }),
  }));
}

/**
 * Una presentación creada desde el panel puede apuntar a una etiqueta que
 * todavía no está en public/ (por ejemplo, un 250 g nuevo). En el sitio
 * estático se comprueba al construir y se usa la foto del café en su lugar,
 * para no publicar imágenes rotas.
 */
function isMissingAsset(path: string) {
  if (!isStaticSite || !path.startsWith("/assets/")) return false;
  const missing = !existsSync(join(process.cwd(), "public", path));
  if (missing) console.warn(`[catalog] Falta ${path} en public/: se usa la foto del café.`);
  return missing;
}

/**
 * En el sitio estático un catálogo que no se pudo leer detiene el build: es
 * mejor dejar publicada la versión anterior que publicar una tienda vacía.
 */
function catalogUnavailable(message: string, cause?: unknown): Product[] {
  if (isStaticSite) throw new Error(`[catalog] ${message}`, { cause });
  console.error(`[catalog] ${message}`, cause ?? "");
  return [];
}

type CatalogRow = {
  product_id: string;
  slug: string;
  category: Product["category"];
  name: string;
  subtitle: string;
  description: string;
  process: string;
  origin: string;
  altitude: string;
  notes: string[] | null;
  badge: string;
  image_url: string;
  variant_id: string;
  variant_label: string;
  weight_grams: number;
  price_cop: number | string | null;
  price_confirmed: boolean;
  available_stock: number | null;
  low_stock: boolean | null;
  grinds: string[] | null;
  variant_image_url: string | null;
  bean_image_url: string | null;
};

/**
 * La altura de Finca La Libertad está confirmada (lib/site.ts). Un café de la
 * finca que todavía dice "por confirmar" en la base (la migración 006 lo
 * corrige) muestra la altura de la finca; cualquier otro valor se respeta.
 */
function farmAltitude(row: Pick<CatalogRow, "altitude" | "origin">) {
  const pending = !row.altitude?.trim() || /por confirmar/i.test(row.altitude);
  return pending && row.origin?.startsWith(site.farm) ? site.altitude : row.altitude;
}

export function isPreviewCatalog() {
  return publicClient() === null;
}

export async function getCatalog(): Promise<Product[]> {
  const supabase = publicClient();
  if (!supabase) {
    if (isStaticSite) console.warn("[catalog] Sin Supabase configurado: se publica el catálogo de referencia.");
    return withAssetPaths(previewCatalog);
  }

  let data: unknown;
  try {
    const result = await supabase.rpc("storefront_catalog_items");
    if (result.error) return catalogUnavailable(`No fue posible leer el catálogo: ${result.error.message}`);
    data = result.data;
  } catch (cause) {
    // Una falla del catálogo en vivo no debe mostrar precios de referencia como vigentes.
    return catalogUnavailable("Error inesperado al leer el catálogo", cause);
  }
  if (!Array.isArray(data)) return catalogUnavailable("La respuesta del catálogo no es una lista");

  const products = new Map<string, Product>();
  for (const row of data as CatalogRow[]) {
    let product = products.get(row.product_id);
    if (!product) {
      product = {
        id: row.product_id,
        slug: row.slug,
        category: row.category,
        name: row.name,
        subtitle: row.subtitle,
        description: row.description,
        process: row.process,
        origin: row.origin,
        altitude: farmAltitude(row),
        notes: row.notes ?? [],
        badge: row.badge,
        image: row.image_url,
        variants: [],
      };
      products.set(product.id, product);
    }
    product.variants.push({
      id: row.variant_id,
      label: row.variant_label,
      weightGrams: row.weight_grams,
      priceCop: Number(row.price_cop ?? 0),
      priceConfirmed: row.price_confirmed,
      available: Number(row.available_stock ?? 0) > 0,
      lowStock: Boolean(row.low_stock),
      grinds: row.grinds?.length ? row.grinds : ["En grano"],
      image: row.variant_image_url ?? row.image_url,
      beanImage: row.bean_image_url,
    });
  }
  if (isStaticSite && products.size === 0) return catalogUnavailable("El catálogo publicado está vacío");
  return withAssetPaths([...products.values()]);
}

export async function getShippingZones(): Promise<ShippingZone[]> {
  const supabase = publicClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("storefront_shipping_zones");
    if (error || !Array.isArray(data)) return [];
    return (data as { city_key: string; city_label: string; price_cop: number | string; cod_enabled: boolean; eta_label: string | null }[]).map(
      (row) => ({
        cityKey: row.city_key,
        cityLabel: row.city_label,
        priceCop: Number(row.price_cop),
        codEnabled: Boolean(row.cod_enabled),
        etaLabel: row.eta_label ?? "",
      }),
    );
  } catch {
    return [];
  }
}
