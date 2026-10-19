// Datos públicos del comercio. Se pueden ajustar sin tocar el código con las
// variables NEXT_PUBLIC_* (se incrustan en el navegador durante el build).

import { asset } from "@/lib/site-target";

/** Logo en 264 px (2x del tamaño más grande en pantalla). */
export const logoSrc = asset("/assets/logo-cafe-dona-tere.webp");

const whatsappNumber = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "573124193753").replace(/\D/g, "");

export const site = {
  name: "Café Doña Tere",
  tagline: "Café con alma de abuela",
  farm: "Finca La Libertad",
  town: "Cachipay",
  region: "Cundinamarca",
  altitude: "1.450–1.650 m s. n. m.",
  species: "Arábica",
  grade: "Excelso",
  /** Variedades botánicas de la finca, confirmadas por el comercio. */
  varieties: [
    { name: "Castillo", share: 60 },
    { name: "Caturra", share: 40 },
  ],
  whatsappNumber,
  whatsappDisplay: whatsappNumber.startsWith("57") && whatsappNumber.length === 12
    ? `+57 ${whatsappNumber.slice(2, 5)} ${whatsappNumber.slice(5, 8)} ${whatsappNumber.slice(8)}`
    : `+${whatsappNumber}`,
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
} as const;

/** "Castillo 60% · Caturra 40%" */
export const varietiesLabel = site.varieties.map((variety) => `${variety.name} ${variety.share}%`).join(" · ");

/** "60% Castillo y 40% Caturra" */
export const varietiesPhrase = site.varieties
  .map((variety) => `${variety.share}%\u00a0${variety.name}`)
  .join(", ")
  .replace(/, ([^,]*)$/, " y $1");

/** Evita que "m s. n. m." quede partido entre dos líneas. */
export function altitudeText(altitude: string) {
  return altitude.replace(/m s\. n\. m\./g, "m\u00a0s.\u00a0n.\u00a0m.");
}

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${site.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message.slice(0, 1500))}` : base;
}
