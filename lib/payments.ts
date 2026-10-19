import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWompiTransaction, settlementKey, type WompiTransaction } from "@/lib/wompi";

export type SettlementResult = "recorded" | "ignored" | "mismatch" | "error";

/** Registra en base de datos un estado final de Wompi (idempotente). */
export async function settleWompiTransaction(transaction: WompiTransaction, eventKey: string): Promise<SettlementResult> {
  if (transaction.status === "PENDING") return "ignored";
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("settle_wompi_transaction", {
    p_event_key: eventKey,
    p_reference: transaction.reference,
    p_transaction_id: transaction.id,
    p_status: transaction.status,
    p_amount_in_cents: transaction.amount_in_cents,
    p_currency: transaction.currency,
  });
  if (error) {
    console.error("[payments] settle_wompi_transaction failed", error.message);
    return "error";
  }
  return data === false ? "mismatch" : "recorded";
}

/**
 * Cuando Wompi devuelve al cliente con ?id=<transacción>, consulta la
 * transacción con la llave privada y la concilia sin esperar el webhook. Solo
 * acepta transacciones cuya referencia coincide con el pedido del enlace.
 */
export async function reconcileReturnedTransaction(transactionId: string, expectedReference: string) {
  try {
    const transaction = await fetchWompiTransaction(transactionId);
    if (transaction.reference !== expectedReference) return "mismatch" as const;
    return await settleWompiTransaction(transaction, settlementKey("return", transaction.id, transaction.status));
  } catch (cause) {
    console.error("[payments] No fue posible verificar la transacción de retorno", cause instanceof Error ? cause.message : cause);
    return "error" as const;
  }
}
