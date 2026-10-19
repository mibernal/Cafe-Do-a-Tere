/**
 * Normaliza un celular colombiano a 10 dígitos (3XXXXXXXXX). Acepta espacios,
 * guiones, paréntesis y el prefijo +57. Devuelve null si no es un celular.
 */
export function normalizeColombianMobile(input: string): string | null {
  if (typeof input !== "string" || input.length > 24) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) digits = digits.slice(2);
  return /^3\d{9}$/.test(digits) ? digits : null;
}
