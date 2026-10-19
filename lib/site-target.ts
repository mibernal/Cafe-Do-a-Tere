// Dónde se publica la tienda. Ambos valores se fijan durante el build.
//
// - "server" (por defecto): app completa con servidor: pagos con Wompi,
//   contra entrega, seguimiento de pedidos, panel /admin y CSP con nonce.
// - "pages": sitio estático para GitHub Pages. El catálogo se lee de
//   Supabase durante el build y los pedidos se envían por WhatsApp. Las rutas
//   que necesitan servidor (archivos *.server.ts(x)) no se incluyen.

export const isStaticSite = process.env.NEXT_PUBLIC_SITE_TARGET === "pages";

/** Prefijo del sitio cuando se publica en un subdirectorio (p. ej. "/Cafe-Do-a-Tere"). */
export const basePath = isStaticSite ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "") : "";

/**
 * Ruta pública de un archivo de /public. next/link agrega el basePath solo;
 * next/image, las imágenes del catálogo y los metadatos no, así que pasan por
 * aquí. Es idempotente.
 */
export function asset(path: string) {
  if (!basePath || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === basePath || path.startsWith(`${basePath}/`)) return path;
  return `${basePath}${path}`;
}
