import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, hasDatabaseConfig } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-auth";
import { formatCOP } from "@/lib/money";
import { getStoreReadiness, privacyPolicyVersion, wompiKeysMatchEnvironment } from "@/lib/store-config";
import { missingLegalItems } from "@/lib/legal";
import { logoSrc } from "@/lib/site";
import {
  CatalogManager,
  InventoryTable,
  OrdersBoard,
  ShippingRatesTable,
  type AdminOrder,
  type AdminProduct,
  type AdminShippingRate,
} from "@/components/admin-console";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Panel de la tienda",
  robots: { index: false, follow: false, noarchive: true },
};

type Metrics = {
  paid_revenue_cop: number;
  revenue_7d_cop: number;
  paid_orders: number;
  pending_orders: number;
  cod_pending_orders: number;
  to_fulfill_orders: number;
  cod_receivable_cop: number;
  total_orders: number;
  low_stock_variants: number;
  payment_review_orders: number;
};

function AdminBrand({ subtitle }: { subtitle: string }) {
  return (
    <Link className="brand" href="/">
      <Image src={logoSrc} alt="" width={44} height={44} />
      <span>
        <strong>Café Doña Tere</strong>
        <small>{subtitle}</small>
      </span>
    </Link>
  );
}

export default async function AdminPage() {
  if (!hasDatabaseConfig() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <main className="simple-page">
        <AdminBrand subtitle="Panel de la tienda" />
        <h1>Conecta la base de datos</h1>
        <p>Configura Supabase en las variables de entorno y aplica las migraciones para activar pedidos, inventario y métricas.</p>
        <Link className="button button-primary" href="/">
          Volver a la tienda
        </Link>
      </main>
    );
  }
  const auth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!isAdminUser(user)) redirect("/admin/login");

  const db = createAdminClient();
  const [ordersResult, productsResult, metricsResult, shippingResult] = await Promise.all([
    db
      .from("orders")
      .select(
        "id,reference,status,payment_method,payment_review_reason,customer_name,customer_phone,customer_email,customer_document_type,customer_document_number,city,address,delivery_notes,subtotal_cop,shipping_cop,total_cop,created_at,expires_at,paid_at,wompi_transaction_id,courier_tracking_url,courier_name,courier_tracking_code,cancelled_reason,order_items(product_name,variant_label,grind,quantity,line_total_cop)",
      )
      .order("created_at", { ascending: false })
      .limit(120),
    db
      .from("products")
      .select(
        "id,name,subtitle,description,notes,badge,is_published,sort_order,product_variants(id,label,weight_grams,price_cop,price_confirmed,stock_on_hand,stock_reserved,grinds,is_active,sort_order)",
      )
      .order("sort_order"),
    db.from("admin_store_metrics").select("*").single(),
    db.from("shipping_rates").select("city_key,city_label,price_cop,is_active,cod_enabled,eta_label").order("city_label"),
  ]);

  const orders = (ordersResult.data ?? []) as AdminOrder[];
  const products: AdminProduct[] = (productsResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    subtitle: row.subtitle ?? "",
    description: row.description ?? "",
    notes: row.notes ?? [],
    badge: row.badge ?? "",
    published: row.is_published,
    sortOrder: row.sort_order,
    variants: [...(row.product_variants ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((variant) => ({
        id: variant.id,
        label: variant.label,
        weightGrams: variant.weight_grams,
        priceCop: Number(variant.price_cop),
        priceConfirmed: variant.price_confirmed,
        stockOnHand: variant.stock_on_hand,
        stockReserved: variant.stock_reserved,
        grinds: variant.grinds ?? [],
        active: variant.is_active,
      })),
  }));
  const rates = (shippingResult.data ?? []).map((rate) => ({ ...rate, price_cop: Number(rate.price_cop) })) as AdminShippingRate[];
  const metrics = (metricsResult.data ?? {}) as Partial<Metrics>;
  const n = (value: unknown) => Number(value ?? 0);

  const readiness = getStoreReadiness();
  const legalMissing = missingLegalItems();
  const sellable = products.reduce(
    (sum, product) => sum + (product.published ? product.variants.filter((v) => v.active && v.priceConfirmed && v.stockOnHand - v.stockReserved > 0).length : 0),
    0,
  );
  const checklist = [
    { ok: process.env.STORE_CHECKOUT_ENABLED === "true", label: "Pedidos en línea activados", hint: "STORE_CHECKOUT_ENABLED=true" },
    { ok: privacyPolicyVersion() !== null, label: "Política de datos publicada", hint: "PRIVACY_POLICY_VERSION sin la palabra draft" },
    {
      ok: legalMissing.length === 0,
      label: "Datos legales completos",
      hint: `Faltan ${legalMissing.length}: ${legalMissing.join("; ")}`,
    },
    { ok: wompiKeysMatchEnvironment(), label: `Llaves Wompi (${process.env.WOMPI_ENVIRONMENT === "production" ? "producción" : "pruebas"})`, hint: "Llaves pública/privada del mismo ambiente" },
    { ok: readiness.codEnabled, label: "Contra entrega", hint: "CASH_ON_DELIVERY_ENABLED=true y ciudades marcadas" },
    { ok: rates.some((rate) => rate.is_active), label: "Ciudades con domicilio", hint: "Agrega al menos una tarifa activa" },
    { ok: sellable > 0, label: `${sellable} presentaciones a la venta`, hint: "Precio confirmado e inventario disponible" },
  ];
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Bogota" }));
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <main className="admin-page">
      <header className="admin-header">
        <AdminBrand subtitle="Panel de la tienda" />
        <nav className="admin-nav" aria-label="Secciones del panel">
          <a href="#pedidos">Pedidos</a>
          <a href="#inventario">Inventario</a>
          <a href="#catalogo">Catálogo</a>
          <a href="#envios">Envíos</a>
        </nav>
        <div className="admin-user">
          <span>{user.email}</span>
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="text-button">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <div className="admin-main">
        <section className="admin-hello">
          <h1>{greeting}, Doña Tere</h1>
          <p>
            {n(metrics.to_fulfill_orders) + n(metrics.cod_pending_orders) > 0
              ? `Hay ${n(metrics.to_fulfill_orders) + n(metrics.cod_pending_orders)} pedidos por atender.`
              : "No hay pedidos pendientes por atender."}
          </p>
        </section>

        <section className="metric-grid" aria-label="Indicadores">
          <article>
            <small>Ventas, últimos 7 días</small>
            <strong>{formatCOP(n(metrics.revenue_7d_cop))}</strong>
            <p>
              {formatCOP(n(metrics.paid_revenue_cop))} en total, {n(metrics.paid_orders)} pedidos pagados
            </p>
          </article>
          <article className={n(metrics.cod_pending_orders) > 0 ? "metric-attention" : undefined}>
            <small>Contra entrega por confirmar</small>
            <strong>{n(metrics.cod_pending_orders)}</strong>
            <p>{formatCOP(n(metrics.cod_receivable_cop))} por cobrar en despachos</p>
          </article>
          <article>
            <small>Pagados por preparar</small>
            <strong>{n(metrics.to_fulfill_orders)}</strong>
            <p>{n(metrics.pending_orders)} esperando pago en Wompi</p>
          </article>
          <article className={n(metrics.low_stock_variants) > 0 ? "metric-attention" : undefined}>
            <small>Presentaciones con poco stock</small>
            <strong>{n(metrics.low_stock_variants)}</strong>
            <p>Cinco unidades o menos</p>
          </article>
          <article className={n(metrics.payment_review_orders) > 0 ? "metric-alert" : undefined}>
            <small>Novedades de pago</small>
            <strong>{n(metrics.payment_review_orders)}</strong>
            <p>Pagos tardíos o duplicados</p>
          </article>
        </section>

        <section className="admin-section readiness" aria-labelledby="readiness-title">
          <h2 id="readiness-title">Estado de la tienda</h2>
          <ul>
            {checklist.map((item) => (
              <li key={item.label} className={item.ok ? "is-ok" : undefined}>
                {item.ok ? <CheckCircle2 size={18} aria-hidden /> : <CircleDashed size={18} aria-hidden />}
                <span>
                  {item.label}
                  {!item.ok && <small>{item.hint}</small>}
                </span>
              </li>
            ))}
          </ul>
          {!readiness.ordersEnabled && (
            <p className="readiness-note">
              <AlertTriangle size={16} aria-hidden /> Mientras falte la configuración, la tienda recibe pedidos por WhatsApp.
            </p>
          )}
        </section>

        <section className="admin-section" id="pedidos" aria-labelledby="orders-title">
          <h2 id="orders-title">Pedidos</h2>
          {ordersResult.error ? (
            <p className="admin-feedback is-error">No fue posible consultar los pedidos. Revisa que las migraciones estén aplicadas.</p>
          ) : (
            <OrdersBoard orders={orders} />
          )}
        </section>

        <section className="admin-section" id="inventario" aria-labelledby="inventory-title">
          <h2 id="inventory-title">Inventario</h2>
          <p className="section-hint">Suma unidades al tostar un lote y resta por mermas o ajustes. Las reservas de pedidos abiertos no se pueden descontar.</p>
          {productsResult.error ? <p className="admin-feedback is-error">No fue posible consultar el inventario.</p> : <InventoryTable products={products} />}
        </section>

        <section className="admin-section" id="catalogo" aria-labelledby="catalog-title">
          <h2 id="catalog-title">Catálogo</h2>
          <p className="section-hint">Una presentación solo se puede pagar en línea con precio confirmado, inventario y el producto publicado.</p>
          {productsResult.error ? <p className="admin-feedback is-error">No fue posible consultar el catálogo.</p> : <CatalogManager products={products} />}
        </section>

        <section className="admin-section" id="envios" aria-labelledby="shipping-title">
          <h2 id="shipping-title">Ciudades y domicilios</h2>
          <p className="section-hint">El cliente elige su ciudad de esta lista y la tienda suma el domicilio en el servidor. Marca dónde aceptas contra entrega.</p>
          {shippingResult.error ? <p className="admin-feedback is-error">No fue posible consultar las tarifas.</p> : <ShippingRatesTable rates={rates} />}
        </section>

        <p className="admin-footnote">
          Los pagos en línea se confirman con la notificación firmada de Wompi y una consulta a su API. Cada cambio de inventario, precio y tarifa queda auditado.
        </p>
      </div>
    </main>
  );
}
