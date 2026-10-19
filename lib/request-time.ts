import "server-only";
import { connection } from "next/server";
import { isStaticSite } from "@/lib/site-target";

/**
 * Con servidor, las páginas públicas se renderizan en cada solicitud: llevan
 * el nonce de la CSP y muestran precios e inventario vigentes. En el sitio
 * estático se generan una vez durante el build.
 */
export async function renderPerRequest() {
  if (!isStaticSite) await connection();
}
