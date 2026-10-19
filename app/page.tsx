import { getCatalog, getShippingZones } from "@/lib/catalog";
import { getStoreReadiness } from "@/lib/store-config";
import { StoreProvider } from "@/components/store/store-provider";
import { SiteHeader } from "@/components/store/site-header";
import { Catalog } from "@/components/store/catalog";
import { ProcessSpectrum } from "@/components/store/process-spectrum";
import { FlavorFinder } from "@/components/store/flavor-finder";
import { CartDrawer } from "@/components/store/cart-drawer";
import { FloatingActions } from "@/components/store/floating-actions";
import {
  Benefits,
  ClosingCta,
  Faq,
  Hero,
  HowToBuy,
  OriginSection,
  SiteFooter,
  VarietyRibbon,
} from "@/components/store/sections";

// Renderizado por solicitud: precios, disponibilidad y el nonce de la CSP.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, zones] = await Promise.all([getCatalog(), getShippingZones()]);
  const options = getStoreReadiness();
  const announcement = options.ordersEnabled
    ? options.codEnabled
      ? "Envíos desde la finca. Paga en línea o contra entrega."
      : "Envíos desde la finca. Pago seguro en línea con Wompi."
    : "Pedidos por WhatsApp mientras habilitamos el pago en línea.";

  return (
    <StoreProvider products={products} zones={zones} options={options}>
      <a className="skip-link" href="#cafes">
        Saltar a los cafés
      </a>
      <SiteHeader announcement={announcement} />
      <main id="inicio">
        <Hero options={options} />
        <VarietyRibbon products={products} />
        <Benefits options={options} />
        <Catalog />
        <ProcessSpectrum />
        <FlavorFinder />
        <OriginSection />
        <HowToBuy options={options} />
        <Faq options={options} />
        <ClosingCta />
      </main>
      <SiteFooter options={options} />
      <CartDrawer />
      <FloatingActions />
    </StoreProvider>
  );
}
