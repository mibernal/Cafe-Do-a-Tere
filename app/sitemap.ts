import type { MetadataRoute } from "next";
import { isStaticSite } from "@/lib/site-target";
import { legalComplete } from "@/lib/legal";

// Se genera durante el build en ambos destinos.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4173").replace(/\/$/, "");
  // El sitio estático publica cada página como carpeta (/terminos/).
  const page = (path: string) => `${base}${path}${isStaticSite ? "/" : ""}`;
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    // Los documentos legales en borrador no se indexan ni se listan.
    ...(legalComplete()
      ? [
          { url: page("/terminos"), changeFrequency: "yearly" as const, priority: 0.2 },
          { url: page("/privacidad"), changeFrequency: "yearly" as const, priority: 0.2 },
        ]
      : []),
  ];
}
