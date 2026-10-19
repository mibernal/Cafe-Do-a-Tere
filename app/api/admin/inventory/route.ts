import { z } from "zod";
import { readJsonBody } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminJson, requireAdmin } from "@/lib/admin-auth";

const inventoryAdjustment = z
  .object({
    variantId: z.string().min(1).max(80),
    delta: z.number().int().min(-10000).max(10000).refine((value) => value !== 0),
    note: z.string().trim().min(2).max(200),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  const body = await readJsonBody(request, 8_192);
  if (!body.ok) return adminJson({ error: body.error }, body.status);
  const parsed = inventoryAdjustment.safeParse(body.value);
  if (!parsed.success) return adminJson({ error: "Escribe unidades distintas de cero y un motivo." }, 400);
  const db = createAdminClient();
  const { data, error } = await db.rpc("admin_adjust_inventory", {
    p_variant_id: parsed.data.variantId,
    p_delta: parsed.data.delta,
    p_note: parsed.data.note,
    p_admin_id: auth.user.id,
  });
  if (error || data !== true) {
    return adminJson({ error: "No se pudo ajustar: el inventario no puede quedar por debajo de las unidades reservadas." }, 409);
  }
  return adminJson({ ok: true });
}
