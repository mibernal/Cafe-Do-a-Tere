import type { Metadata } from "next";
import Link from "next/link";
import { PolicyLayout } from "@/components/policy-layout";
import { site, whatsappLink } from "@/lib/site";

export const metadata: Metadata = { title: "Tratamiento de datos personales" };
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <PolicyLayout
      title="Tratamiento de datos personales"
      draftNote="Borrador para completar por el responsable del comercio antes de habilitar pedidos (Ley 1581 de 2012 y Decreto 1377 de 2013). Los campos entre corchetes deben reemplazarse con la información real."
    >
      <section>
        <h2>Responsable</h2>
        <p>
          [Razón social o nombre del responsable], identificado con NIT o cédula [número], con domicilio en [dirección,
          municipio] y correo de contacto [correo]. Canal de atención por WhatsApp: {site.whatsappDisplay}.
        </p>
      </section>
      <section>
        <h2>Qué datos usamos</h2>
        <p>
          Para gestionar un pedido pedimos nombre, correo, celular, ciudad, dirección e indicaciones de entrega. Si
          solicitas factura electrónica, también tipo y número de documento. No pedimos ni almacenamos datos de tarjetas,
          claves bancarias ni códigos de seguridad.
        </p>
      </section>
      <section>
        <h2>Para qué los usamos</h2>
        <ul>
          <li>Registrar el pedido, coordinar la entrega y confirmar pedidos contra entrega.</li>
          <li>Confirmar el estado del pago. Los pagos en línea se procesan en el checkout de Wompi; le compartimos tu nombre, correo, celular y documento (si lo diste) para prellenar el pago.</li>
          <li>Emitir la factura electrónica cuando la solicitas.</li>
          <li>Responder solicitudes sobre tu compra.</li>
        </ul>
      </section>
      <section>
        <h2>Quién más los procesa</h2>
        <p>
          [Completar con los encargados reales.] Por ejemplo: el proveedor de base de datos y alojamiento de la tienda,
          la pasarela de pagos Wompi y la empresa de mensajería que entrega el pedido.
        </p>
      </section>
      <section>
        <h2>Cuánto tiempo los conservamos</h2>
        <p>[Completar.] El tiempo necesario para la entrega, la garantía y las obligaciones contables y tributarias.</p>
      </section>
      <section>
        <h2>Tus derechos</h2>
        <p>
          Puedes conocer, actualizar, rectificar y solicitar la supresión de tus datos, revocar la autorización y
          presentar quejas ante la Superintendencia de Industria y Comercio. Escríbenos a [correo] o por{" "}
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
