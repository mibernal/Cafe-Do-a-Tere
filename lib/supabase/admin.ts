import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Lecturas siempre frescas: sin caché de datos y sin la memoización de fetch
 * que Next.js aplica dentro de un mismo render (una segunda lectura del mismo
 * pedido, después de conciliar un pago, debe ver el estado nuevo).
 */
export const freshFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store", signal: init?.signal ?? new AbortController().signal });

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Database server credentials are not configured.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: freshFetch },
  });
}

export function hasDatabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
