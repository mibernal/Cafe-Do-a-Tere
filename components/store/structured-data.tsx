import type { Product } from "@/lib/store-types";
import { logoSrc, site, varietiesLabel } from "@/lib/site";

function siteUrl() {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL.replace(/\/?$/, "/")) : null;
  } catch {
    return null;
  }
}

/**
 * Datos estructurados de la marca y sus cafés. Precio y disponibilidad solo
 * se publican para presentaciones con precio confirmado por la finca.
 */
export function StructuredData({ products }: { products: Product[] }) {
  const base = siteUrl();
  if (!base) return null;
  // Las rutas de imagen ya traen el subdirectorio del sitio estático.
  const absolute = (path: string) => new URL(path, base.origin).toString();

  const organization = {
    "@type": "Organization",
    "@id": `${base}#organizacion`,
    name: site.name,
    url: base.toString(),
    logo: absolute(logoSrc),
    address: { "@type": "PostalAddress", addressLocality: site.town, addressRegion: site.region, addressCountry: "CO" },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: `+${site.whatsappNumber}`,
      contactType: "customer service",
      areaServed: "CO",
      availableLanguage: "es",
    },
    ...(site.instagramUrl ? { sameAs: [site.instagramUrl] } : {}),
  };

  const items = products.map((product) => {
    const offers = product.variants
      .filter((variant) => variant.priceConfirmed && variant.priceCop > 0)
      .map((variant) => ({
        "@type": "Offer",
        sku: variant.id,
        name: `${product.name} ${variant.label}`,
        price: variant.priceCop,
        priceCurrency: "COP",
        availability: variant.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: `${base}#cafe-${product.id}`,
        seller: { "@id": `${base}#organizacion` },
      }));
    const fromFarm = product.origin.startsWith(site.farm);
    const properties = [
      ["Origen", product.origin],
      ["Altura", /por confirmar/i.test(product.altitude) ? "" : product.altitude],
      ["Especie", fromFarm ? site.species : ""],
      ["Variedades", fromFarm ? varietiesLabel : ""],
      ["Clasificación", fromFarm ? site.grade : ""],
    ]
      .filter(([, value]) => value)
      .map(([name, value]) => ({ "@type": "PropertyValue", name, value }));
    return {
      "@type": "Product",
      "@id": `${base}#cafe-${product.id}`,
      name: product.name,
      description: product.description,
      image: absolute(product.image),
      category: "Café tostado",
      brand: { "@type": "Brand", name: site.name },
      additionalProperty: properties,
      ...(offers.length ? { offers } : {}),
    };
  });

  const data = { "@context": "https://schema.org", "@graph": [organization, ...items] };
  // "<" escapado: el JSON nunca puede cerrar la etiqueta script.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
