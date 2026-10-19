import type { MetadataRoute } from "next";
import { isStaticSite } from "@/lib/site-target";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4173").replace(/\/$/, "");
  return {
    // El sitio estático no tiene panel, API ni seguimiento.
    rules: isStaticSite ? { userAgent: "*", allow: "/" } : { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/seguimiento"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
