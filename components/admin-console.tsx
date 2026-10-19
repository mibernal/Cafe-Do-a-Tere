"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, ChevronDown, MessageCircle, Plus, Save } from "lucide-react";
import { formatCOP } from "@/lib/money";
import { GRIND_OPTIONS, getGrindOption } from "@/lib/grind-options";
import { orderStatusLabels, paymentMethodLabels } from "@/lib/order-labels";

export type AdminVariant = {
  id: string;
  label: string;
  weightGrams: number;
  priceCop: number;
  priceConfirmed: boolean;
  stockOnHand: number;
  stockReserved: number;
  grinds: string[];
  active: boolean;
};
export type AdminProduct = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  notes: string[];
  badge: string;
  published: boolean;
  sortOrder: number;
  variants: AdminVariant[];
};
export type AdminOrder = {
  id: string;
  reference: string;
  status: string;
  payment_method: string;
  payment_review_reason: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_document_type: string | null;
  customer_document_number: string | null;
  city: string;
  address: string;
  delivery_notes: string;
  subtotal_cop: number;
  shipping_cop: number;
  total_cop: number;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  wompi_transaction_id: string | null;
  courier_tracking_url: string | null;
  courier_name: string | null;
  courier_tracking_code: string | null;
  cancelled_reason: string | null;
  order_items: { product_name: string; variant_label: string; grind: string; quantity: number; line_total_cop: number }[] | null;
};
export type AdminShippingRate = { city_key: string; city_label: string; price_cop: number; is_active: boolean; cod_enabled: boolean; eta_label: string };

async function send(url: string, method: "POST" | "PATCH", body: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.assign("/admin/login");
    throw new Error("Tu sesión terminó.");
  }
  if (!response.ok) throw new Error(payload.error || "No se pudo guardar el cambio.");
  return payload;
}

function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "ok", text: success });
      router.refresh();
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? cause.message : "No se pudo guardar el cambio." });
    } finally {
      setBusy(null);
    }
  }
  return { busy, message, run };
}

function Feedback({ message }: { message: { tone: "ok" | "error"; text: string } | null }) {
  if (!message) return null;
  return (
    <p className={message.tone === "ok" ? "admin-feedback is-ok" : "admin-feedback is-error"} role={message.tone === "ok" ? "status" : "alert"}>
      {message.tone === "ok" && <Check size={15} aria-hidden />}
      {message.text}
    </p>
  );
}

const fmtDate = (value: string) =>
  new Date(value).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

/* ------------------------------------------------------------------ Pedidos */

const orderTabs = [
  { id: "todo", label: "Por atender", statuses: ["COD_PENDING", "PAID", "PAYMENT_REVIEW", "PREPARING"] },
  { id: "camino", label: "En camino", statuses: ["SHIPPED"] },
  { id: "pago", label: "Esperando pago", statuses: ["AWAITING_PAYMENT"] },
  { id: "cerrados", label: "Cerrados", statuses: ["DELIVERED", "CANCELLED", "REFUNDED"] },
  { id: "todos", label: "Todos", statuses: [] as string[] },
] as const;

