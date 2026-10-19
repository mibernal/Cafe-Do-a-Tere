import type { Metadata } from "next";
import Link from "next/link";
import { PolicyLayout } from "@/components/policy-layout";
import { site, whatsappLink } from "@/lib/site";
import { renderPerRequest } from "@/lib/request-time";
import { isStaticSite } from "@/lib/site-target";
import { legalComplete } from "@/lib/legal";
import { LegalValue, Pending } from "@/components/legal-pending";

export function generateMetadata(): Metadata {
  return {
    title: "Tratamiento de datos personales",
    description: "Cómo Café Doña Tere trata los datos personales de quienes hacen pedidos, y cómo ejercer tus derechos.",
    alternates: { canonical: isStaticSite ? "/privacidad/" : "/privacidad" },
    robots: legalComplete() ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function PrivacyPage() {
  await renderPerRequest();
  return (
    <PolicyLayout
      title="Tratamiento de datos personales"
      draftNote={
        legalComplete()
          ? undefined
          : "Borrador en revisión. Los datos marcados como pendientes los debe completar el responsable del comercio, y el texto debe validarlo un asesor (Ley 1581 de 2012 y Decreto 1377 de 2013). Este documento no es definitivo."
      }
    >
      <section>
        <h2>Responsable</h2>
        <p>
          <LegalValue field="BUSINESS_LEGAL_NAME" label="razón social o nombre del responsable" />, identificado con NIT o
          cédula <LegalValue field="BUSINESS_TAX_ID" label="número" />, con domicilio en{" "}
          <LegalValue field="BUSINESS_ADDRESS" label="dirección y municipio" /> y correo de contacto{" "}
          <LegalValue field="BUSINESS_LEGAL_EMAIL" label="correo" />. Canal de atención por WhatsApp: {site.whatsappDisplay}.
        </p>
      </section>
      <section>
        <h2>Qué datos usamos</h2>
        {isStaticSite ? (
          <p>
            Este sitio no tiene formularios ni cuentas: la bolsa se guarda solo en tu navegador y el pedido nos llega
            cuando lo envías por WhatsApp. Para gestionarlo te pedimos por ese canal nombre, celular, ciudad, dirección e
            indicaciones de entrega y, si solicitas factura electrónica, tipo y número de documento. No pedimos datos de
            tarjetas, claves bancarias ni códigos de seguridad.
          </p>
        ) : (
          <p>
            Para gestionar un pedido pedimos nombre, correo, celular, ciudad, dirección e indicaciones de entrega. Si
            solicitas factura electrónica, también tipo y número de documento. No pedimos ni almacenamos datos de
            tarjetas, claves bancarias ni códigos de seguridad.
          </p>
        )}
      </section>
      <section>
        <h2>Para qué los usamos</h2>
        <ul>
          {isStaticSite ? (
            <li>Registrar el pedido, confirmar el pago y coordinar la entrega.</li>
          ) : (
            <>
              <li>Registrar el pedido, coordinar la entrega y confirmar pedidos contra entrega.</li>
              <li>Confirmar el estado del pago. Los pagos en línea se procesan en el checkout de Wompi; le compartimos tu nombre, correo, celular y documento (si lo diste) para prellenar el pago.</li>
            </>
          )}
          <li>Emitir la factura electrónica cuando la solicitas.</li>
          <li>Responder solicitudes sobre tu compra.</li>
        </ul>
      </section>
      <section>
        <h2>Quién más los procesa</h2>
        <p>
          <Pending>completar con los encargados reales</Pending> Por ejemplo:{" "}
          {isStaticSite
            ? "WhatsApp (Meta), por donde nos llega el pedido, y la empresa de mensajería que lo entrega."
            : "el proveedor de base de datos y alojamiento de la tienda, la pasarela de pagos Wompi y la empresa de mensajería que entrega el pedido."}
        </p>
      </section>
      <section>
        <h2>Cuánto tiempo los conservamos</h2>
        <p>
          Cinco años: el tiempo necesario para la entrega, la garantía y las obligaciones contables y tributarias.
        </p>
      </section>
      <section>
        <h2>Tus derechos</h2>
        <p>
          Puedes conocer, actualizar, rectificar y solicitar la supresión de tus datos, revocar la autorización y
          presentar quejas ante la Superintendencia de Industria y Comercio. Escríbenos a <LegalValue field="BUSINESS_LEGAL_EMAIL" label="correo" /> o por{" "}
          <a href={whatsappLink("Hola, quiero hacer una solicitud sobre mis datos personales.")} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>{" "}
          y respondemos dentro de los plazos legales.
        </p>
      </section>
      <p className="policy-foot">
        Consulta también los <Link href="/terminos">términos de compra</Link>.
      </p>
    </PolicyLayout>
  );
}
