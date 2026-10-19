import type { NextConfig } from "next";
import imageWidths from "./lib/image-widths.json";

// Dos destinos de build (ver lib/site-target.ts):
// - servidor (por defecto): la app completa.
// - NEXT_PUBLIC_SITE_TARGET=pages: exportación estática para GitHub Pages.
//   Los archivos *.server.ts(x) (API, panel, seguimiento y proxy) solo existen
//   en el destino con servidor; en la exportación estática no se compilan.
const staticSite = process.env.NEXT_PUBLIC_SITE_TARGET === "pages";

function pagesBasePath() {
  const value = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");
  if (value && !/^\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$/.test(value)) {
    throw new Error(`NEXT_PUBLIC_BASE_PATH no es válido: "${value}". Usa "" o algo como "/Cafe-Do-a-Tere".`);
  }
  return value;
}

const basePath = staticSite ? pagesBasePath() : "";

const staticConfig: NextConfig = {
  output: "export",
  basePath,
  // GitHub Pages sirve /terminos/ como /terminos/index.html.
  trailingSlash: true,
  // Sin servidor no hay optimizador de imágenes: el build genera versiones
  // WebP por ancho y este loader las enlaza (ver lib/image-loader.ts).
  images: { loader: "custom", loaderFile: "./lib/image-loader.ts", ...imageWidths },
  pageExtensions: ["tsx", "ts"],
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

const serverConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  pageExtensions: ["server.tsx", "server.ts", "tsx", "ts"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000" }]
            : []),
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/seguimiento/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
      {
        source: "/api/checkout/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
      {
        source: "/api/webhooks/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
    ];
  },
};

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(staticSite ? staticConfig : serverConfig),
};

export default nextConfig;
