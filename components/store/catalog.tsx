"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, PackageSearch, X } from "lucide-react";
import type { Product } from "@/lib/store-types";
import { categoryFilters, productBand, bandVars } from "@/lib/catalog-style";
import { whatsappLink, logoSrc } from "@/lib/site";
import { countCoffees } from "@/lib/coffee-profiles";
import { notesPhrase } from "@/lib/grind-options";
import { ProductPurchase, resolveSelection, type Selection } from "@/components/store/product-purchase";
import { useStore } from "@/components/store/store-provider";
import { isStaticSite } from "@/lib/site-target";

function isLabelArt(src: string) {
  return src.endsWith("-front.jpg");
}

function ProductVisual({ product, image, sizes }: { product: Product; image: string; sizes: string }) {
  if (!isLabelArt(image)) {
    return (
      <Image src={image} alt={`Granos de ${product.name}`} fill sizes={sizes} className="visual-photo" />
    );
  }
  return (
    <>
      <Image src={product.image} alt="" aria-hidden fill sizes={sizes} className="visual-backdrop" />
      <span className="visual-pack">
        <Image src={image} alt={`Etiqueta de ${product.name}`} fill sizes="(max-width: 700px) 46vw, 220px" />
      </span>
    </>
  );
}

function ProductCard({
  product,
  selection,
  onSelect,
  onOpen,
  highlighted,
}: {
  product: Product;
  selection?: Selection;
  onSelect: (selection: Selection) => void;
  onOpen: () => void;
  highlighted: boolean;
}) {
  const { variant, image } = resolveSelection(product, selection);
  if (!variant) return null;
  const anyAvailable = product.variants.some((item) => item.available);
  return (
    <article
      id={`cafe-${product.id}`}
      className={highlighted ? "product-card is-highlighted" : "product-card"}
      style={bandVars(product)}
    >
      <button type="button" className="product-visual" onClick={onOpen} aria-label={`Ver detalles de ${product.name}`}>
        <ProductVisual product={product} image={image} sizes="(max-width: 700px) 92vw, (max-width: 1100px) 45vw, 360px" />
        {product.badge && <span className="product-badge">{product.badge}</span>}
        {variant.lowStock && variant.available && <span className="stock-chip">Quedan pocas</span>}
        {variant.priceConfirmed && !anyAvailable && <span className="stock-chip stock-out">Agotado</span>}
      </button>
      <div className="product-body">
        <span className="band-ribbon">{product.process}</span>
        <h3>
          <button type="button" onClick={onOpen}>
            {product.name}
          </button>
        </h3>
        <p className="product-subtitle">{product.subtitle}</p>
        <ul className="note-list" aria-label="Notas de taza">
          {product.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <ProductPurchase product={product} selection={selection} onSelect={onSelect} />
      </div>
    </article>
  );
}

function ProductDialog({
  product,
  selection,
  onSelect,
  onClose,
}: {
  product: Product | null;
  selection?: Selection;
  onSelect: (selection: Selection) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (product && !dialog.open) dialog.showModal();
    if (!product && dialog.open) dialog.close();
  }, [product]);

  const resolved = product ? resolveSelection(product, selection) : null;
  return (
    <dialog
      ref={ref}
      className="product-dialog"
      aria-labelledby="product-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {product && resolved?.variant && (
        <div className="product-dialog-inner" style={bandVars(product)}>
          <button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Cerrar detalles">
            <X size={20} aria-hidden />
          </button>
          <div className="product-dialog-visual product-visual">
            <ProductVisual product={product} image={resolved.image} sizes="(max-width: 800px) 92vw, 420px" />
          </div>
          <div className="product-dialog-body">
            <span className="band-ribbon">{product.process}</span>
            <h2 id="product-dialog-title">{product.name}</h2>
            <p className="product-dialog-lead">{product.description}</p>
            <dl className="product-facts">
              <div>
                <dt>Origen</dt>
                <dd>{product.origin}</dd>
              </div>
              <div>
                <dt>Proceso</dt>
                <dd>{product.process}</dd>
              </div>
              <div>
                <dt>Altura</dt>
                <dd>{product.altitude}</dd>
              </div>
              <div>
                <dt>En taza</dt>
                <dd>{notesPhrase(product.notes)}</dd>
              </div>
            </dl>
            <ProductPurchase product={product} selection={selection} onSelect={onSelect} onAdded={onClose} />
          </div>
        </div>
      )}
    </dialog>
  );
}

