import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, hasDatabaseConfig } from "@/lib/supabase/admin";
import { rateLimitFingerprint, readJsonBody, sameOriginRequest } from "@/lib/request";
import { hashTrackingToken, isTrackingToken } from "@/lib/orders";

export const runtime = "nodejs";

const bodySchema = z.object({ token: z.string().refine(isTrackingToken) }).strict();
const noStore = { "Cache-Control": "private, no-store" };

/**
 * Libera la reserva de un pedido aún sin pagar (Wompi) o sin confirmar
 * (contra entrega). Solo quien tiene el enlace de seguimiento puede hacerlo.
 */
export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403, headers: noStore });
  if (!hasDatabaseConfig()) return NextResponse.json({ error: "La tienda no está configurada." }, { status: 503, headers: noStore });
  const body = await readJsonBody(request, 1_024);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: noStore });
  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "El enlace del pedido no es válido." }, { status: 400, headers: noStore });

  const supabase = createAdminClient();
  const { data: allowed } = await supabase.rpc("consume_scoped_limit", {
    p_fingerprint: rateLimitFingerprint(request, "order-cancel"),
    p_max: 20,
    p_window_seconds: 3_600,
  });
  if (allowed !== true) return NextResponse.json({ error: "Demasiadas solicitudes. Intenta más tarde." }, { status: 429, headers: noStore });

  const { data, error } = await supabase.rpc("cancel_checkout_by_token", {
    p_token_hash: hashTrackingToken(parsed.data.token),
  });
  if (error) return NextResponse.json({ error: "No fue posible cancelar el pedido." }, { status: 503, headers: noStore });
  if (data !== true) {
    return NextResponse.json(
      { error: "Este pedido ya no se puede cancelar desde aquí. Escríbenos por WhatsApp." },
      { status: 409, headers: noStore },
    );
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
