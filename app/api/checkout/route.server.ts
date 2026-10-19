import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreReadiness, privacyPolicyVersion } from "@/lib/store-config";
import { rateLimitFingerprint, rateLimitIdentity, readJsonBody, sameOriginRequest } from "@/lib/request";
import { wompiCheckoutForm } from "@/lib/wompi";
import { normalizeColombianMobile } from "@/lib/phone";
import { hashTrackingToken, newOrderReference, newTrackingToken, siteOrigin, trackingPath } from "@/lib/orders";
import { whatsappLink } from "@/lib/site";

export const runtime = "nodejs";

const optionalText = (schema: z.ZodString) =>
  z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), schema.optional());

const checkoutSchema = z
  .object({
    customer: z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.email().max(254),
        phone: z.string().trim().min(7).max(24),
        cityKey: z.string().regex(/^[a-z0-9-]{2,80}$/),
        address: z.string().trim().min(5).max(180),
        notes: z.string().trim().max(300).optional().default(""),
        documentType: z.preprocess(
          (value) => (value === "" ? undefined : value),
          z.enum(["CC", "CE", "NIT", "PP", "TI"]).optional(),
        ),
        documentNumber: optionalText(z.string().trim().regex(/^[0-9A-Za-z-]{4,20}$/)),
      })
      .strict()
      .refine((customer) => Boolean(customer.documentType) === Boolean(customer.documentNumber), {
        message: "document",
        path: ["documentNumber"],
      }),
    paymentMethod: z.enum(["WOMPI", "CASH_ON_DELIVERY"]),
    privacyConsent: z.literal(true),
    items: z
      .array(
        z
          .object({
            variantId: z.string().min(1).max(80),
            grind: z.string().trim().min(1).max(40),
            quantity: z.number().int().min(1).max(10),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();

const noStore = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });

const orderErrors: [RegExp, number, string][] = [
  [/shipping rate unavailable/, 409, "Aún no tenemos domicilio configurado para esa ciudad. Escríbenos por WhatsApp y te ayudamos."],
  [/cash on delivery unavailable/, 409, "El pago contra entrega no está disponible para esa ciudad. Elige pago en línea."],
  [/cash on delivery limit exceeded/, 409, "El pedido supera el monto permitido para pago contra entrega. Elige pago en línea o divide el pedido."],
  [/insufficient stock/, 409, "Uno de los cafés ya no tiene unidades suficientes. Ajusta las cantidades e inténtalo de nuevo."],
  [/product unavailable/, 409, "Uno de los cafés ya no está disponible. Retíralo de la bolsa para continuar."],
  [/variant not ready/, 409, "Uno de los cafés aún no tiene precio confirmado. Retíralo de la bolsa para continuar."],
  [/grind unavailable/, 409, "Una de las moliendas ya no está disponible para esa presentación. Elige otra en la bolsa."],
  [/too many units|invalid quantity/, 400, "El pedido admite hasta 30 unidades. Para compras mayores escríbenos por WhatsApp."],
  [/invalid customer|invalid document/, 400, "Revisa tus datos de contacto y entrega."],
];

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return json({ error: "Solicitud no válida." }, 403);
  const requestBody = await readJsonBody(request, 32_768);
  if (!requestBody.ok) return json({ error: requestBody.error }, requestBody.status);
  const parsed = checkoutSchema.safeParse(requestBody.value);
  if (!parsed.success) return json({ error: "Revisa los datos de entrega y los productos seleccionados." }, 400);
  const { customer, paymentMethod, items } = parsed.data;

  const readiness = getStoreReadiness();
  const policyVersion = privacyPolicyVersion();
  if (!readiness.ordersEnabled || !policyVersion) {
    return json(
      { error: "La tienda en línea aún no recibe pedidos. Escríbenos por WhatsApp y lo coordinamos contigo.", whatsapp: whatsappLink() },
      503,
    );
  }
  if (paymentMethod === "WOMPI" && !readiness.wompiEnabled) {
    return json({ error: "El pago en línea no está disponible en este momento. Elige pago contra entrega." }, 409);
  }
  if (paymentMethod === "CASH_ON_DELIVERY" && !readiness.codEnabled) {
    return json({ error: "El pago contra entrega no está disponible en este momento. Elige pago en línea." }, 409);
  }

  const phone = normalizeColombianMobile(customer.phone);
  if (!phone) return json({ error: "Escribe un celular colombiano de 10 dígitos, por ejemplo 300 123 4567." }, 400);

  const supabase = createAdminClient();
  const { data: allowed, error: limitError } = await supabase.rpc("consume_checkout_limit", {
    p_fingerprint: rateLimitFingerprint(request, "checkout"),
  });
  if (limitError || allowed !== true) {
    return json(
      { error: limitError ? "No fue posible iniciar el pedido. Intenta en unos minutos." : "Has iniciado varios pedidos seguidos. Espera un momento antes de intentarlo de nuevo." },
      limitError ? 503 : 429,
    );
  }
  if (paymentMethod === "CASH_ON_DELIVERY") {
    // Un celular no puede acumular reservas contra entrega sin control.
    const { data: phoneAllowed, error: phoneLimitError } = await supabase.rpc("consume_scoped_limit", {
      p_fingerprint: rateLimitIdentity("cod-phone", phone),
      p_max: 3,
      p_window_seconds: 86_400,
    });
    if (phoneLimitError || phoneAllowed !== true) {
      return json({ error: "Ya recibimos varios pedidos contra entrega con este celular hoy. Escríbenos por WhatsApp para ayudarte." }, 429);
    }
  }

  const reference = newOrderReference();
  const trackingToken = newTrackingToken();
  const { data: order, error } = await supabase.rpc("create_checkout_order", {
    p_reference: reference,
    p_city_key: customer.cityKey,
    p_customer: {
      name: customer.name,
      email: customer.email,
      phone,
      address: customer.address,
      notes: customer.notes,
      documentType: customer.documentType ?? "",
      documentNumber: customer.documentNumber ?? "",
      privacyConsent: true,
      privacyPolicyVersion: policyVersion,
    },
    p_items: items,
    p_tracking_token_hash: hashTrackingToken(trackingToken),
    p_payment_method: paymentMethod,
    p_cod_max_cop: readiness.codMaxCop,
  });

  if (error || !order?.total_cop) {
    const known = orderErrors.find(([pattern]) => pattern.test(error?.message ?? ""));
    if (!known) console.error("[checkout] create_checkout_order failed", error?.message);
    return json(
      { error: known?.[2] ?? "No pudimos registrar el pedido. Revisa la disponibilidad o escríbenos por WhatsApp." },
      known?.[1] ?? 409,
    );
  }

  const totals = {
    subtotalCop: Number(order.subtotal_cop),
    shippingCop: Number(order.shipping_cop),
    totalCop: Number(order.total_cop),
  };
  const tracking = { reference, trackingToken, trackingUrl: `${siteOrigin()}${trackingPath(trackingToken)}` };

  if (paymentMethod === "CASH_ON_DELIVERY") {
    return json({ paymentMethod, ...tracking, ...totals });
  }

  try {
    const checkout = wompiCheckoutForm({
      reference,
      amountCop: totals.totalCop,
      trackingToken,
      orderExpiresAt: order.expires_at ? new Date(order.expires_at) : undefined,
      customer: {
        email: customer.email,
        fullName: customer.name,
        phone,
        documentType: customer.documentType,
        documentNumber: customer.documentNumber,
      },
    });
    return json({ paymentMethod, ...tracking, ...totals, checkout });
  } catch (cause) {
    console.error("[checkout] Wompi form failed", cause instanceof Error ? cause.message : cause);
    await supabase.rpc("cancel_checkout_order", { p_reference: reference, p_reason: "No fue posible preparar el pago." });
    return json({ error: "El pago en línea no está disponible en este momento. Intenta de nuevo o elige contra entrega." }, 503);
  }
}
