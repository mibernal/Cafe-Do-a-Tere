import { getCatalog, getShippingZones } from "@/lib/catalog";
import { getStoreReadiness } from "@/lib/store-config";
import type { Metadata } from "next";
import { renderPerRequest } from "@/lib/request-time";
import { StructuredData } from "@/components/store/structured-data";
import { isStaticSite } from "@/lib/site-target";
import { StoreProvider } from "@/components/store/store-provider";
import { SiteHeader } from "@/components/store/site-header";
import { Catalog } from "@/components/store/catalog";
import { ProcessSpectrum } from "@/components/store/process-spectrum";
import { FlavorFinder } from "@/components/store/flavor-finder";
import { CoffeeCompare } from "@/components/store/coffee-compare";
import { spectrumStopCount } from "@/lib/catalog-style";
import { CartDrawer } from "@/components/store/cart-drawer";
import { FloatingActions } from "@/components/store/floating-actions";
import {
  Benefits,
  type NavLink,
  ClosingCta,
  Faq,
  Hero,
  HowToBuy,
  OriginSection,
  SiteFooter,
  VarietyRibbon,
} from "@/components/store/sections";

export const metadata: Metadata = {
  // Relativa a metadataBase (el dominio definitivo o el subdirectorio de GitHub Pages).
  // (openGraph se hereda completo del layout: definirlo aquí lo reemplazaría.)
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  await renderPerRequest();
  const [products, zones] = await Promise.all([getCatalog(), getShippingZones()]);
  const options = getStoreReadiness();
  const announcement =
    options.wompiEnabled && options.codEnabled
      ? "Envíos desde la finca. Paga en línea o contra entrega."
      : options.wompiEnabled
        ? "Envíos desde la finca. Pago seguro en línea con Wompi."
        : options.codEnabled
          ? "Envíos desde la finca. Paga contra entrega."
          : isStaticSite
            ? "Envíos desde la finca. Arma tu pedido y envíalo por WhatsApp."
            : "Pedidos por WhatsApp mientras habilitamos el pago en línea.";

  // El menú solo enlaza secciones que existen con el catálogo publicado.
  const hasChoice = products.length > 1;
  const showSpectrum = spectrumStopCount(products) >= 3;
  const nav: NavLink[] = [
    { href: "#cafes", label: "Cafés" },
    ...(hasChoice ? [{ href: "#comparar", label: "Comparar" }, { href: "#elegir", label: "Ayúdame a elegir" }] : []),
    ...(showSpectrum ? [{ href: "#procesos", label: "Procesos" }] : []),
    { href: "#finca", label: "La finca" },
    { href: "#ayuda", label: "Preguntas" },
  ];

  return (
    <StoreProvider products={products} zones={zones} options={options}>
      <a className="skip-link" href="#cafes">
        Saltar a los cafés
      </a>
      <StructuredData products={products} />
      <SiteHeader announcement={announcement} links={nav} />
      <main id="inicio">
        <Hero options={options} products={products} showFinder={hasChoice} />
        <VarietyRibbon products={products} />
        <Benefits options={options} />
        <Catalog />
        <CoffeeCompare />
        <FlavorFinder />
        {showSpectrum && <ProcessSpectrum />}
        <OriginSection />
        <HowToBuy options={options} />
        <Faq options={options} products={products} />
        <ClosingCta />
      </main>
      <SiteFooter options={options} nav={nav} />
      <CartDrawer />
      <FloatingActions />
    </StoreProvider>
  );
}
