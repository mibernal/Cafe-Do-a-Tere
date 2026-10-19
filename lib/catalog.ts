import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Product, ShippingZone } from "@/lib/store-types";
import { freshFetch } from "@/lib/supabase/admin";
import { GRIND_OPTIONS, GROUND_GRIND_VALUES } from "@/lib/grind-options";

const ALL_GRINDS = GRIND_OPTIONS.map((option) => option.value);

function referenceVariant(
  id: string,
  label: string,
  weightGrams: number,
  image: string,
  options: { priceCop?: number; grinds?: string[]; beanImage?: string } = {},
) {
  return {
    id,
    label,
    weightGrams,
    priceCop: options.priceCop ?? 0,
    priceConfirmed: false,
    available: false,
    lowStock: false,
    grinds: options.grinds ?? [...ALL_GRINDS],
    image,
    beanImage: options.beanImage ?? null,
  };
}

/**
 * Catálogo de referencia para explorar la tienda sin base de datos. Los
 * precios no están confirmados y el checkout permanece cerrado.
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
    altitude: "1.450–1.650 m s. n. m.",
    notes: ["Cacao", "Frutos secos", "Final ahumado"],
    badge: "El favorito de casa",
    image: "/assets/beans.jpg",
    variants: [
      referenceVariant("lena-250", "250 g", 250, "/assets/cafe-lena-250-front.jpg", { grinds: [...GROUND_GRIND_VALUES] }),
      referenceVariant("lena-500", "500 g", 500, "/assets/cafe-lena-500-ground-front.jpg", {
        priceCop: 40000,
        beanImage: "/assets/cafe-lena-500-beans-front.jpg",
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
    altitude: "Altura por confirmar",
    notes: ["Naranja", "Panela", "Almendra"],
    badge: "Perfil de taza",
    image: "/assets/roasting.jpg",
    variants: [
      referenceVariant("precision-500", "500 g", 500, "/assets/cafe-precision-500-front.jpg", { grinds: [...GROUND_GRIND_VALUES] }),
    ],
  },
  {
    id: "honey",
    slug: "microlote-honey",
    category: "honey",
    name: "Microlote Honey",
    subtitle: "Una edición para descubrir",
    description:
      "Una expresión pequeña de la finca: cuerpo medio-alto, acidez media y una taza para tomar sin afán.",
    process: "Honey, microlote",
    origin: "Finca La Libertad, Cachipay",
    altitude: "Altura por confirmar",
    notes: ["Cuerpo medio-alto", "Acidez media", "Lote pequeño"],
    badge: "Edición limitada",
    image: "/assets/cafe-honey-beans-closeup.jpg",
    variants: [
      referenceVariant("honey-340", "340 g (referencia)", 340, "/assets/cafe-honey-beans-closeup.jpg", {
        priceCop: 35000,
        grinds: [...GROUND_GRIND_VALUES],
      }),
    ],
  },
  {
    id: "lavado",
    slug: "proceso-lavado",
    category: "washed",
    name: "Proceso Lavado",
    subtitle: "Limpio, brillante y equilibrado",
    description:
      "El método clásico de Colombia: el grano se despulpa, se fermenta y se lava antes del secado. El resultado es una taza limpia, de acidez brillante y dulzor equilibrado.",
    process: "Lavado",
    origin: "Finca La Libertad, Cachipay",
    altitude: "Altura por confirmar",
    notes: ["Taza limpia", "Acidez brillante", "Dulzor equilibrado"],
    badge: "Nuevo proceso",
    image: "/assets/beans.jpg",
    variants: [
      referenceVariant("lavado-250", "250 g", 250, "/assets/cafe-lavado-250-front.jpg"),
      referenceVariant("lavado-500", "500 g", 500, "/assets/cafe-lavado-500-front.jpg"),
    ],
  },
  {
    id: "natural",
    slug: "proceso-natural",
    category: "natural",
    name: "Proceso Natural",
    subtitle: "Fruta madura y cuerpo sedoso",
    description:
      "La cereza se seca entera, sin despulpar, para que la fruta entregue sus azúcares al grano. Una taza intensa y dulce, con recuerdos de fruta, chocolate y caramelo.",
    process: "Natural",
    origin: "Finca La Libertad, Cachipay",
    altitude: "Altura por confirmar",
    notes: ["Fruta madura", "Chocolate", "Caramelo"],
    badge: "Nuevo proceso",
    image: "/assets/beans-closeup.jpg",
    variants: [
      referenceVariant("natural-250", "250 g", 250, "/assets/cafe-natural-250-front.jpg"),
      referenceVariant("natural-500", "500 g", 500, "/assets/cafe-natural-500-front.jpg"),
    ],
  },
  {
    id: "honey-red",
    slug: "honey-red",
    category: "honey",
    name: "Honey Red",
    subtitle: "Dulzor profundo, secado pausado",
    description:
      "Conservamos buena parte del mucílago y secamos el grano con calma. Una taza dulce y redonda, con más cuerpo que el honey clásico y notas de fruta roja y panela.",
    process: "Honey Red",
    origin: "Finca La Libertad, Cachipay",
    altitude: "Altura por confirmar",
    notes: ["Fruta roja", "Panela", "Cuerpo redondo"],
    badge: "Microlote",
    image: "/assets/cafe-honey-beans-closeup.jpg",
    variants: [
      referenceVariant("honey-red-250", "250 g", 250, "/assets/cafe-honey-red-250-front.jpg"),
      referenceVariant("honey-red-500", "500 g", 500, "/assets/cafe-honey-red-500-front.jpg"),
    ],
  },
  {
    id: "honey-black",
    slug: "honey-black",
    category: "honey",
    name: "Honey Black",
    subtitle: "La expresión más intensa",
    description:
      "El grano se seca con todo su mucílago, lentamente y protegido del sol directo. Es el honey de mayor dulzor y cuerpo: fruta confitada, melaza y un final largo.",
    process: "Honey Black",
    origin: "Finca La Libertad, Cachipay",
    altitude: "Altura por confirmar",
    notes: ["Fruta confitada", "Melaza", "Final largo"],
    badge: "Edición limitada",
    image: "/assets/roasting.jpg",
    variants: [
      referenceVariant("honey-black-250", "250 g", 250, "/assets/cafe-honey-black-250-front.jpg"),
      referenceVariant("honey-black-500", "500 g", 500, "/assets/cafe-honey-black-500-front.jpg"),
    ],
  },
];

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: freshFetch } });
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

export function isPreviewCatalog() {
  return publicClient() === null;
}

export async function getCatalog(): Promise<Product[]> {
  const supabase = publicClient();
  if (!supabase) return previewCatalog;

  try {
    const { data, error } = await supabase.rpc("storefront_catalog_items");
    if (error || !Array.isArray(data)) {
      console.error("[catalog] No fue posible leer el catálogo", error?.message);
      return [];
    }
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
          altitude: row.altitude,
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
    return [...products.values()];
  } catch (cause) {
    // Una falla del catálogo en vivo no debe mostrar precios de referencia como vigentes.
    console.error("[catalog] Error inesperado", cause);
    return [];
  }
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