function OrderActions({ order, onDone }: { order: AdminOrder; onDone: ReturnType<typeof useMutation>["run"] }) {
  const [closeMode, setCloseMode] = useState<"cancel" | "refund" | null>(null);
  const cod = order.payment_method === "CASH_ON_DELIVERY";
  const paid = Boolean(order.paid_at);
  const advance = (status: string, extra: Record<string, string> = {}, label: string) =>
    onDone(order.id, () => send("/api/admin/orders", "PATCH", { action: "advance", orderId: order.id, status, ...extra }), label);

  const canCancel = !paid && (["AWAITING_PAYMENT", "COD_PENDING"].includes(order.status) || (cod && ["PREPARING", "SHIPPED"].includes(order.status)));
  const canRefund = paid && ["PAID", "PAYMENT_REVIEW", "PREPARING", "SHIPPED", "DELIVERED"].includes(order.status);

  return (
    <div className="order-actions">
      {order.status === "COD_PENDING" && (
        <button type="button" className="button button-primary button-small" onClick={() => advance("PREPARING", {}, "Pedido confirmado y en preparación.")}>
          Confirmado con el cliente: preparar
        </button>
      )}
      {order.status === "PAID" && (
        <button type="button" className="button button-primary button-small" onClick={() => advance("PREPARING", {}, "Pedido en preparación.")}>
          Pasar a preparación
        </button>
      )}
      {order.status === "PAYMENT_REVIEW" && (
        <button type="button" className="button button-primary button-small" onClick={() => advance("PREPARING", {}, "Stock validado; pedido en preparación.")}>
          Validar stock y preparar
        </button>
      )}
      {order.status === "PREPARING" && (
        <form
          className="ship-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            advance(
              "SHIPPED",
              {
                courierName: String(form.get("courierName") ?? ""),
                trackingCode: String(form.get("trackingCode") ?? ""),
                trackingUrl: String(form.get("trackingUrl") ?? ""),
              },
              "Pedido marcado como despachado.",
            );
          }}
        >
          <input name="courierName" placeholder="Transportadora o mensajero" maxLength={80} aria-label="Transportadora o mensajero" />
          <input name="trackingCode" placeholder="Número de guía (opcional)" maxLength={80} aria-label="Número de guía" />
          <input name="trackingUrl" type="url" placeholder="Enlace de rastreo https:// (opcional)" maxLength={500} aria-label="Enlace de rastreo" />
          <button type="submit" className="button button-primary button-small">
            Marcar despachado
          </button>
        </form>
      )}
      {order.status === "SHIPPED" && (
        <button
          type="button"
          className="button button-primary button-small"
          onClick={() => advance("DELIVERED", {}, cod ? "Entregado y pago contra entrega registrado." : "Pedido entregado.")}
        >
          {cod ? "Entregado y pago recibido" : "Marcar entregado"}
        </button>
      )}
      {order.payment_review_reason && order.status !== "PAYMENT_REVIEW" && (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            const note = String(new FormData(event.currentTarget).get("note") ?? "");
            onDone(order.id, () => send("/api/admin/orders", "PATCH", { action: "resolve", orderId: order.id, note }), "Novedad marcada como resuelta.");
          }}
        >
          <input name="note" required minLength={3} maxLength={200} placeholder="Cómo se resolvió la novedad" aria-label="Cómo se resolvió la novedad" />
          <button type="submit" className="button button-outline button-small">
            Marcar resuelta
          </button>
        </form>
      )}
      {(canCancel || canRefund) && !closeMode && (
        <div className="close-links">
          {canCancel && (
            <button type="button" className="text-button danger-link" onClick={() => setCloseMode("cancel")}>
              Cancelar pedido
            </button>
          )}
          {canRefund && (
            <button type="button" className="text-button danger-link" onClick={() => setCloseMode("refund")}>
              Registrar reembolso
            </button>
          )}
        </div>
      )}
      {closeMode && (
        <form
          className="close-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            onDone(
              order.id,
              () =>
                send("/api/admin/orders", "PATCH", {
                  action: closeMode,
                  orderId: order.id,
                  reason: String(form.get("reason") ?? ""),
                  restock: form.get("restock") === "on",
                }),
              closeMode === "cancel" ? "Pedido cancelado." : "Reembolso registrado.",
            );
          }}
        >
          <p>
            {closeMode === "cancel"
              ? "El cliente verá el pedido como cancelado."
              : "Primero haz el reembolso en el dashboard de Wompi; aquí solo queda registrado."}
          </p>
          <input name="reason" required minLength={3} maxLength={200} placeholder="Motivo (queda en el historial interno)" aria-label="Motivo" />
          {(closeMode === "refund" || ["PREPARING", "SHIPPED"].includes(order.status)) && order.status !== "PAYMENT_REVIEW" && (
            <label className="check">
              <input type="checkbox" name="restock" defaultChecked={order.status !== "DELIVERED"} />
              <span>Devolver las unidades al inventario</span>
            </label>
          )}
          <div>
            <button type="submit" className="button button-danger button-small">
              {closeMode === "cancel" ? "Confirmar cancelación" : "Confirmar reembolso"}
            </button>
            <button type="button" className="text-button" onClick={() => setCloseMode(null)}>
              Volver
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function OrdersBoard({ orders }: { orders: AdminOrder[] }) {
  const [tab, setTab] = useState<(typeof orderTabs)[number]["id"]>("todo");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { busy, message, run } = useMutation();

  const counts = useMemo(
    () => Object.fromEntries(orderTabs.map((item) => [item.id, item.statuses.length ? orders.filter((order) => (item.statuses as readonly string[]).includes(order.status)).length : orders.length])),
    [orders],
  );
  const current = orderTabs.find((item) => item.id === tab)!;
  const term = query.trim().toLowerCase();
  const visible = orders.filter(
    (order) =>
      (current.statuses.length === 0 || (current.statuses as readonly string[]).includes(order.status)) &&
      (!term ||
        order.reference.toLowerCase().includes(term) ||
        order.customer_name.toLowerCase().includes(term) ||
        order.customer_phone.includes(term) ||
        order.city.toLowerCase().includes(term)),
  );

  return (
    <div className="orders-board">
      <div className="board-toolbar">
        <div className="segmented" role="tablist" aria-label="Filtrar pedidos">
          {orderTabs.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}>
              {item.label} <span>{counts[item.id]}</span>
            </button>
          ))}
        </div>
        <input type="search" className="board-search" placeholder="Buscar por pedido, cliente, celular o ciudad" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar pedidos" />
      </div>
      <Feedback message={message} />
      {visible.length === 0 ? (
        <p className="admin-empty">No hay pedidos en esta vista.</p>
      ) : (
        <ul className="order-list">
          {visible.map((order) => {
            const expanded = open === order.id;
            const units = (order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0);
            return (
              <li key={order.id} className={`order-row${expanded ? " is-open" : ""}${busy === order.id ? " is-busy" : ""}`}>
                <button type="button" className="order-summary-row" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : order.id)}>
                  <span className="order-ref">
                    <b>{order.reference}</b>
                    <small>{fmtDate(order.created_at)}</small>
                  </span>
                  <span className="order-customer">
                    {order.customer_name}
                    <small>
                      {order.city}, {units} {units === 1 ? "unidad" : "unidades"}
                    </small>
                  </span>
                  <span className={`pill pill-${order.payment_method === "CASH_ON_DELIVERY" ? "cod" : "wompi"}`}>
                    {order.payment_method === "CASH_ON_DELIVERY" ? "Contra entrega" : "Wompi"}
                  </span>
                  <span className={`status-badge status-${order.status.toLowerCase()}`}>{orderStatusLabels[order.status] ?? order.status}</span>
                  <b className="order-total">{formatCOP(Number(order.total_cop))}</b>
                  <ChevronDown size={18} aria-hidden className="order-chevron" />
                </button>
                {order.payment_review_reason && <p className="review-flag">{order.payment_review_reason}</p>}
                {expanded && (
                  <div className="order-detail">
                    <div className="order-detail-grid">
                      <div>
                        <h4>Productos</h4>
                        <ul className="order-items">
                          {(order.order_items ?? []).map((item, index) => (
                            <li key={index}>
                              <b>{item.quantity} ×</b> {item.product_name}, {item.variant_label}
                              <small>{getGrindOption(item.grind).method === "En grano" ? "En grano" : `Molienda ${getGrindOption(item.grind).method}`}</small>
                            </li>
                          ))}
                        </ul>
                        <p className="order-money">
                          Productos {formatCOP(Number(order.subtotal_cop))}, domicilio {formatCOP(Number(order.shipping_cop))}
                        </p>
                      </div>
                      <div>
                        <h4>Entrega</h4>
                        <p>
                          {order.address}, {order.city}
                          {order.delivery_notes && <small>Indicaciones: {order.delivery_notes}</small>}
                        </p>
                        <p className="contact-links">
                          <a href={`https://wa.me/57${order.customer_phone}?text=${encodeURIComponent(`Hola ${order.customer_name.split(" ")[0]}, te escribimos de Café Doña Tere por tu pedido ${order.reference}.`)}`} target="_blank" rel="noopener noreferrer">
                            <MessageCircle size={14} aria-hidden /> {order.customer_phone}
                          </a>
                          <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a>
                        </p>
                        {order.customer_document_number && (
                          <p>
                            <small>
                              Factura a {order.customer_document_type} {order.customer_document_number}
                            </small>
                          </p>
                        )}
                      </div>
                      <div>
                        <h4>Pago</h4>
                        <p>
                          {paymentMethodLabels[order.payment_method] ?? order.payment_method}
                          <small>{order.paid_at ? `Recibido el ${fmtDate(order.paid_at)}` : order.status === "AWAITING_PAYMENT" || order.status === "COD_PENDING" ? `Reserva hasta ${fmtDate(order.expires_at)}` : "Sin pago registrado"}</small>
                          {order.wompi_transaction_id && <small>Transacción Wompi {order.wompi_transaction_id}</small>}
                          {order.courier_name && <small>Despacho: {order.courier_name} {order.courier_tracking_code ?? ""}</small>}
                          {order.cancelled_reason && <small>Motivo de cierre: {order.cancelled_reason}</small>}
                        </p>
                      </div>
                    </div>
                    <OrderActions order={order} onDone={run} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Inventario */

export function InventoryTable({ products }: { products: AdminProduct[] }) {
  const { busy, message, run } = useMutation();
  const rows = products.flatMap((product) => product.variants.map((variant) => ({ product, variant })));
  return (
    <div className="admin-table-wrap">
      <Feedback message={message} />
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Café</th>
            <th scope="col">Precio</th>
            <th scope="col">En bodega</th>
            <th scope="col">Reservado</th>
            <th scope="col">Disponible</th>
            <th scope="col">Ajustar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ product, variant }) => {
            const available = variant.stockOnHand - variant.stockReserved;
            return (
              <tr key={variant.id} className={!variant.active || !product.published ? "is-muted" : undefined}>
                <th scope="row">
                  {product.name}
                  <small>
                    {variant.label}
                    {!variant.active ? ", inactiva" : ""}
                    {!product.published ? ", producto oculto" : ""}
                  </small>
                </th>
                <td>{variant.priceConfirmed ? formatCOP(variant.priceCop) : <span className="pill pill-warn">Sin confirmar</span>}</td>
                <td>{variant.stockOnHand}</td>
                <td>{variant.stockReserved}</td>
                <td>
                  <b className={available <= 0 ? "stock-zero" : available <= 5 ? "stock-low" : undefined}>{available}</b>
                </td>
                <td>
                  <form
                    className="inline-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      const target = event.currentTarget;
                      run(
                        variant.id,
                        async () => {
                          await send("/api/admin/inventory", "POST", {
                            variantId: variant.id,
                            delta: Number(form.get("delta")),
                            note: String(form.get("note") ?? ""),
                          });
                          target.reset();
                        },
                        `Inventario de ${product.name} ${variant.label} actualizado.`,
                      );
                    }}
                  >
                    <input type="number" name="delta" min={-10000} max={10000} step={1} required placeholder="+12 o -2" aria-label={`Unidades a sumar o restar en ${product.name} ${variant.label}`} />
                    <input name="note" minLength={2} maxLength={200} required placeholder="Motivo: tostión, ajuste…" aria-label="Motivo del ajuste" />
                    <button type="submit" className="button button-outline button-small" disabled={busy === variant.id} aria-label="Guardar ajuste">
                      <Save size={14} aria-hidden />
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- Catálogo */

function GrindChecklist({ selected, name }: { selected: string[]; name: string }) {
  return (
    <fieldset className="grind-admin">
      <legend>Moliendas disponibles</legend>
      <div>
        {GRIND_OPTIONS.map((option) => (
          <label key={option.value} className="check">
            <input type="checkbox" name={name} value={option.value} defaultChecked={selected.includes(option.value)} />
            <span>{option.method === "En grano" ? "En grano" : `${option.method} (${option.texture.toLowerCase()})`}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CatalogManager({ products }: { products: AdminProduct[] }) {
  const { busy, message, run } = useMutation();
  return (
    <div className="catalog-manager">
      <Feedback message={message} />
      {products.map((product) => (
        <details key={product.id} className="product-admin">
          <summary>
            <span>
              <b>{product.name}</b>
              <small>
                {product.variants.length} {product.variants.length === 1 ? "presentación" : "presentaciones"},{" "}
                {product.variants.filter((variant) => variant.priceConfirmed && variant.active).length} con precio confirmado
              </small>
            </span>
            <span className={product.published ? "pill pill-ok" : "pill"}>{product.published ? "Publicado" : "Oculto"}</span>
          </summary>

          <form
            className="admin-form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              run(
                `product-${product.id}`,
                () =>
                  send("/api/admin/catalog", "PATCH", {
                    productId: product.id,
                    name: String(form.get("name") ?? ""),
                    subtitle: String(form.get("subtitle") ?? ""),
                    description: String(form.get("description") ?? ""),
                    notes: String(form.get("notes") ?? "")
                      .split(",")
                      .map((note) => note.trim())
                      .filter(Boolean)
                      .slice(0, 5),
                    badge: String(form.get("badge") ?? ""),
                    published: form.get("published") === "on",
                    sortOrder: Number(form.get("sortOrder") ?? 0),
                  }),
                `${product.name} actualizado.`,
              );
            }}
          >
            <label className="field">
              <span>Nombre</span>
              <input name="name" defaultValue={product.name} minLength={2} maxLength={80} required />
            </label>
            <label className="field">
              <span>Frase corta</span>
              <input name="subtitle" defaultValue={product.subtitle} maxLength={120} />
            </label>
            <label className="field field-wide">
              <span>Descripción</span>
              <textarea name="description" defaultValue={product.description} maxLength={600} rows={3} />
            </label>
            <label className="field">
              <span>Notas de taza (separadas por coma, máx. 5)</span>
              <input name="notes" defaultValue={product.notes.join(", ")} maxLength={220} />
            </label>
            <label className="field">
              <span>Distintivo</span>
              <input name="badge" defaultValue={product.badge} maxLength={40} placeholder="Ej. Edición limitada" />
            </label>
            <label className="field field-narrow">
              <span>Orden</span>
              <input name="sortOrder" type="number" min={0} max={1000} defaultValue={product.sortOrder} required />
            </label>
            <label className="check">
              <input type="checkbox" name="published" defaultChecked={product.published} />
              <span>Publicado en la tienda</span>
            </label>
            <button type="submit" className="button button-primary button-small" disabled={busy === `product-${product.id}`}>
              Guardar producto
            </button>
          </form>

          <h4 className="variants-title">Presentaciones</h4>
          {product.variants.map((variant) => (
            <form
              key={variant.id}
              className="variant-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                run(
                  variant.id,
                  () =>
                    send("/api/admin/catalog", "PATCH", {
                      variantId: variant.id,
                      label: String(form.get("label") ?? ""),
                      weightGrams: Number(form.get("weightGrams")),
                      priceCop: Number(form.get("priceCop") || 0),
                      priceConfirmed: form.get("priceConfirmed") === "on",
                      active: form.get("active") === "on",
                      grinds: form.getAll("grinds").map(String),
                    }),
                  `${product.name} ${String(form.get("label"))} guardado.`,
                );
              }}
            >
              <div className="variant-fields">
                <label className="field">
                  <span>Presentación</span>
                  <input name="label" defaultValue={variant.label} minLength={2} maxLength={60} required />
                </label>
                <label className="field field-narrow">
                  <span>Peso (g)</span>
                  <input name="weightGrams" type="number" min={50} max={20000} defaultValue={variant.weightGrams} required />
                </label>
                <label className="field">
                  <span>Precio (COP)</span>
                  <input name="priceCop" type="number" min={0} max={100000000} step={100} defaultValue={variant.priceCop || ""} placeholder="0" />
                </label>
                <label className="check">
                  <input type="checkbox" name="priceConfirmed" defaultChecked={variant.priceConfirmed} />
                  <span>Precio confirmado (se puede pagar)</span>
                </label>
                <label className="check">
                  <input type="checkbox" name="active" defaultChecked={variant.active} />
                  <span>Activa</span>
                </label>
              </div>
              <GrindChecklist selected={variant.grinds} name="grinds" />
              <button type="submit" className="button button-outline button-small" disabled={busy === variant.id}>
                Guardar presentación
              </button>
            </form>
          ))}

          <form
            className="variant-form variant-new"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const target = event.currentTarget;
              run(
                `new-${product.id}`,
                async () => {
                  await send("/api/admin/catalog", "POST", {
                    productId: product.id,
                    label: String(form.get("label") ?? ""),
                    weightGrams: Number(form.get("weightGrams")),
                    priceCop: Number(form.get("priceCop") || 0),
                    grinds: form.getAll("grinds").map(String),
                  });
                  target.reset();
                },
                "Presentación creada. Confirma su precio y carga inventario para venderla.",
              );
            }}
          >
            <p className="variant-new-title">
              <Plus size={15} aria-hidden /> Nueva presentación de {product.name}
            </p>
            <div className="variant-fields">
              <label className="field">
                <span>Presentación</span>
                <input name="label" minLength={2} maxLength={60} required placeholder="Ej. 1 kg" />
              </label>
              <label className="field field-narrow">
                <span>Peso (g)</span>
                <input name="weightGrams" type="number" min={50} max={20000} required placeholder="1000" />
              </label>
              <label className="field">
                <span>Precio (COP)</span>
                <input name="priceCop" type="number" min={0} max={100000000} step={100} placeholder="0" />
              </label>
            </div>
            <GrindChecklist selected={GRIND_OPTIONS.map((option) => option.value)} name="grinds" />
            <button type="submit" className="button button-outline button-small" disabled={busy === `new-${product.id}`}>
              Crear presentación
            </button>
          </form>
        </details>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Envíos */

export function ShippingRatesTable({ rates }: { rates: AdminShippingRate[] }) {
  const { busy, message, run } = useMutation();
  function row(rate?: AdminShippingRate) {
    const key = rate?.city_key ?? "new";
    return (
      <form
        key={key}
        className={rate ? "rate-form" : "rate-form rate-new"}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const target = event.currentTarget;
          run(
            key,
            async () => {
              await send("/api/admin/shipping", "PATCH", {
                cityKey: rate?.city_key,
                cityLabel: String(form.get("cityLabel") ?? ""),
                priceCop: Number(form.get("priceCop")),
                etaLabel: String(form.get("etaLabel") ?? ""),
                codEnabled: form.get("codEnabled") === "on",
                active: form.get("active") === "on",
              });
              if (!rate) target.reset();
            },
            "Tarifa guardada.",
          );
        }}
      >
        <label className="field">
          <span>Ciudad o municipio</span>
          <input name="cityLabel" defaultValue={rate?.city_label ?? ""} minLength={2} maxLength={80} required placeholder="Ej. Bogotá" />
        </label>
        <label className="field field-narrow">
          <span>Domicilio (COP)</span>
          <input name="priceCop" type="number" min={0} max={100000000} step={100} defaultValue={rate?.price_cop ?? ""} required placeholder="12000" />
        </label>
        <label className="field">
          <span>Tiempo estimado</span>
          <input name="etaLabel" defaultValue={rate?.eta_label ?? ""} maxLength={60} placeholder="Ej. 1 a 2 días hábiles" />
        </label>
        <label className="check">
          <input type="checkbox" name="codEnabled" defaultChecked={rate?.cod_enabled ?? false} />
          <span>Contra entrega</span>
        </label>
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={rate?.is_active ?? true} />
          <span>Activa</span>
        </label>
        <button type="submit" className="button button-outline button-small" disabled={busy === key}>
          {rate ? "Guardar" : "Agregar ciudad"}
        </button>
      </form>
    );
  }
  return (
    <div className="rates">
      <Feedback message={message} />
      {rates.map((rate) => row(rate))}
      {row()}
    </div>
  );
}
