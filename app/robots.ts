import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4173";
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/seguimiento"] }, sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml` };
}
