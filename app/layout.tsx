import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { getStoreReadiness } from "@/lib/store-config";

// Fuentes alojadas en el proyecto: el build no depende de Google Fonts y el
// navegador del cliente no contacta a terceros para cargarlas.
const sans = localFont({
  src: [
    { path: "./fonts/dm-sans-latin-wght-normal.woff2", style: "normal", weight: "100 1000" },
    { path: "./fonts/dm-sans-latin-wght-italic.woff2", style: "italic", weight: "100 1000" },
  ],
  variable: "--font-sans",
  display: "swap",
});
const serif = localFont({
  src: [
    { path: "./fonts/playfair-display-latin-wght-normal.woff2", style: "normal", weight: "400 900" },
    { path: "./fonts/playfair-display-latin-wght-italic.woff2", style: "italic", weight: "400 900" },
  ],
  variable: "--font-serif",
  display: "swap",
});

function metadataBase() {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined;
  } catch {
    return undefined;
  }
}

function orderingLine() {
  const { wompiEnabled, codEnabled } = getStoreReadiness();
  if (wompiEnabled && codEnabled) return "Paga en línea o contra entrega.";
  if (wompiEnabled) return "Paga en línea con Wompi.";
  if (codEnabled) return "Paga contra entrega.";
  return "Haz tu pedido por WhatsApp.";
}

export function generateMetadata(): Metadata {
  return {
    metadataBase: metadataBase(),
    title: { default: "Café Doña Tere | Café de origen de Cachipay", template: "%s | Café Doña Tere" },
    description: `Café colombiano de Finca La Libertad, Cachipay: tostado a la leña, tostión de precisión y el microlote Honey Red, con molienda para tu método. ${orderingLine()}`,
    applicationName: "Café Doña Tere",
    referrer: "strict-origin-when-cross-origin",
    openGraph: {
      title: "Café Doña Tere, café con alma de abuela",
      description: "Café de origen de Finca La Libertad, Cachipay, tostado con calma y enviado a tu casa.",
      locale: "es_CO",
      type: "website",
      // Relativa a metadataBase, que en GitHub Pages ya incluye el subdirectorio.
      images: ["/assets/roasting.jpg"],
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#2b1b12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Las variables de fuente van en <html> para que :root pueda usarlas.
    <html lang="es-CO" data-scroll-behavior="smooth" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
