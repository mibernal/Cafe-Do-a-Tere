import { z } from "zod";
import { readJsonBody } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminJson, requireAdmin } from "@/lib/admin-auth";
import { cityKey } from "@/lib/orders";

const shippingRate = z
  .object({
    cityKey: z.string().regex(/^[a-z0-9-]{2,80}$/).optional(),
    cityLabel: z.string().trim().min(2).max(80),
    priceCop: z.number().int().min(0).max(100_000_000),
    active: z.boolean(),
    codEnabled: z.boolean(),
    etaLabel: z.string().trim().max(60).optional().default(""),
  })
  .strict();

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  const body = await readJsonBody(request, 8_192);
  if (!body.ok) return adminJson({ error: body.error }, body.status);
  const parsed = shippingRate.safeParse(body.value);
  if (!parsed.success) return adminJson({ error: "Revisa el municipio y el valor del domicilio." }, 400);
  const key = parsed.data.cityKey ?? cityKey(parsed.data.cityLabel);
  if (key.length < 2) return adminJson({ error: "El municipio debe tener un nombre válido." }, 400);
  const db = createAdminClient();
  const { data, error } = await db.rpc("admin_configure_shipping_rate", {
    p_city_key: key,
    p_city_label: parsed.data.cityLabel,
    p_price_cop: parsed.data.priceCop,
    p_active: parsed.data.active,
    p_cod_enabled: parsed.data.codEnabled,
    p_eta_label: parsed.data.etaLabel,
    p_admin_id: auth.user.id,
  });
  if (error || data !== true) return adminJson({ error: "No se pudo guardar la tarifa de envío." }, 409);
  return adminJson({ ok: true });
}
