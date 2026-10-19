import "server-only";
import { hasDatabaseConfig } from "@/lib/supabase/admin";
import type { CheckoutOptions } from "@/lib/store-types";
import { isStaticSite } from "@/lib/site-target";

const DEFAULT_COD_MAX_COP = 300_000;

function siteUrlIsValid() {
  let siteUrl: URL;
  try {
    siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  } catch {
    return false;
  }
  const secureProtocol =
    siteUrl.protocol === "https:" ||
    (process.env.NODE_ENV !== "production" &&
      siteUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(siteUrl.hostname));
  return (
    !siteUrl.username &&
    !siteUrl.password &&
    !siteUrl.search &&
    !siteUrl.hash &&
    siteUrl.pathname === "/" &&
    secureProtocol
  );
}

export function privacyPolicyVersion() {
  const version = process.env.PRIVACY_POLICY_VERSION?.trim() ?? "";
  return version.length > 0 && version.length <= 80 && !/draft/i.test(version) ? version : null;
}

export function wompiKeysMatchEnvironment() {
  const mode = process.env.WOMPI_ENVIRONMENT;
  const publicKey = process.env.WOMPI_PUBLIC_KEY ?? "";
  const privateKey = process.env.WOMPI_PRIVATE_KEY ?? "";
  if (mode === "test") return publicKey.startsWith("pub_test_") && privateKey.startsWith("prv_test_");
  if (mode === "production") return publicKey.startsWith("pub_prod_") && privateKey.startsWith("prv_prod_");
  return false;
}

function codMaxCop() {
  const raw = Number(process.env.CASH_ON_DELIVERY_MAX_COP ?? DEFAULT_COD_MAX_COP);
  if (!Number.isSafeInteger(raw)) return DEFAULT_COD_MAX_COP;
  return Math.min(Math.max(raw, 10_000), 5_000_000);
}

/**
 * Estado operativo de la tienda. Los pedidos solo se habilitan cuando el
 * comercio lo decide explícitamente y la configuración mínima está completa.
 */
export function getStoreReadiness(): CheckoutOptions {
  // El sitio estático no tiene servidor que firme pagos ni registre pedidos:
  // la bolsa se envía por WhatsApp, sin importar las variables configuradas.
  if (isStaticSite) return { ordersEnabled: false, wompiEnabled: false, codEnabled: false, codMaxCop: codMaxCop() };

  const baseReady =
    process.env.STORE_CHECKOUT_ENABLED === "true" &&
    privacyPolicyVersion() !== null &&
    siteUrlIsValid() &&
    hasDatabaseConfig() &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const wompiEnabled =
    baseReady &&
    wompiKeysMatchEnvironment() &&
    Boolean(process.env.WOMPI_INTEGRITY_SECRET && process.env.WOMPI_EVENTS_SECRET);
  const codEnabled = baseReady && process.env.CASH_ON_DELIVERY_ENABLED === "true";

  return {
    ordersEnabled: wompiEnabled || codEnabled,
    wompiEnabled,
    codEnabled,
    codMaxCop: codMaxCop(),
  };
}

export function isStoreCheckoutEnabled() {
  return getStoreReadiness().ordersEnabled;
}
