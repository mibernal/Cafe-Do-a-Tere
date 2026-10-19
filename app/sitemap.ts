import type { MetadataRoute } from "next";
import { isStaticSite } from "@/lib/site-target";

// Se genera durante el build en ambos destinos.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4173").replace(/\/$/, "");
  // El sitio estático publica cada página como carpeta (/terminos/).
  const page = (path: string) => `${base}${path}${isStaticSite ? "/" : ""}`;
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: page("/terminos"), changeFrequency: "yearly", priority: 0.2 },
    { url: page("/privacidad"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
