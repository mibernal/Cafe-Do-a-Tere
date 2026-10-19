import { z } from "zod";
import { readJsonBody } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminJson, requireAdmin } from "@/lib/admin-auth";

const trackingUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (!value) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "El enlace de seguimiento debe empezar por https://");

const actionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("advance"),
      orderId: z.uuid(),
      status: z.enum(["PREPARING", "SHIPPED", "DELIVERED"]),
      trackingUrl: trackingUrl.optional().default(""),
      courierName: z.string().trim().max(80).optional().default(""),
      trackingCode: z.string().trim().max(80).optional().default(""),
    })
    .strict(),
  z
    .object({
      action: z.enum(["cancel", "refund"]),
      orderId: z.uuid(),
      reason: z.string().trim().min(3).max(200),
      restock: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal("resolve"), orderId: z.uuid(), note: z.string().trim().min(3).max(200) }).strict(),
]);

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  const body = await readJsonBody(request, 8_192);
  if (!body.ok) return adminJson({ error: body.error }, body.status);
  const parsed = actionSchema.safeParse(body.value);
  if (!parsed.success) {
    const message = parsed.error.issues.find((issue) => issue.message.startsWith("El enlace"))?.message;
    return adminJson({ error: message ?? "Revisa los datos de la actualización." }, 400);
  }
  const input = parsed.data;
  const db = createAdminClient();

  if (input.action === "advance") {
    const { data, error } = await db.rpc("admin_update_order", {
      p_order_id: input.orderId,
      p_status: input.status,
      p_tracking_url: input.trackingUrl,
      p_courier_name: input.courierName,
      p_tracking_code: input.trackingCode,
      p_admin_id: auth.user.id,
    });
    if (error || data !== true) {
      return adminJson(
        {
          error:
            data === false && input.status === "PREPARING"
              ? "No hay inventario suficiente o el pedido cambió de estado. Revisa el stock y recarga."
              : "El pedido cambió de estado o la transición no es válida. Recarga el panel.",
        },
        409,
      );
    }
    return adminJson({ ok: true });
  }

  if (input.action === "resolve") {
    const { data, error } = await db.rpc("admin_resolve_payment_review", {
      p_order_id: input.orderId,
      p_note: input.note,
      p_admin_id: auth.user.id,
    });
    if (error || data !== true) {
      return adminJson({ error: "Esta novedad se resuelve preparando el pedido (con stock) o registrando el reembolso." }, 409);
    }
    return adminJson({ ok: true });
  }

  const { data, error } = await db.rpc("admin_close_order", {
    p_order_id: input.orderId,
    p_action: input.action === "cancel" ? "CANCEL" : "REFUND",
    p_restock: input.restock,
    p_reason: input.reason,
    p_admin_id: auth.user.id,
  });
  if (error || data !== true) {
    return adminJson(
      {
        error:
          input.action === "cancel"
            ? "Solo se cancelan pedidos sin pago recibido. Para pedidos pagados registra el reembolso."
            : "Solo se registran reembolsos de pedidos con pago recibido.",
      },
      409,
    );
  }
  return adminJson({ ok: true });
}
