import { z } from "zod";
import { readJsonBody } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminJson, requireAdmin } from "@/lib/admin-auth";
import { GRIND_OPTIONS } from "@/lib/grind-options";

const allowedGrinds = new Set<string>(GRIND_OPTIONS.map((option) => option.value));
const grinds = z
  .array(z.string().min(1).max(80))
  .min(1)
  .max(GRIND_OPTIONS.length)
  .refine((values) => values.every((value) => allowedGrinds.has(value)) && new Set(values).size === values.length);

const variantUpdate = z
  .object({
    variantId: z.string().min(1).max(80),
    label: z.string().trim().min(2).max(60),
    weightGrams: z.number().int().min(50).max(20000),
    priceCop: z.number().int().min(0).max(100_000_000),
    priceConfirmed: z.boolean(),
    active: z.boolean(),
    grinds,
  })
  .strict()
  .refine((value) => !value.priceConfirmed || value.priceCop > 0, { path: ["priceCop"] });

const variantCreate = z
  .object({
    productId: z.string().min(1).max(80),
    label: z.string().trim().min(2).max(60),
    weightGrams: z.number().int().min(50).max(20000),
    priceCop: z.number().int().min(0).max(100_000_000),
    grinds,
  })
  .strict();

const productUpdate = z
  .object({
    productId: z.string().min(1).max(80),
    name: z.string().trim().min(2).max(80),
    subtitle: z.string().trim().max(120),
    description: z.string().trim().max(600),
    notes: z.array(z.string().trim().min(1).max(40)).max(5),
    badge: z.string().trim().max(40),
    published: z.boolean(),
    sortOrder: z.number().int().min(0).max(1000),
  })
  .strict();

/** Actualiza una presentación o un producto. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  const body = await readJsonBody(request, 16_384);
  if (!body.ok) return adminJson({ error: body.error }, body.status);
  const db = createAdminClient();

  const product = productUpdate.safeParse(body.value);
  if (product.success) {
    const input = product.data;
    const { data, error } = await db.rpc("admin_configure_product", {
      p_product_id: input.productId,
      p_name: input.name,
      p_subtitle: input.subtitle,
      p_description: input.description,
      p_notes: input.notes,
      p_badge: input.badge,
      p_published: input.published,
      p_sort_order: input.sortOrder,
      p_admin_id: auth.user.id,
    });
    if (error || data !== true) return adminJson({ error: "No se pudo guardar el producto." }, 409);
    return adminJson({ ok: true });
  }

  const variant = variantUpdate.safeParse(body.value);
  if (!variant.success) {
    return adminJson({ error: "Revisa la presentación: un precio confirmado debe ser mayor que cero y necesita al menos una molienda." }, 400);
  }
  const input = variant.data;
  const { data, error } = await db.rpc("admin_configure_variant", {
    p_variant_id: input.variantId,
    p_label: input.label,
    p_weight_grams: input.weightGrams,
    p_price_cop: input.priceCop,
    p_price_confirmed: input.priceConfirmed,
    p_grinds: input.grinds,
    p_active: input.active,
    p_admin_id: auth.user.id,
  });
  if (error || data !== true) return adminJson({ error: "No se pudo guardar la presentación." }, 409);
  return adminJson({ ok: true });
}

/** Crea una presentación nueva (sin precio confirmado ni stock). */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  const body = await readJsonBody(request, 8_192);
  if (!body.ok) return adminJson({ error: body.error }, body.status);
  const parsed = variantCreate.safeParse(body.value);
  if (!parsed.success) return adminJson({ error: "Revisa el nombre, el peso y las moliendas de la presentación." }, 400);
  const input = parsed.data;
  const db = createAdminClient();
  const { data, error } = await db.rpc("admin_create_variant", {
    p_product_id: input.productId,
    p_label: input.label,
    p_weight_grams: input.weightGrams,
    p_price_cop: input.priceCop,
    p_grinds: input.grinds,
    p_admin_id: auth.user.id,
  });
  if (error || typeof data !== "string") return adminJson({ error: "No se pudo crear la presentación." }, 409);
  return adminJson({ ok: true, variantId: data });
}
