"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Banknote, CreditCard, Lock, MessageCircle, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import type { PaymentMethod } from "@/lib/store-types";
import { formatCOP } from "@/lib/money";
import { grindPhrase } from "@/lib/grind-options";
import { normalizeColombianMobile } from "@/lib/phone";
import { site, whatsappLink } from "@/lib/site";
import { productBand, bandVars } from "@/lib/catalog-style";
import { MAX_UNITS_PER_LINE, isPurchasable, useStore, type ResolvedLine } from "@/components/store/store-provider";

type Step = "bag" | "details" | "review";
type CheckoutResult = {
  paymentMethod: PaymentMethod;
  reference: string;
  trackingToken: string;
  subtotalCop: number;
  shippingCop: number;
  totalCop: number;
  checkout?: { action: string; fields: [string, string][] };
};

const WOMPI_METHODS = ["Tarjeta débito o crédito", "PSE", "Nequi", "Botón Bancolombia", "Efectivo en corresponsal"];

function linePrice(line: ResolvedLine) {
  return line.variant.priceConfirmed && line.variant.priceCop > 0 ? line.variant.priceCop * line.quantity : null;
}

/** Mensaje de WhatsApp con el detalle de la bolsa. Solo incluye precios confirmados. */
function whatsappOrderMessage(lines: ResolvedLine[], subtotal: number, pendingPriceItems: number) {
  const items = lines
    .map((line) => {
      const price = linePrice(line);
      return `• ${line.quantity} × ${line.product.name}, ${line.variant.label}, ${grindPhrase(line.grind)}: ${price === null ? "precio por confirmar" : formatCOP(price)}`;
    })
    .join("\n");
  const totals = [
    subtotal > 0 ? `Subtotal de precios confirmados: ${formatCOP(subtotal)}` : "",
    pendingPriceItems > 0 ? `Por confirmar: ${pendingPriceItems === 1 ? "1 café" : `${pendingPriceItems} cafés`}.` : "",
  ].filter(Boolean);
  return `Hola, Café Doña Tere. Quiero hacer este pedido:\n${items}${totals.length ? `\n${totals.join("\n")}` : ""}\n\nMi ciudad de entrega es: `;
}

