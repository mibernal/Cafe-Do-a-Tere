"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Info, X } from "lucide-react";
import type { CheckoutOptions, PaymentMethod, Product, ProductCategory, ProductVariant, ShippingZone } from "@/lib/store-types";

export type CartLine = { productId: string; variantId: string; grind: string; quantity: number };
export type ResolvedLine = CartLine & { product: Product; variant: ProductVariant };
export type PendingOrder = { reference: string; trackingPath: string; paymentMethod: PaymentMethod; createdAt: number };
type Toast = { id: number; tone: "success" | "error" | "info"; message: string };
export type CatalogFilter = "all" | ProductCategory;

export type CheckoutDraft = {
  name: string;
  email: string;
  phone: string;
  cityKey: string;
  address: string;
  notes: string;
  wantsInvoice: boolean;
  documentType: string;
  documentNumber: string;
  paymentMethod: PaymentMethod | "";
  privacyConsent: boolean;
};

const emptyDraft: CheckoutDraft = {
  name: "",
  email: "",
  phone: "",
  cityKey: "",
  address: "",
  notes: "",
  wantsInvoice: false,
  documentType: "CC",
  documentNumber: "",
  paymentMethod: "",
  privacyConsent: false,
};

export const MAX_UNITS_PER_LINE = 10;
export const MAX_LINES = 10;
const CART_KEY = "cafe-dona-tere-cart-v2";
const ORDER_KEY = "cafe-dona-tere-last-order";
const PENDING_ORDER_TTL = 3 * 24 * 60 * 60 * 1000;

type StoreContextValue = {
  products: Product[];
  zones: ShippingZone[];
  options: CheckoutOptions;
  lines: ResolvedLine[];
  totalItems: number;
  /** Suma solo de presentaciones con precio confirmado. */
  subtotal: number;
  /** Unidades en la bolsa cuyo precio aún no está confirmado. */
  pendingPriceItems: number;
  addItem: (product: Product, variant: ProductVariant, grind: string) => boolean;
  setQuantity: (variantId: string, grind: string, quantity: number) => void;
  removeItem: (variantId: string, grind: string) => void;
  clearCart: () => void;
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  filter: CatalogFilter;
  setFilter: (filter: CatalogFilter) => void;
  highlight: string | null;
  showProduct: (productId: string) => void;
  notify: (message: string, tone?: Toast["tone"]) => void;
  pendingOrder: PendingOrder | null;
  rememberOrder: (order: PendingOrder | null) => void;
  draft: CheckoutDraft;
  updateDraft: (patch: Partial<CheckoutDraft>) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}

/** Una línea es comprable en línea solo con precio confirmado y unidades disponibles. */
export function isPurchasable(variant: ProductVariant) {
  return variant.priceConfirmed && variant.priceCop > 0 && variant.available;
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* La visita sigue funcionando sin almacenamiento del navegador. */
  }
}

