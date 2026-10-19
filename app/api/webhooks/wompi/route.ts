import { NextResponse } from "next/server";
import { z } from "zod";
import { hasDatabaseConfig } from "@/lib/supabase/admin";
import { readJsonBody } from "@/lib/request";
import { fetchWompiTransaction, settlementKey, verifyWompiEvent } from "@/lib/wompi";
import { settleWompiTransaction } from "@/lib/payments";

export const runtime = "nodejs";

const transactionSchema = z
  .object({
    reference: z.string().min(1).max(80),
    id: z.string().min(1).max(120),
    status: z.enum(["PENDING", "APPROVED", "DECLINED", "ERROR", "VOIDED"]),
    amount_in_cents: z.number().int().positive().safe(),
    currency: z.literal("COP"),
  })
  .passthrough();

/**
 * Wompi reintenta hasta tres veces en 24 h cuando no recibe HTTP 200. Por eso
 * solo se responde con error cuando un reintento puede resolverlo.
 */
export async function POST(request: Request) {
  const requestBody = await readJsonBody(request, 262_144);
  if (!requestBody.ok) return new NextResponse(requestBody.error, { status: requestBody.status });
  const event = requestBody.value as Record<string, unknown>;
  const isTransactionEvent = event?.event === "transaction.updated";
  const requiredProperties = isTransactionEvent
    ? ["transaction.id", "transaction.status", "transaction.amount_in_cents"]
    : [];
  if (!verifyWompiEvent(event, request.headers.get("x-event-checksum"), requiredProperties)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }
  if (!isTransactionEvent) return NextResponse.json({ received: true });
  if (!hasDatabaseConfig()) return new NextResponse("Store database is not configured", { status: 503 });

  const transactionResult = transactionSchema.safeParse((event.data as Record<string, unknown>).transaction);
  if (!transactionResult.success) return new NextResponse("Invalid transaction", { status: 400 });
  const transaction = transactionResult.data;
  if (transaction.status === "PENDING") return NextResponse.json({ received: true });

  let authoritative;
  try {
    authoritative = await fetchWompiTransaction(transaction.id);
  } catch {
    // Pide a Wompi reintentar si su API no responde o la llave necesita ajuste.
    return new NextResponse("Could not verify transaction with Wompi", { status: 503 });
  }
  if (
    authoritative.id !== transaction.id ||
    authoritative.reference !== transaction.reference ||
    authoritative.status !== transaction.status ||
    authoritative.amount_in_cents !== transaction.amount_in_cents ||
    authoritative.currency !== transaction.currency
  ) {
    return new NextResponse("Webhook does not match the authoritative transaction", { status: 409 });
  }

  const result = await settleWompiTransaction(
    authoritative,
    settlementKey(`webhook:${String(event.timestamp)}`, authoritative.id, authoritative.status),
  );
  if (result === "error") return new NextResponse("Could not record event", { status: 500 });
  if (result === "mismatch") {
    console.warn("[wompi] Evento sin pedido coincidente", { reference: authoritative.reference, status: authoritative.status });
  }
  // Una referencia ajena a la tienda (otro canal con la misma cuenta Wompi)
  // no se reintenta: se responde 200 para que Wompi no insista.
  return NextResponse.json({ received: true, matched: result !== "mismatch" });
}
