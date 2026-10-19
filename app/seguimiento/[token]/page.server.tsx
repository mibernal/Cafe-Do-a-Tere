import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Lock, MessageCircle } from "lucide-react";
import { createAdminClient, hasDatabaseConfig } from "@/lib/supabase/admin";
import { formatCOP } from "@/lib/money";
import { hashTrackingToken, isTrackingToken } from "@/lib/orders";
import { paymentMethodLabels } from "@/lib/order-labels";
import { getStoreReadiness } from "@/lib/store-config";
import { isWompiTransactionId, wompiCheckoutForm } from "@/lib/wompi";
import { reconcileReturnedTransaction } from "@/lib/payments";
import { grindPhrase } from "@/lib/grind-options";
import { site, whatsappLink, logoSrc } from "@/lib/site";
import { AutoRefresh, CancelOrderButton } from "@/components/tracking-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Seguimiento de pedido",
  robots: { index: false, follow: false, noarchive: true },
};

type TrackingOrder = {
  reference: string;
  status: string;
  payment_method: "WOMPI" | "CASH_ON_DELIVERY";
  subtotal_cop: number;
  shipping_cop: number;
  total_cop: number;
  city: string;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  courier_tracking_url: string | null;
  courier_name: string | null;
  courier_tracking_code: string | null;
  order_items: { product_name: string; variant_label: string; grind: string; quantity: number; line_total_cop: number }[] | null;
  order_events: { status: string; message: string; created_at: string; is_internal: boolean }[] | null;
};

const statusCopy: Record<string, { title: string; text: string }> = {
  AWAITING_PAYMENT: {
    title: "Estamos esperando tu pago",
    text: "Reservamos tus cafés mientras completas el pago en Wompi. Si ya pagaste, la confirmación llega en unos segundos.",
  },
  COD_PENDING: {
    title: "Recibimos tu pedido contra entrega",
    text: "Te escribiremos o llamaremos para confirmarlo antes del despacho. Pagas en efectivo al recibir.",
  },
  PAYMENT_REVIEW: {
    title: "Estamos revisando tu pago",
    text: "Wompi aprobó el pago y estamos validando la disponibilidad de inventario. Te contactaremos pronto.",
  },
  PAID: { title: "¡Pago confirmado!", text: "Gracias por tu compra. Tu pedido ya está en manos de la finca." },
  PREPARING: { title: "Estamos preparando tu café", text: "Lo molemos y empacamos con el cuidado de la casa." },
  SHIPPED: { title: "Tu pedido va en camino", text: "Salió de la finca hacia tu dirección." },
  DELIVERED: { title: "Pedido entregado", text: "Esperamos que disfrutes cada taza. ¡Gracias por elegirnos!" },
  CANCELLED: {
    title: "Pedido cancelado",
    text: "El pedido se canceló y liberamos las unidades. Si fue un error o quieres intentarlo de nuevo, vuelve a la tienda o escríbenos.",
  },
  REFUNDED: {
    title: "Pago reembolsado",
    text: "Registramos la devolución de tu pago. El tiempo en que se refleja depende de tu banco o medio de pago.",
  },
};

function progressSteps(order: TrackingOrder) {
  const cod = order.payment_method === "CASH_ON_DELIVERY";
  const steps = cod
    ? ["Pedido recibido", "Confirmado", "En camino", "Entregado y pagado"]
    : ["Pedido recibido", "Pago confirmado", "En preparación", "En camino", "Entregado"];
  const reachedByStatus: Record<string, number> = cod
    ? { COD_PENDING: 0, PREPARING: 1, SHIPPED: 2, DELIVERED: 3 }
    : { AWAITING_PAYMENT: 0, PAYMENT_REVIEW: 1, PAID: 1, PREPARING: 2, SHIPPED: 3, DELIVERED: 4 };
  return { steps, reached: reachedByStatus[order.status] ?? -1 };
}

async function loadOrder(tokenHash: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("orders")
    .select(
      "reference,status,payment_method,subtotal_cop,shipping_cop,total_cop,city,created_at,expires_at,paid_at,courier_tracking_url,courier_name,courier_tracking_code,order_items(product_name,variant_label,grind,quantity,line_total_cop),order_events(status,message,created_at,is_internal)",
    )
    .eq("tracking_token_hash", tokenHash)
    .maybeSingle();
  return data as TrackingOrder | null;
}

