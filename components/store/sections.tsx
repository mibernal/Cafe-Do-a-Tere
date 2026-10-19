import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { CheckoutOptions, Product } from "@/lib/store-types";
import { productBand, bandVars } from "@/lib/catalog-style";
import { formatCOP } from "@/lib/money";
import { site, whatsappLink } from "@/lib/site";

export function paymentSentence(options: CheckoutOptions) {
  if (options.wompiEnabled && options.codEnabled)
    return "Paga en línea con tarjeta, PSE, Nequi o Bancolombia a través de Wompi, o en efectivo contra entrega en las ciudades habilitadas.";
  if (options.wompiEnabled) return "Paga en línea con tarjeta, PSE, Nequi o Bancolombia a través del checkout seguro de Wompi.";
  if (options.codEnabled) return "Paga en efectivo al recibir tu pedido en las ciudades habilitadas.";
  return "Arma tu bolsa y envíanosla por WhatsApp: confirmamos precio, domicilio y forma de pago contigo.";
}

export function Hero({ options }: { options: CheckoutOptions }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="hero-origin">
          {site.farm}, {site.town} ({site.region})
        </p>
        <h1 id="hero-title">Café con alma de abuela</h1>
        <p className="hero-lead">
          Lo cultivamos en las montañas de Cachipay y lo tostamos con calma, como lo hacía Doña Tere. Siete perfiles,
          de la tradición a la leña a los honeys de la finca, molidos para tu método.
        </p>
        <div className="hero-actions">
          <a className="button button-accent" href="#cafes">
            Comprar café
          </a>
          <a className="button button-ghost" href="#elegir">
            Ayúdame a elegir
          </a>
        </div>
        <p className="hero-payments">{paymentSentence(options)}</p>
      </div>
      <div className="hero-art" aria-hidden>
        <div className="hero-roast">
          <Image src="/assets/roasting.jpg" alt="" fill preload sizes="(max-width: 860px) 70vw, 34vw" />
        </div>
        <div className="hero-bag hero-bag-1">
          <Image src="/assets/cafe-lena-250-front.jpg" alt="" fill sizes="(max-width: 860px) 32vw, 15vw" />
        </div>
        <div className="hero-bag hero-bag-2">
          <Image src="/assets/cafe-precision-500-front.jpg" alt="" fill preload sizes="(max-width: 860px) 36vw, 17vw" />
        </div>
        <div className="hero-bag hero-bag-3">
          <Image src="/assets/cafe-honey-black-500-front.jpg" alt="" fill sizes="(max-width: 860px) 32vw, 15vw" />
        </div>
        <span className="hero-seal">
          100%
          <small>café colombiano</small>
        </span>
      </div>
    </section>
  );
}

