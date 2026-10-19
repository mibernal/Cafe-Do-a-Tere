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
    title: "Términos de compra",
    description: "Condiciones de compra de Café Doña Tere: precios, medios de pago, envíos, retracto, reversión del pago y garantía.",
    alternates: { canonical: isStaticSite ? "/terminos/" : "/terminos" },
    // Un borrador con datos pendientes no se indexa.
    robots: legalComplete() ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function TermsPage() {
  await renderPerRequest();
  return (
    <PolicyLayout
      title="Términos de compra"
      draftNote={
        legalComplete()
          ? undefined
          : "Borrador en revisión. Los datos marcados como pendientes los debe completar el comercio, y el texto debe validarlo un asesor (Ley 1480 de 2011, Estatuto del Consumidor, y Decreto 587 de 2016). Este documento no es definitivo."
      }
    >
      <section>
        <h2>Quién vende</h2>
        <p>
          {site.name}, <LegalValue field="BUSINESS_LEGAL_NAME" label="razón social" />, identificación tributaria{" "}
          <LegalValue field="BUSINESS_TAX_ID" label="NIT" />, <LegalValue field="BUSINESS_ADDRESS" label="dirección" />,{" "}
          {site.town}, {site.region}. Atención por WhatsApp al {site.whatsappDisplay} y al correo{" "}
          <LegalValue field="BUSINESS_LEGAL_EMAIL" label="correo" />.
        </p>
      </section>
      <section>
        <h2>Precios y disponibilidad</h2>
        {isStaticSite ? (
          <p>
            Los precios están en pesos colombianos e incluyen los impuestos aplicables <Pending>confirmar impuestos</Pending>. Los pedidos se hacen
            por WhatsApp: antes de pagar te confirmamos disponibilidad, valor del domicilio según tu ciudad y total.
          </p>
        ) : (
          <p>
            Los precios están en pesos colombianos e incluyen los impuestos aplicables <Pending>confirmar impuestos</Pending>. El domicilio se suma
            según la ciudad y se muestra antes de pagar. Las unidades se reservan mientras completas el pago en línea (35
            minutos) o mientras confirmamos un pedido contra entrega (hasta 72 horas).
          </p>
        )}
      </section>
      <section>
        <h2>Medios de pago</h2>
        {isStaticSite ? (
          <p>
            Acordamos el medio de pago contigo por WhatsApp al confirmar el pedido <Pending>medios de pago aceptados</Pending>. El
            pedido queda confirmado cuando te enviamos la confirmación por ese mismo canal.
          </p>
        ) : (
          <p>
            Pago en línea a través de Wompi (tarjetas, PSE, Nequi, Botón Bancolombia y otros medios habilitados) y, en las
            ciudades habilitadas, pago en efectivo contra entrega hasta el monto indicado en la tienda. El pedido en línea
            se confirma solo cuando Wompi aprueba el pago.
          </p>
        )}
      </section>
      <section>
        <h2>Envíos</h2>
        <p>
          <Pending>tiempos, cobertura, transportadoras y qué pasa si no hay nadie para recibir</Pending>
        </p>
      </section>
      <section>
        <h2>Derecho de retracto</h2>
        <p>
          <Pending>
            validar su aplicación y excepciones para alimentos y productos preparados según las especificaciones del
            cliente, como la molienda
          </Pending> Cuando aplique, puedes ejercerlo dentro de los cinco días hábiles siguientes a la
          entrega, devolviendo el producto en las mismas condiciones; el dinero se reintegra dentro de los treinta días
          calendario siguientes.
        </p>
      </section>
      <section>
        <h2>Reversión del pago</h2>
        <p>
          Si pagaste con un medio electrónico y fuiste objeto de fraude, la operación no fue solicitada, el producto no
          llegó o no corresponde a lo pedido o está defectuoso, puedes solicitar la reversión del pago dentro de los cinco
          días hábiles siguientes a la fecha en que conociste la situación: presenta la queja ante nosotros e informa al
          emisor del medio de pago.
        </p>
      </section>
      <section>
        <h2>Garantía y atención</h2>
        <p>
          Si tu café llega en mal estado o no corresponde a lo que pediste,{" "}
          <a href={whatsappLink("Hola, tengo una novedad con mi pedido.")} target="_blank" rel="noopener noreferrer">
            escríbenos
          </a>{" "}
          con el número de pedido y una foto, y lo resolvemos.
        </p>
      </section>
      <p className="policy-foot">
        Consulta también la <Link href="/privacidad">política de tratamiento de datos</Link>.
      </p>
    </PolicyLayout>
  );
}
