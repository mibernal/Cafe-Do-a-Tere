import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { CheckoutOptions, Product } from "@/lib/store-types";
import { productBand, bandVars } from "@/lib/catalog-style";
import { formatCOP } from "@/lib/money";
import { site, whatsappLink, logoSrc, varietiesLabel, varietiesPhrase, altitudeText } from "@/lib/site";
import { coffeeProfile, countCoffees } from "@/lib/coffee-profiles";
import { asset, isStaticSite } from "@/lib/site-target";

export type NavLink = { href: string; label: string };

function joinNames(names: string[]) {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function heroLine(products: Product[]) {
  if (products.length === 0) return "Estamos preparando el próximo lote de la finca.";
  if (products.length === 1) return `Nuestro ${products[0].name}, molido para tu método.`;
  if (products.length <= 3) {
    return `${joinNames(products.map((product) => product.name))}: ${countCoffees(products.length).toLowerCase()} de la finca, molidos para tu método.`;
  }
  return `${countCoffees(products.length)} de la finca, de la tradición a la leña a sus microlotes, molidos para tu método.`;
}

const fallbackPacks = ["/assets/cafe-lena-250-front.jpg", "/assets/cafe-precision-500-front.jpg", "/assets/cafe-lena-500-beans-front.jpg"].map(asset);

function heroPacks(products: Product[]) {
  const packs = products
    .map((product) => product.variants.find((variant) => variant.image.endsWith("-front.jpg"))?.image)
    .filter((image): image is string => Boolean(image));
  for (const image of fallbackPacks) if (packs.length < 3 && !packs.includes(image)) packs.push(image);
  return packs.slice(0, 3);
}

export function paymentSentence(options: CheckoutOptions) {
  if (options.wompiEnabled && options.codEnabled)
    return "Paga en línea con tarjeta, PSE, Nequi o Bancolombia a través de Wompi, o en efectivo contra entrega en las ciudades habilitadas.";
  if (options.wompiEnabled) return "Paga en línea con tarjeta, PSE, Nequi o Bancolombia a través del checkout seguro de Wompi.";
  if (options.codEnabled) return "Paga en efectivo al recibir tu pedido en las ciudades habilitadas.";
  return "Arma tu bolsa y envíanosla por WhatsApp: confirmamos precio, domicilio y forma de pago contigo.";
}

export function Hero({ options, products, showFinder }: { options: CheckoutOptions; products: Product[]; showFinder: boolean }) {
  // La bolsa del centro es el primer café de la vitrina.
  const [center, left, right] = heroPacks(products);
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="hero-origin">
          {site.farm}, {site.town} ({site.region})
        </p>
        <h1 id="hero-title">Café con alma de abuela</h1>
        <p className="hero-lead">
          Lo cultivamos en las montañas de Cachipay y lo tostamos con calma, como lo hacía Doña Tere.{" "}
          {heroLine(products)}
        </p>
        <div className="hero-actions">
          <a className="button button-accent" href="#cafes">
            Comprar café
          </a>
          {showFinder && (
            <a className="button button-ghost" href="#elegir">
              Ayúdame a elegir
            </a>
          )}
        </div>
        <p className="hero-payments">{paymentSentence(options)}</p>
      </div>
      <div className="hero-art" aria-hidden>
        <div className="hero-roast">
          <Image src={asset("/assets/roasting.jpg")} alt="" fill preload fetchPriority="high" sizes="(max-width: 860px) 70vw, 34vw" />
        </div>
        <div className="hero-bag hero-bag-1">
          <Image src={left} alt="" fill sizes="(max-width: 860px) 32vw, 15vw" />
        </div>
        <div className="hero-bag hero-bag-2">
          <Image src={center} alt="" fill preload sizes="(max-width: 860px) 36vw, 17vw" />
        </div>
        <div className="hero-bag hero-bag-3">
          <Image src={right} alt="" fill sizes="(max-width: 860px) 32vw, 15vw" />
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
  // Cada mitad de la cinta debe superar el ancho de la pantalla para que el
  // ciclo no deje huecos, también con pocos cafés.
  const half = Array.from({ length: Math.max(1, Math.ceil(8 / items.length)) }, () => items).flat();
  const track = [...half, ...half];
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
    // El enlace privado de seguimiento solo existe con pedidos en línea.
    options.ordersEnabled
      ? {
          title: "Sigue tu pedido",
          text: "Con tu compra recibes un enlace privado para ver cada paso, del pago a la entrega en tu puerta.",
        }
      : {
          title: "Te avisamos por WhatsApp",
          text: "Coordinamos contigo la entrega por WhatsApp y te contamos cuándo sale tu café de la finca.",
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
            <Image src={asset("/assets/beans-closeup.jpg")} alt="Granos de café tostados en Finca La Libertad" fill sizes="(max-width: 860px) 80vw, 420px" />
          </div>
          <div className="origin-photo origin-photo-small">
            <Image src={asset("/assets/roasting.jpg")} alt="Tostión del café en paila a la leña" fill sizes="(max-width: 860px) 40vw, 200px" />
          </div>
        </div>
        <div className="origin-copy">
          <h2 id="origin-title">Una finca familiar en las montañas de Cachipay</h2>
          <p>
            Doña Tere es una tradición familiar convertida en café. En Finca La Libertad cultivamos café arábica entre
            montañas, frutales y mandarinos, y cuidamos cada paso: la cosecha, el secado y una tostión sin afán.
          </p>
          <p>
            En la finca crecen dos variedades: {varietiesPhrase}. Los cafés de la casa comparten finca, altura y
            variedades; lo que los distingue es el proceso y la tostión.
          </p>
          <p>
            El tostado a la leña es la receta de la casa: el grano se mueve a mano sobre el fuego hasta que el aroma
            dice que está listo. Así llega a tu mesa un café con el carácter de su origen.
          </p>
          <dl className="origin-facts">
            <div>
              <dt>Altura</dt>
              <dd>{altitudeText(site.altitude)}</dd>
            </div>
            <div>
              <dt>Municipio</dt>
              <dd>
                {site.town}, {site.region}
              </dd>
            </div>
            <div>
              <dt>Especie</dt>
              <dd>{site.species}</dd>
            </div>
            <div>
              <dt>Clasificación</dt>
              <dd>{site.grade}</dd>
            </div>
            <div className="origin-fact-wide">
              <dt>Variedades</dt>
              <dd>{varietiesLabel}</dd>
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
    {
      title: "Recíbelo en casa",
      text: options.ordersEnabled
        ? "Sigue el pedido con tu enlace privado hasta que llegue a tu puerta."
        : "Te avisamos por WhatsApp cuando salga de la finca y hasta que llegue a tu puerta.",
    },
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

export function Faq({ options, products }: { options: CheckoutOptions; products: Product[] }) {
  const categories = new Set(products.map((product) => product.category));
  const questions: { q: string; a: React.ReactNode }[] = [
    {
      q: "¿De dónde viene el café?",
      a: `De Finca La Libertad, en Cachipay, Cundinamarca, entre 1.450 y 1.650 metros sobre el nivel del mar. Es café 100% arábica, de las variedades Castillo y Caturra, con clasificación excelso (la calidad comercial del grano). Lo cultiva y lo tuesta la familia.`,
    },
    {
      q: "¿Qué variedades cultivan?",
      a: (
        <>
          <p>
            {varietiesPhrase.charAt(0).toUpperCase() + varietiesPhrase.slice(1)}. El Castillo lo desarrolló Cenicafé,
            el centro de investigación de los caficultores colombianos, a partir del Caturra y del Híbrido de Timor, y
            se entregó en 2005. Resiste la roya, una de las enfermedades que más daño le hacen al cafeto. El Caturra
            es una mutación natural del Bourbon descubierta en Brasil, de planta compacta, y es uno de los padres del
            Castillo.
          </p>
          <p>
            Ni las pruebas de Cenicafé ni una cata a ciegas organizada por Catholic Relief Services y World Coffee
            Research encontraron diferencias de calidad entre las dos. Sí cambian algunos matices: el Castillo tiende
            al chocolate oscuro y a las nueces tostadas, y el Caturra, a notas florales, de cacao y de caramelo.
          </p>
        </>
      ),
    },
  ];
  if (products.length > 1) {
    questions.push({
      q: "¿Qué diferencia hay entre los cafés?",
      a: (
        <ul className="faq-points">
          {products.map((product) => (
            <li key={product.id}>
              <b>{product.name}.</b> {coffeeProfile(product).pitch || product.subtitle}
            </li>
          ))}
        </ul>
      ),
    });
  }
  if (categories.has("washed") || categories.has("natural")) {
    questions.push({
      q: "¿Qué diferencia hay entre lavado, honey y natural?",
      a: "Es cuánta fruta acompaña al grano mientras se seca. El lavado se seca limpio y da una taza brillante; los honey conservan parte de la miel del fruto y ganan dulzor y cuerpo; el natural se seca dentro de la cereza entera y es el más frutal.",
    });
  } else if (categories.has("honey")) {
    questions.push({
      q: "¿Qué es un café honey?",
      a: "Es un proceso en el que el grano se seca con parte de la miel (el mucílago) de su fruto. Eso le da más dulzor y cuerpo que un café lavado. En el Honey Red se conserva buena parte de esa miel y el secado es más pausado.",
    });
  }
  questions.push(
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
        isStaticSite
          ? "Confirmamos tu pedido por WhatsApp y ahí te compartimos los medios de pago disponibles."
          : "Mientras habilitamos el pago en línea, confirmamos tu pedido por WhatsApp y te compartimos un enlace de pago de Wompi o las instrucciones de pago."
      ),
    },
    {
      q: "¿Cuánto cuesta y cuánto tarda el envío?",
      a: options.ordersEnabled
        ? "El domicilio depende de tu ciudad. Lo ves antes de pagar, junto con el tiempo estimado de entrega. Si tu ciudad no aparece, escríbenos y lo cotizamos."
        : "El domicilio depende de tu ciudad. Te lo confirmamos por WhatsApp antes de pagar, junto con el tiempo estimado de entrega.",
    },
    {
      q: "¿Cómo sé en qué va mi pedido?",
      a: options.ordersEnabled
        ? "Al terminar la compra te llevamos a una página de seguimiento con un enlace privado. Guárdalo: ahí ves la confirmación del pago, la preparación y el despacho."
        : "Te contamos por WhatsApp cuando confirmamos el pago, cuando preparamos tu café y cuando sale de la finca.",
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
  );
  if (options.codEnabled) {
    questions.splice(questions.findIndex((item) => item.q.startsWith("¿Cuánto cuesta")), 0, {
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
      <Image src={logoSrc} alt="" width={132} height={132} className="closing-logo" />
      <h2 id="closing-title">Una buena taza cambia la mañana</h2>
      <p>Elige el tuyo y nosotros lo tostamos, molemos y enviamos desde la finca.</p>
      <a className="button button-accent" href="#cafes">
        Ver los cafés
      </a>
    </section>
  );
}

export function SiteFooter({ options, nav }: { options: CheckoutOptions; nav: NavLink[] }) {
  const storeLinks = nav.filter((link) => ["#cafes", "#comparar", "#elegir", "#procesos"].includes(link.href));
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <Image src={logoSrc} alt="" width={64} height={64} />
          <p>
            <strong>{site.name}</strong>
            {site.farm}, {site.town}, {site.region}.
          </p>
        </div>
        <nav aria-label="Tienda">
          <h2>Tienda</h2>
          {storeLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
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