export function Catalog() {
  const { products, filter, setFilter, highlight, pendingOrder, rememberOrder, options } = useStore();
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [openProductId, setOpenProductId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: products.length };
    for (const product of products) result[product.category] = (result[product.category] ?? 0) + 1;
    return result;
  }, [products]);
  const visible = filter === "all" ? products : products.filter((product) => product.category === filter);
  const hasReferencePrices = products.some((product) => product.variants.some((variant) => !variant.priceConfirmed));
  const openProduct = products.find((product) => product.id === openProductId) ?? null;
  const select = (productId: string) => (selection: Selection) =>
    setSelections((current) => ({ ...current, [productId]: selection }));

  return (
    <section className="catalog-section" id="cafes" aria-labelledby="catalog-title">
      <div className="section-shell">
        <header className="catalog-head">
          <div>
            <h2 id="catalog-title">Elige tu café</h2>
            <p>
              {products.length > 0 ? `${countCoffees(products.length)} de la misma finca. ` : ""}
              Escoge presentación y molienda para tu método; lo empacamos así para ti.
            </p>
          </div>
        </header>

        {pendingOrder && (
          <div className="pending-order" role="status">
            <PackageSearch size={20} aria-hidden />
            <p>
              Tienes un pedido en curso, <b>{pendingOrder.reference}</b>.
            </p>
            <Link href={pendingOrder.trackingPath} className="text-link">
              Ver estado
            </Link>
            <button type="button" className="icon-button" aria-label="Ocultar aviso del pedido" onClick={() => rememberOrder(null)}>
              <X size={16} aria-hidden />
            </button>
          </div>
        )}

        {/* Con pocos cafés los filtros solo agregan pasos: se muestran desde cinco. */}
        {products.length > 4 && (
          <div className="filter-bar" role="group" aria-label="Filtrar por proceso">
            {categoryFilters
              .filter((item) => item.id === "all" || counts[item.id])
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={filter === item.id ? "filter-chip is-active" : "filter-chip"}
                  aria-pressed={filter === item.id}
                  style={item.band ? bandVars(item.band) : undefined}
                  onClick={() => setFilter(item.id)}
                >
                  {item.band && <i aria-hidden />}
                  {item.label}
                  <span className="filter-count">{counts[item.id]}</span>
                </button>
              ))}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="catalog-empty">
            <h3>Estamos actualizando la selección de la finca.</h3>
            <p>Cuéntanos qué café buscas y te decimos qué hay disponible esta semana.</p>
            <a className="button button-outline" href={whatsappLink("Hola, Café Doña Tere. ¿Qué cafés tienen disponibles?")} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={17} aria-hidden />
              Preguntar por WhatsApp
            </a>
          </div>
        ) : (
          <div className="product-grid">
            {visible.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                selection={selections[product.id]}
                onSelect={select(product.id)}
                onOpen={() => setOpenProductId(product.id)}
                highlighted={highlight === product.id}
              />
            ))}
            {filter === "all" && products.length > 1 && (
              <aside className="catalog-tile" aria-label="Ayuda para elegir">
                <Image src={logoSrc} alt="" width={84} height={84} />
                <div className="tile-text">
                  <h3>¿Te ayudamos a elegir?</h3>
                  <p>Compara los cafés lado a lado o responde tres preguntas y te sugerimos uno, ya con la molienda para tu método.</p>
                  <p className="tile-note">
                    ¿Compras para una cafetería, oficina o un regalo corporativo?{" "}
                    <a href={whatsappLink("Hola, Café Doña Tere. Quiero cotizar café por volumen.")} target="_blank" rel="noopener noreferrer">
                      Cotiza por volumen
                    </a>
                    .
                  </p>
                </div>
                <div className="tile-actions">
                  <a className="button button-accent" href="#elegir">
                    Ayúdame a elegir
                  </a>
                  <a className="button button-ghost" href="#comparar">
                    Comparar cafés
                  </a>
                </div>
              </aside>
            )}
          </div>
        )}

        {hasReferencePrices && (
          <p className="price-disclosure">
            {options.ordersEnabled
              ? "Los cafés con precio por confirmar se piden por WhatsApp mientras la finca define su lote. Los demás se pagan aquí mismo."
              : isStaticSite
                ? "Tu bolsa se envía por WhatsApp y confirmamos contigo precio, disponibilidad y domicilio antes de cobrar."
                : "Mientras habilitamos el pago en línea, tu bolsa se envía por WhatsApp y confirmamos contigo precio, disponibilidad y domicilio antes de cobrar."}
          </p>
        )}
      </div>

      <ProductDialog
        product={openProduct}
        selection={openProduct ? selections[openProduct.id] : undefined}
        onSelect={openProduct ? select(openProduct.id) : () => undefined}
        onClose={() => setOpenProductId(null)}
      />
    </section>
  );
}