export function StoreProvider({
  products,
  zones,
  options,
  children,
}: {
  products: Product[];
  zones: ShippingZone[];
  options: CheckoutOptions;
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [draft, setDraft] = useState<CheckoutDraft>(emptyDraft);
  const toastId = useRef(0);

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-2), { id, tone, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), tone === "error" ? 6000 : 3200);
  }, []);

  // Restaura la bolsa descartando líneas que ya no existen en el catálogo
  // (un café que se dejó de publicar, una molienda retirada) y avisa.
  useEffect(() => {
    const saved = readStorage<unknown>(CART_KEY, []);
    if (Array.isArray(saved)) {
      const restored = saved
        .filter((line): line is CartLine => {
          if (
            !line ||
            typeof line.productId !== "string" ||
            typeof line.variantId !== "string" ||
            typeof line.grind !== "string" ||
            line.grind.length > 40 ||
            !Number.isInteger(line.quantity) ||
            line.quantity < 1 ||
            line.quantity > MAX_UNITS_PER_LINE
          )
            return false;
          const product = products.find((item) => item.id === line.productId);
          const variant = product?.variants.find((item) => item.id === line.variantId);
          return Boolean(variant?.grinds.includes(line.grind));
        })
        .slice(0, MAX_LINES);
      setCart(restored);
      if (restored.length < saved.length) notify("Retiramos de tu bolsa un café que ya no está disponible.", "info");
    }
    const order = readStorage<PendingOrder | null>(ORDER_KEY, null);
    if (
      order &&
      typeof order.reference === "string" &&
      typeof order.trackingPath === "string" &&
      order.trackingPath.startsWith("/seguimiento/") &&
      Date.now() - order.createdAt < PENDING_ORDER_TTL
    ) {
      setPendingOrder(order);
    }
    setLoaded(true);
  }, [products, notify]);

  useEffect(() => {
    if (loaded) writeStorage(CART_KEY, cart);
  }, [cart, loaded]);

  const lines = useMemo(
    () =>
      cart
        .map((line) => {
          const product = products.find((item) => item.id === line.productId);
          const variant = product?.variants.find((item) => item.id === line.variantId);
          return product && variant ? { ...line, product, variant } : null;
        })
        .filter((line): line is ResolvedLine => line !== null),
    [cart, products],
  );
  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);
  const confirmedLine = (line: ResolvedLine) => line.variant.priceConfirmed && line.variant.priceCop > 0;
  const subtotal = lines.reduce((sum, line) => sum + (confirmedLine(line) ? line.variant.priceCop * line.quantity : 0), 0);
  const pendingPriceItems = lines.reduce((sum, line) => sum + (confirmedLine(line) ? 0 : line.quantity), 0);

  const addItem = useCallback(
    (product: Product, variant: ProductVariant, grind: string) => {
      // Nunca se agrega un café sin una molienda elegida y válida.
      if (!grind || !variant.grinds.includes(grind)) return false;
      if (options.ordersEnabled && !isPurchasable(variant)) return false;
      const existing = cart.find((line) => line.variantId === variant.id && line.grind === grind);
      if (existing && existing.quantity >= MAX_UNITS_PER_LINE) {
        notify(`Puedes llevar hasta ${MAX_UNITS_PER_LINE} unidades de esta presentación por pedido.`, "info");
        return false;
      }
      if (!existing && cart.length >= MAX_LINES) {
        notify("Tu bolsa admite hasta 10 cafés distintos por pedido.", "info");
        return false;
      }
      setCart((current) =>
        current.some((line) => line.variantId === variant.id && line.grind === grind)
          ? current.map((line) =>
              line.variantId === variant.id && line.grind === grind ? { ...line, quantity: line.quantity + 1 } : line,
            )
          : [...current, { productId: product.id, variantId: variant.id, grind, quantity: 1 }],
      );
      notify(`${product.name} ${variant.label} quedó en tu bolsa.`);
      return true;
    },
    [cart, notify, options.ordersEnabled],
  );

  const setQuantity = useCallback(
    (variantId: string, grind: string, quantity: number) => {
      if (quantity > MAX_UNITS_PER_LINE) {
        notify(`Puedes llevar hasta ${MAX_UNITS_PER_LINE} unidades de esta presentación por pedido.`, "info");
        return;
      }
      setCart((current) =>
        current
          .map((line) => (line.variantId === variantId && line.grind === grind ? { ...line, quantity } : line))
          .filter((line) => line.quantity > 0),
      );
    },
    [notify],
  );

  const removeItem = useCallback((variantId: string, grind: string) => {
    setCart((current) => current.filter((line) => line.variantId !== variantId || line.grind !== grind));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const rememberOrder = useCallback((order: PendingOrder | null) => {
    setPendingOrder(order);
    writeStorage(ORDER_KEY, order);
  }, []);

  const showProduct = useCallback((productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setFilter("all");
    setHighlight(productId);
    window.setTimeout(() => {
      document.getElementById(`cafe-${productId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
    window.setTimeout(() => setHighlight((current) => (current === productId ? null : current)), 2600);
  }, [products]);

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const updateDraft = useCallback((patch: Partial<CheckoutDraft>) => setDraft((current) => ({ ...current, ...patch })), []);

  const value: StoreContextValue = {
    products,
    zones,
    options,
    lines,
    totalItems,
    subtotal,
    pendingPriceItems,
    addItem,
    setQuantity,
    removeItem,
    clearCart,
    cartOpen,
    openCart,
    closeCart,
    filter,
    setFilter,
    highlight,
    showProduct,
    notify,
    pendingOrder,
    rememberOrder,
    draft,
    updateDraft,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
            {toast.tone === "success" ? <Check size={16} aria-hidden /> : toast.tone === "error" ? <AlertCircle size={16} aria-hidden /> : <Info size={16} aria-hidden />}
            <span>{toast.message}</span>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}