export function CartDrawer() {
  const {
    lines,
    totalItems,
    subtotal,
    pendingPriceItems,
    cartOpen,
    closeCart,
    options,
    zones,
    draft,
    updateDraft,
    setQuantity,
    removeItem,
    clearCart,
    rememberOrder,
    notify,
  } = useStore();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const wompiFormRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<Step>("bag");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (cartOpen && !dialog.open) dialog.showModal();
    if (!cartOpen && dialog.open) dialog.close();
  }, [cartOpen]);

  useEffect(() => {
    if (redirecting && result?.checkout) wompiFormRef.current?.submit();
  }, [redirecting, result]);

  // Al volver desde Wompi con el botón "atrás" el navegador puede restaurar
  // esta página desde caché: se limpia el estado de redirección.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      setRedirecting(false);
      setResult(null);
      setStep("bag");
      closeCart();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [closeCart]);

  const zone = zones.find((item) => item.cityKey === draft.cityKey) ?? null;
  const estimatedTotal = subtotal + (zone?.priceCop ?? 0);
  const blockedLines = options.ordersEnabled ? lines.filter((line) => !isPurchasable(line.variant)) : [];
  const onlineCheckout = options.ordersEnabled && zones.length > 0;

  const methods = useMemo(() => {
    const list: { id: PaymentMethod; available: boolean; reason: string }[] = [];
    if (options.wompiEnabled) list.push({ id: "WOMPI", available: true, reason: "" });
    if (options.codEnabled) {
      let reason = "";
      if (!zone) reason = "Elige tu ciudad para saber si aplica.";
      else if (!zone.codEnabled) reason = `No disponible en ${zone.cityLabel}.`;
      else if (estimatedTotal > options.codMaxCop) reason = `Disponible para pedidos hasta ${formatCOP(options.codMaxCop)}.`;
      list.push({ id: "CASH_ON_DELIVERY", available: reason === "", reason });
    }
    return list;
  }, [options, zone, estimatedTotal]);

  // Mantiene seleccionado un medio de pago disponible.
  useEffect(() => {
    const current = methods.find((method) => method.id === draft.paymentMethod);
    if (!current || !current.available) {
      const first = methods.find((method) => method.available);
      if ((first?.id ?? "") !== draft.paymentMethod) updateDraft({ paymentMethod: first?.id ?? "" });
    }
  }, [methods, draft.paymentMethod, updateDraft]);

  function close() {
    closeCart();
    if (step === "review") return;
    setStep("bag");
    setError("");
  }

  async function releaseReservation(token: string) {
    try {
      await fetch("/api/checkout/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } catch {
      /* La reserva vence sola en 35 minutos. */
    }
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const phone = normalizeColombianMobile(draft.phone);
    if (!phone) {
      setError("Escribe un celular colombiano de 10 dígitos, por ejemplo 300 123 4567.");
      return;
    }
    if (!zone) {
      setError("Elige la ciudad de entrega.");
      return;
    }
    if (!draft.paymentMethod) {
      setError("Elige cómo quieres pagar.");
      return;
    }
    if (draft.wantsInvoice && !/^[0-9A-Za-z-]{4,20}$/.test(draft.documentNumber.trim())) {
      setError("Revisa el número de documento para la factura.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            name: draft.name,
            email: draft.email,
            phone,
            cityKey: draft.cityKey,
            address: draft.address,
            notes: draft.notes,
            documentType: draft.wantsInvoice ? draft.documentType : "",
            documentNumber: draft.wantsInvoice ? draft.documentNumber.trim() : "",
          },
          paymentMethod: draft.paymentMethod,
          privacyConsent: draft.privacyConsent,
          items: lines.map((line) => ({ variantId: line.variant.id, grind: line.grind, quantity: line.quantity })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "No pudimos registrar el pedido. Intenta de nuevo.");
      const data = payload as CheckoutResult;
      const trackingPath = `/seguimiento/${encodeURIComponent(data.trackingToken)}`;
      rememberOrder({ reference: data.reference, trackingPath, paymentMethod: data.paymentMethod, createdAt: Date.now() });

      if (data.paymentMethod === "CASH_ON_DELIVERY") {
        clearCart();
        closeCart();
        setStep("bag");
        notify("Recibimos tu pedido contra entrega.");
        router.push(trackingPath);
        return;
      }
      setResult(data);
      if (data.totalCop === estimatedTotal) {
        clearCart();
        setRedirecting(true);
      } else {
        // El precio cambió desde que cargó la página: el cliente decide con el total real.
        setStep("review");
      }
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? "No pudimos conectarnos. Revisa tu conexión a internet e intenta de nuevo."
          : cause instanceof Error
            ? cause.message
            : "No pudimos registrar el pedido. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function editOrder() {
    if (!result) return;
    setBusy(true);
    await releaseReservation(result.trackingToken);
    rememberOrder(null);
    setResult(null);
    setBusy(false);
    setStep("bag");
  }

  const headerTitle = step === "bag" ? "Tu bolsa" : step === "details" ? "Entrega y pago" : "Confirma el total";

  return (
    <dialog
      ref={dialogRef}
      className="cart-drawer"
      aria-labelledby="cart-title"
      onClose={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="drawer-panel">
        <header className="drawer-head">
          {step === "details" ? (
            <button type="button" className="icon-button" onClick={() => setStep("bag")} aria-label="Volver a la bolsa">
              <ArrowLeft size={19} aria-hidden />
            </button>
          ) : (
            <span className="drawer-icon" aria-hidden>
              <ShoppingBag size={18} />
            </span>
          )}
          <h2 id="cart-title">
            {headerTitle}
            {step === "bag" && totalItems > 0 && <small>{totalItems === 1 ? "1 café" : `${totalItems} cafés`}</small>}
          </h2>
          <button type="button" className="icon-button" onClick={close} aria-label="Cerrar bolsa">
            <X size={20} aria-hidden />
          </button>
        </header>

        {redirecting ? (
          <div className="drawer-empty">
            <Lock size={26} aria-hidden />
            <h3>Abriendo el pago seguro de Wompi…</h3>
            <p>Si no avanza en unos segundos, usa el botón.</p>
            <button type="button" className="button button-primary" onClick={() => wompiFormRef.current?.submit()}>
              Ir a Wompi
            </button>
          </div>
        ) : step === "review" && result ? (
          <div className="drawer-scroll">
            <div className="review-box">
              <p>
                Actualizamos los precios antes de cobrar. Este es el total de tu pedido <b>{result.reference}</b>:
              </p>
              <Totals subtotal={result.subtotalCop} shipping={result.shippingCop} total={result.totalCop} city={zone?.cityLabel} />
              <button
                type="button"
                className="button button-primary button-block"
                onClick={() => {
                  clearCart();
                  setRedirecting(true);
                }}
              >
                <Lock size={16} aria-hidden />
                Pagar {formatCOP(result.totalCop)} con Wompi
              </button>
              <button type="button" className="text-button" onClick={editOrder} disabled={busy}>
                Editar el pedido
              </button>
            </div>
          </div>
        ) : lines.length === 0 ? (
          <div className="drawer-empty">
            <span className="empty-mark" aria-hidden>
              <ShoppingBag size={24} />
            </span>
            <h3>Tu bolsa está vacía</h3>
            <p>
              {onlineCheckout
                ? "Elige un café de la finca y la molienda para tu método."
                : "Elige café, presentación y molienda. Cuando tengas tu bolsa, la envías por WhatsApp y confirmamos el pedido contigo."}
            </p>
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                close();
                document.getElementById("cafes")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Ver los cafés
            </button>
          </div>
        ) : step === "bag" ? (
          <>
            <div className="drawer-scroll">
              <ul className="cart-lines">
                {lines.map((line) => {
                  const blocked = blockedLines.includes(line);
                  const image = line.grind === "En grano" && line.variant.beanImage ? line.variant.beanImage : line.variant.image;
                  return (
                    <li key={`${line.variant.id}-${line.grind}`} className={blocked ? "cart-line is-blocked" : "cart-line"}>
                      <span className="cart-thumb" style={bandVars(line.product)}>
                        <Image src={image} alt="" fill sizes="72px" />
                      </span>
                      <div className="cart-line-body">
                        <div className="cart-line-top">
                          <b>{line.product.name}</b>
                          <span className={linePrice(line) === null ? "price-pending" : undefined}>
                            {linePrice(line) === null ? "Precio por confirmar" : formatCOP(linePrice(line)!)}
                          </span>
                        </div>
                        <small>
                          {line.variant.label}, {grindPhrase(line.grind)}
                        </small>
                        {blocked && <small className="line-warning">Ya no está disponible para pago en línea.</small>}
                        <div className="cart-line-actions">
                          <div className="stepper" role="group" aria-label={`Cantidad de ${line.product.name}`}>
                            <button
                              type="button"
                              aria-label="Quitar una unidad"
                              onClick={() => setQuantity(line.variant.id, line.grind, line.quantity - 1)}
                            >
                              <Minus size={14} aria-hidden />
                            </button>
                            <output aria-live="polite">{line.quantity}</output>
                            <button
                              type="button"
                              aria-label="Agregar una unidad"
                              disabled={line.quantity >= MAX_UNITS_PER_LINE || blocked}
                              onClick={() => setQuantity(line.variant.id, line.grind, line.quantity + 1)}
                            >
                              <Plus size={14} aria-hidden />
                            </button>
                          </div>
                          <button type="button" className="remove-button" onClick={() => removeItem(line.variant.id, line.grind)}>
                            <Trash2 size={14} aria-hidden />
                            Quitar
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <footer className="drawer-foot">
              <div className="foot-row">
                <span>{subtotal === 0 ? "Total" : pendingPriceItems > 0 ? "Subtotal confirmado" : "Subtotal"}</span>
                <b>{subtotal > 0 ? formatCOP(subtotal) : "Por confirmar"}</b>
              </div>
              {pendingPriceItems > 0 && subtotal > 0 && (
                <p className="foot-note">
                  {pendingPriceItems === 1 ? "1 café tiene" : `${pendingPriceItems} cafés tienen`} el precio por confirmar.
                </p>
              )}
              {onlineCheckout ? (
                <>
                  <p className="foot-note">El domicilio se suma según tu ciudad en el siguiente paso.</p>
                  <button
                    type="button"
                    className="button button-primary button-block"
                    disabled={blockedLines.length > 0}
                    onClick={() => {
                      setError("");
                      setStep("details");
                    }}
                  >
                    Continuar con la entrega
                  </button>
                  {blockedLines.length > 0 && (
                    <p className="foot-note">Quita los cafés que ya no están disponibles para continuar.</p>
                  )}
                </>
              ) : (
                <>
                  <p className="foot-note">
                    Esta página no cobra. Al enviar tu bolsa por WhatsApp te confirmamos precio, disponibilidad,
                    domicilio y forma de pago.
                  </p>
                  <a
                    className="button button-primary button-block"
                    href={whatsappLink(whatsappOrderMessage(lines, subtotal, pendingPriceItems))}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle size={17} aria-hidden />
                    Enviar pedido por WhatsApp
                  </a>
                </>
              )}
            </footer>
          </>
        ) : (
          <form className="checkout-form" onSubmit={submitOrder}>
            <div className="drawer-scroll">
              <fieldset className="form-group">
                <legend>¿Quién recibe?</legend>
                <label className="field">
                  <span>Nombre completo</span>
                  <input
                    name="name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    required
                    value={draft.name}
                    onChange={(event) => updateDraft({ name: event.target.value })}
                  />
                </label>
                <div className="field-pair">
                  <label className="field">
                    <span>Celular</span>
                    <input
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      placeholder="300 123 4567"
                      minLength={10}
                      maxLength={20}
                      required
                      value={draft.phone}
                      onChange={(event) => updateDraft({ phone: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Correo</span>
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      required
                      value={draft.email}
                      onChange={(event) => updateDraft({ email: event.target.value })}
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="form-group">
                <legend>¿A dónde lo llevamos?</legend>
                <label className="field">
                  <span>Ciudad o municipio</span>
                  <select
                    name="city"
                    required
                    value={draft.cityKey}
                    onChange={(event) => updateDraft({ cityKey: event.target.value })}
                  >
                    <option value="">Elige tu ciudad</option>
                    {zones.map((item) => (
                      <option key={item.cityKey} value={item.cityKey}>
                        {item.cityLabel} ({item.priceCop > 0 ? formatCOP(item.priceCop) : "domicilio gratis"})
                      </option>
                    ))}
                  </select>
                  {zone?.etaLabel && <small className="field-hint">Llega en {zone.etaLabel.toLowerCase()}.</small>}
                  <small className="field-hint">
                    ¿No ves tu ciudad?{" "}
                    <a href={whatsappLink(whatsappOrderMessage(lines, subtotal, pendingPriceItems))} target="_blank" rel="noopener noreferrer">
                      Escríbenos y cotizamos el envío
                    </a>
                    .
                  </small>
                </label>
                <label className="field">
                  <span>Dirección</span>
                  <input
                    name="address"
                    autoComplete="street-address"
                    placeholder="Calle, carrera y número"
                    minLength={5}
                    maxLength={180}
                    required
                    value={draft.address}
                    onChange={(event) => updateDraft({ address: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>
                    Indicaciones <em>(opcional)</em>
                  </span>
                  <textarea
                    name="notes"
                    rows={2}
                    maxLength={300}
                    placeholder="Barrio, apartamento, portería o un punto de referencia"
                    value={draft.notes}
                    onChange={(event) => updateDraft({ notes: event.target.value })}
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={draft.wantsInvoice}
                    onChange={(event) => updateDraft({ wantsInvoice: event.target.checked })}
                  />
                  <span>Quiero factura electrónica a mi nombre</span>
                </label>
                {draft.wantsInvoice && (
                  <div className="field-pair field-pair-doc">
                    <label className="field">
                      <span>Documento</span>
                      <select value={draft.documentType} onChange={(event) => updateDraft({ documentType: event.target.value })}>
                        <option value="CC">Cédula de ciudadanía</option>
                        <option value="CE">Cédula de extranjería</option>
                        <option value="NIT">NIT</option>
                        <option value="PP">Pasaporte</option>
                        <option value="TI">Tarjeta de identidad</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Número</span>
                      <input
                        inputMode={draft.documentType === "PP" ? "text" : "numeric"}
                        maxLength={20}
                        required
                        value={draft.documentNumber}
                        onChange={(event) => updateDraft({ documentNumber: event.target.value })}
                      />
                    </label>
                  </div>
                )}
              </fieldset>

              <fieldset className="form-group">
                <legend>¿Cómo quieres pagar?</legend>
                <div className="pay-options">
                  {methods.map((method) => (
                    <label
                      key={method.id}
                      className={`pay-option${draft.paymentMethod === method.id ? " is-selected" : ""}${method.available ? "" : " is-disabled"}`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        disabled={!method.available}
                        checked={draft.paymentMethod === method.id}
                        onChange={() => updateDraft({ paymentMethod: method.id })}
                      />
                      <span className="pay-icon" aria-hidden>
                        {method.id === "WOMPI" ? <CreditCard size={20} /> : <Banknote size={20} />}
                      </span>
                      <span className="pay-text">
                        <b>{method.id === "WOMPI" ? "Pago en línea con Wompi" : "Contra entrega"}</b>
                        {method.id === "WOMPI" ? (
                          <>
                            <small>Te llevamos al checkout seguro de Wompi. No guardamos datos de tu tarjeta.</small>
                            <span className="method-chips">
                              {WOMPI_METHODS.map((name) => (
                                <i key={name}>{name}</i>
                              ))}
                            </span>
                          </>
                        ) : (
                          <small>
                            {method.reason || "Pagas en efectivo al recibir. Te contactamos para confirmar antes del despacho."}
                          </small>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="order-summary">
                <h3>Resumen</h3>
                <ul>
                  {lines.map((line) => (
                    <li key={`${line.variant.id}-${line.grind}`}>
                      <span>
                        {line.quantity} × {line.product.name} <small>{line.variant.label}, {grindPhrase(line.grind)}</small>
                      </span>
                      <b>{formatCOP(line.variant.priceCop * line.quantity)}</b>
                    </li>
                  ))}
                </ul>
                <Totals subtotal={subtotal} shipping={zone ? zone.priceCop : null} total={estimatedTotal} city={zone?.cityLabel} />
              </div>

              <label className="check consent">
                <input
                  type="checkbox"
                  required
                  checked={draft.privacyConsent}
                  onChange={(event) => updateDraft({ privacyConsent: event.target.checked })}
                />
                <span>
                  Autorizo el tratamiento de mis datos para gestionar el pedido y la entrega, según la{" "}
                  <Link href="/privacidad" target="_blank">
                    política de datos
                  </Link>
                  , y acepto los{" "}
                  <Link href="/terminos" target="_blank">
                    términos de compra
                  </Link>
                  .
                </span>
              </label>
            </div>
            <footer className="drawer-foot">
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="button button-primary button-block" disabled={busy || !draft.paymentMethod}>
                {busy ? (
                  "Registrando tu pedido…"
                ) : draft.paymentMethod === "CASH_ON_DELIVERY" ? (
                  <>Confirmar pedido contra entrega</>
                ) : (
                  <>
                    <Lock size={16} aria-hidden />
                    Ir a pagar {zone ? formatCOP(estimatedTotal) : ""}
                  </>
                )}
              </button>
              <p className="foot-note secure-note">
                {draft.paymentMethod === "CASH_ON_DELIVERY"
                  ? `Total a pagar al recibir: ${zone ? formatCOP(estimatedTotal) : "elige tu ciudad"}.`
                  : `Pago procesado por Wompi (Bancolombia). ${site.name} nunca ve los datos de tu tarjeta.`}
              </p>
            </footer>
          </form>
        )}

        {result?.checkout && (
          <form ref={wompiFormRef} action={result.checkout.action} method="GET" hidden aria-hidden>
            {result.checkout.fields.map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} readOnly />
            ))}
          </form>
        )}
      </div>
    </dialog>
  );
}

function Totals({ subtotal, shipping, total, city }: { subtotal: number; shipping: number | null; total: number; city?: string }) {
  return (
    <dl className="totals">
      <div>
        <dt>Productos</dt>
        <dd>{formatCOP(subtotal)}</dd>
      </div>
      <div>
        <dt>Domicilio{city ? ` a ${city}` : ""}</dt>
        <dd>{shipping === null ? "Elige tu ciudad" : shipping === 0 ? "Gratis" : formatCOP(shipping)}</dd>
      </div>
      <div className="totals-grand">
        <dt>Total</dt>
        <dd>{formatCOP(total)}</dd>
      </div>
    </dl>
  );
}