/** La cinta de bandas de etiqueta: el único movimiento automático de la página. */
export function VarietyRibbon({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  const items = products.map((product) => ({ id: product.id, label: product.process, band: productBand(product) }));
  const track = [...items, ...items];
  return (
    <div className="variety-ribbon" aria-hidden>
      <div className="ribbon-track">
        {track.map((item, index) => (
          <span key={`${item.id}-${index}`} style={bandVars(item.band)}>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Benefits({ options }: { options: CheckoutOptions }) {
  const items = [
    {
      title: "Molido para tu método",
      text: "Espresso, moka, V60, Chemex, prensa francesa, cold brew o en grano. Lo empacamos como lo vas a preparar.",
    },
    {
      title: options.ordersEnabled ? "Paga como prefieras" : "Te acompañamos en la compra",
      text: paymentSentence(options),
    },
    {
      title: "Sigue tu pedido",
      text: "Con tu compra recibes un enlace privado para ver cada paso, del pago a la entrega en tu puerta.",
    },
  ];
  return (
    <section className="benefits" aria-label="Por qué comprar en la finca">
      {items.map((item) => (
        <div key={item.title}>
          <h2>{item.title}</h2>
          <p>{item.text}</p>
        </div>
      ))}
    </section>
  );
}

export function OriginSection() {
  return (
    <section className="origin-section" id="finca" aria-labelledby="origin-title">
      <div className="section-shell origin-layout">
        <div className="origin-visual">
          <div className="origin-photo">
            <Image src="/assets/beans-closeup.jpg" alt="Granos de café tostados en Finca La Libertad" fill sizes="(max-width: 860px) 80vw, 420px" />
          </div>
          <div className="origin-photo origin-photo-small">
            <Image src="/assets/roasting.jpg" alt="Tostión del café en paila a la leña" fill sizes="(max-width: 860px) 40vw, 200px" />
          </div>
        </div>
        <div className="origin-copy">
          <h2 id="origin-title">Una finca familiar en las montañas de Cachipay</h2>
          <p>
            Doña Tere es una tradición familiar convertida en café. En Finca La Libertad cultivamos café arábica entre
            montañas, frutales y mandarinos, y cuidamos cada paso: la cosecha, el secado y una tostión sin afán.
          </p>
          <p>
            El tostado a la leña es la receta de la casa: el grano se mueve a mano sobre el fuego hasta que el aroma
            dice que está listo. Así llega a tu mesa un café con el carácter de su origen.
          </p>
          <dl className="origin-facts">
            <div>
              <dt>Altura</dt>
              <dd>{site.altitude}</dd>
            </div>
            <div>
              <dt>Municipio</dt>
              <dd>
                {site.town}, {site.region}
              </dd>
            </div>
            <div>
              <dt>Variedad</dt>
              <dd>Café excelso 100% arábica</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

export function HowToBuy({ options }: { options: CheckoutOptions }) {
  const steps = [
    { title: "Elige tu café", text: "Escoge el perfil, la presentación y la molienda para tu método." },
    {
      title: options.ordersEnabled ? "Paga a tu manera" : "Envíanos tu bolsa",
      text: options.ordersEnabled
        ? `${options.wompiEnabled ? "En línea con Wompi" : ""}${options.wompiEnabled && options.codEnabled ? " o " : ""}${options.codEnabled ? `contra entrega en pedidos hasta ${formatCOP(options.codMaxCop)}` : ""}.`
        : "Te confirmamos precio, domicilio y forma de pago por WhatsApp.",
    },
    { title: "Recíbelo en casa", text: "Sigue el pedido con tu enlace privado hasta que llegue a tu puerta." },
  ];
  return (
    <section className="howto" aria-labelledby="howto-title">
      <div className="section-shell">
        <h2 id="howto-title">Comprar es sencillo</h2>
        <ol className="howto-steps">
          {steps.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.text.charAt(0).toUpperCase() + step.text.slice(1)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Faq({ options }: { options: CheckoutOptions }) {
  const questions: { q: string; a: React.ReactNode }[] = [
    {
      q: "¿De dónde viene el café?",
      a: "De Finca La Libertad, en Cachipay, Cundinamarca, entre 1.450 y 1.650 metros sobre el nivel del mar. Es café excelso 100% arábica, cultivado y tostado por la familia.",
    },
    {
      q: "¿Qué diferencia hay entre lavado, honey y natural?",
      a: "Es cuánta fruta acompaña al grano mientras se seca. El lavado se seca limpio y da una taza brillante; los honey conservan parte de la miel del fruto (más en el Red y todo en el Black) y ganan dulzor y cuerpo; el natural se seca dentro de la cereza entera y es el más frutal.",
    },
    {
      q: "¿Puedo escoger la molienda?",
      a: "Sí. Cada presentación muestra las moliendas disponibles: espresso, moka, V60, cafetera eléctrica, Chemex, prensa francesa, AeroPress, cold brew o en grano para moler en casa.",
    },
    {
      q: "¿Qué medios de pago aceptan?",
      a: options.ordersEnabled ? (
        <>
          {options.wompiEnabled &&
            "En línea a través de Wompi, la pasarela de Bancolombia: tarjetas débito y crédito, PSE, Nequi, Botón Bancolombia y pago en efectivo en corresponsales, según los medios habilitados para la tienda. "}
          {options.codEnabled &&
            `También puedes pagar en efectivo contra entrega en las ciudades habilitadas, para pedidos hasta ${formatCOP(options.codMaxCop)}.`}
        </>
      ) : (
        "Mientras habilitamos el pago en línea, confirmamos tu pedido por WhatsApp y te compartimos un enlace de pago de Wompi o las instrucciones de pago."
      ),
    },
    {
      q: "¿Cuánto cuesta y cuánto tarda el envío?",
      a: "El domicilio depende de tu ciudad. Lo ves antes de pagar, junto con el tiempo estimado de entrega. Si tu ciudad no aparece, escríbenos y lo cotizamos.",
    },
    {
      q: "¿Cómo sé en qué va mi pedido?",
      a: "Al terminar la compra te llevamos a una página de seguimiento con un enlace privado. Guárdalo: ahí ves la confirmación del pago, la preparación y el despacho.",
    },
    {
      q: "¿Y si tengo un problema con mi pedido?",
      a: (
        <>
          Escríbenos por WhatsApp y lo resolvemos. Las condiciones de cambios, retracto y reversión del pago están en los{" "}
          <Link href="/terminos">términos de compra</Link>.
        </>
      ),
    },
  ];
  if (options.codEnabled) {
    questions.splice(4, 0, {
      q: "¿Cómo funciona el pago contra entrega?",
      a: "Eliges “Contra entrega” al finalizar. Te contactamos para confirmar el pedido y, al recibirlo, pagas el total en efectivo a quien lo entrega. Si no logramos confirmarlo en 72 horas, liberamos el pedido.",
    });
  }
  return (
    <section className="faq-section" id="ayuda" aria-labelledby="faq-title">
      <div className="section-shell faq-layout">
        <div className="faq-intro">
          <h2 id="faq-title">Preguntas frecuentes</h2>
          <p>¿Algo que no esté aquí? Te respondemos por WhatsApp.</p>
          <a className="button button-outline" href={whatsappLink("Hola, Café Doña Tere. Tengo una pregunta.")} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={17} aria-hidden />
            Escribir por WhatsApp
          </a>
        </div>
        <div className="faq-list">
          {questions.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <div className="faq-answer">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section className="closing" aria-labelledby="closing-title">
      <Image src="/assets/logo-cafe-dona-tere.png" alt="" width={132} height={132} className="closing-logo" />
      <h2 id="closing-title">Una buena taza cambia la mañana</h2>
      <p>Elige el tuyo y nosotros lo tostamos, molemos y enviamos desde la finca.</p>
      <a className="button button-accent" href="#cafes">
        Ver los cafés
      </a>
    </section>
  );
}

export function SiteFooter({ options }: { options: CheckoutOptions }) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <Image src="/assets/logo-cafe-dona-tere.png" alt="" width={64} height={64} />
          <p>
            <strong>{site.name}</strong>
            {site.farm}, {site.town}, {site.region}.
          </p>
        </div>
        <nav aria-label="Tienda">
          <h2>Tienda</h2>
          <a href="#cafes">Cafés</a>
          <a href="#procesos">Procesos</a>
          <a href="#elegir">Ayúdame a elegir</a>
        </nav>
        <nav aria-label="Ayuda">
          <h2>Ayuda</h2>
          <a href="#ayuda">Preguntas frecuentes</a>
          <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">
            WhatsApp {site.whatsappDisplay}
          </a>
          {site.contactEmail && <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>}
          {site.instagramUrl && (
            <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          )}
        </nav>
        <nav aria-label="Legal">
          <h2>Legal</h2>
          <Link href="/terminos">Términos de compra</Link>
          <Link href="/privacidad">Tratamiento de datos</Link>
          <a href="https://www.sic.gov.co" target="_blank" rel="noopener noreferrer">
            Superintendencia de Industria y Comercio
          </a>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} {site.name}</span>
        <span>{options.wompiEnabled ? "Pagos en línea procesados por Wompi." : "Hecho con cariño en Cachipay."}</span>
      </div>
    </footer>
  );
}