export default async function TrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  if (!isTrackingToken(token) || !hasDatabaseConfig()) notFound();
  const tokenHash = hashTrackingToken(token);

  let order: TrackingOrder | null = null;
  try {
    order = await loadOrder(tokenHash);
    // Wompi devuelve al cliente con ?id=<transacción>. Se verifica con la llave
    // privada para no depender solo de la llegada del webhook.
    const transactionId = typeof query.id === "string" ? query.id : null;
    if (
      order &&
      transactionId &&
      isWompiTransactionId(transactionId) &&
      order.payment_method === "WOMPI" &&
      !order.paid_at &&
      (order.status === "AWAITING_PAYMENT" || order.status === "CANCELLED")
    ) {
      const result = await reconcileReturnedTransaction(transactionId, order.reference);
      if (result === "recorded") order = await loadOrder(tokenHash);
    }
  } catch {
    order = null;
  }
  if (!order) notFound();

  const copy = statusCopy[order.status] ?? statusCopy.AWAITING_PAYMENT;
  const { steps, reached } = progressSteps(order);
  const closed = order.status === "CANCELLED" || order.status === "REFUNDED";
  const events = (order.order_events ?? [])
    .filter((event) => !event.is_internal)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // "Pagar ahora" reutiliza la referencia y la reserva vigente del pedido.
  let resumeForm: ReturnType<typeof wompiCheckoutForm> | null = null;
  if (order.status === "AWAITING_PAYMENT" && order.payment_method === "WOMPI" && getStoreReadiness().wompiEnabled) {
    try {
      resumeForm = wompiCheckoutForm({
        reference: order.reference,
        amountCop: Number(order.total_cop),
        trackingToken: token,
        orderExpiresAt: new Date(order.expires_at),
      });
    } catch {
      resumeForm = null;
    }
  }
  const helpMessage = `Hola, Café Doña Tere. Tengo una pregunta sobre mi pedido ${order.reference}.`;

  return (
    <main className="tracking-page">
      <header className="tracking-header">
        <Link className="brand" href="/">
          <Image src={logoSrc} alt="" width={46} height={46} />
          <span>
            <strong>Café Doña Tere</strong>
            <small>Seguimiento de pedido</small>
          </span>
        </Link>
        <Link className="text-link back-link" href="/">
          <ArrowLeft size={15} aria-hidden />
          Volver a la tienda
        </Link>
      </header>

      <section className={`tracking-card status-${order.status.toLowerCase()}`} aria-labelledby="tracking-title">
        <p className="tracking-ref">Pedido {order.reference}</p>
        <h1 id="tracking-title">{copy.title}</h1>
        <p className="tracking-lead">{copy.text}</p>

        {!closed && reached >= 0 && (
          <ol className="progress" aria-label="Avance del pedido">
            {steps.map((step, index) => (
              <li key={step} className={index < reached ? "is-done" : index === reached ? "is-current" : ""} aria-current={index === reached ? "step" : undefined}>
                <span aria-hidden />
                {step}
              </li>
            ))}
          </ol>
        )}

        <div className="tracking-actions">
          {resumeForm && (
            <form action={resumeForm.action} method="GET" className="resume-form">
              {resumeForm.fields.map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <button type="submit" className="button button-primary">
                <Lock size={16} aria-hidden />
                Pagar {formatCOP(Number(order.total_cop))} con Wompi
              </button>
            </form>
          )}
          {order.status === "AWAITING_PAYMENT" && <AutoRefresh />}
          {order.status === "COD_PENDING" && (
            <a
              className="button button-primary"
              href={whatsappLink(`Hola, Café Doña Tere. Quiero confirmar mi pedido contra entrega ${order.reference}.`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={17} aria-hidden />
              Confirmar por WhatsApp
            </a>
          )}
          {order.status === "SHIPPED" && order.courier_tracking_url && (
            <a className="button button-primary" href={order.courier_tracking_url} target="_blank" rel="noopener noreferrer">
              Rastrear el envío
              <ExternalLink size={15} aria-hidden />
            </a>
          )}
          {(order.status === "AWAITING_PAYMENT" || order.status === "COD_PENDING") && (
            <CancelOrderButton token={token} label="Cancelar pedido" />
          )}
        </div>

        {order.status === "SHIPPED" && (order.courier_name || order.courier_tracking_code) && (
          <p className="courier-line">
            {order.courier_name && <>Transportadora: <b>{order.courier_name}</b>. </>}
            {order.courier_tracking_code && <>Guía: <b>{order.courier_tracking_code}</b>.</>}
          </p>
        )}

        <dl className="tracking-meta">
          <div>
            <dt>Fecha</dt>
            <dd>{new Date(order.created_at).toLocaleDateString("es-CO", { dateStyle: "long", timeZone: "America/Bogota" })}</dd>
          </div>
          <div>
            <dt>Destino</dt>
            <dd>{order.city}</dd>
          </div>
          <div>
            <dt>Pago</dt>
            <dd>{paymentMethodLabels[order.payment_method] ?? order.payment_method}</dd>
          </div>
        </dl>

        <div className="tracking-items">
          <h2>Tu pedido</h2>
          <ul>
            {(order.order_items ?? []).map((item, index) => (
              <li key={`${item.product_name}-${item.variant_label}-${item.grind}-${index}`}>
                <span>
                  {item.quantity} × {item.product_name}
                  <small>
                    {item.variant_label}, {grindPhrase(item.grind)}
                  </small>
                </span>
                <b>{formatCOP(Number(item.line_total_cop))}</b>
              </li>
            ))}
          </ul>
          <dl className="totals">
            <div>
              <dt>Productos</dt>
              <dd>{formatCOP(Number(order.subtotal_cop))}</dd>
            </div>
            <div>
              <dt>Domicilio</dt>
              <dd>{Number(order.shipping_cop) === 0 ? "Gratis" : formatCOP(Number(order.shipping_cop))}</dd>
            </div>
            <div className="totals-grand">
              <dt>{order.payment_method === "CASH_ON_DELIVERY" && !order.paid_at ? "Total a pagar al recibir" : "Total"}</dt>
              <dd>{formatCOP(Number(order.total_cop))}</dd>
            </div>
          </dl>
        </div>

        {events.length > 0 && (
          <div className="tracking-timeline">
            <h2>Novedades</h2>
            <ol>
              {events.map((event, index) => (
                <li key={`${event.created_at}-${index}`}>
                  <b>{event.message}</b>
                  <time dateTime={event.created_at}>
                    {new Date(event.created_at).toLocaleString("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "America/Bogota",
                    })}
                  </time>
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="tracking-help">
          Guarda este enlace para consultar tu pedido. ¿Necesitas ayuda?{" "}
          <a href={whatsappLink(helpMessage)} target="_blank" rel="noopener noreferrer">
            Escríbenos por WhatsApp al {site.whatsappDisplay}
          </a>
          .
        </p>
      </section>
    </main>
  );
}
