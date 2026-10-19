export type ProductCategory = "wood" | "precision" | "honey" | "washed" | "natural" | "gift";

export type ProductVariant = {
  id: string;
  label: string;
  weightGrams: number;
  priceCop: number;
  priceConfirmed: boolean;
  /** Hay unidades disponibles (el catálogo público nunca expone conteos). */
  available: boolean;
  /** Quedan cinco unidades o menos. */
  lowStock: boolean;
  grinds: string[];
  image: string;
  /** Etiqueta alternativa cuando se elige café en grano. */
  beanImage: string | null;
};

export type Product = {
  id: string;
  slug: string;
  category: ProductCategory;
  name: string;
  subtitle: string;
  description: string;
  process: string;
  origin: string;
  altitude: string;
  notes: string[];
  badge: string;
  image: string;
  variants: ProductVariant[];
};

export type ShippingZone = {
  cityKey: string;
  cityLabel: string;
  priceCop: number;
  codEnabled: boolean;
  etaLabel: string;
};

export type PaymentMethod = "WOMPI" | "CASH_ON_DELIVERY";

export type CheckoutOptions = {
  /** Se pueden crear pedidos en línea (al menos un medio de pago listo). */
  ordersEnabled: boolean;
  wompiEnabled: boolean;
  codEnabled: boolean;
  codMaxCop: number;
};

export type DocumentType = "CC" | "CE" | "NIT" | "PP" | "TI";
