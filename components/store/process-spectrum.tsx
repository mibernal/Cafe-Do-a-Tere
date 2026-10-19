"use client";

import { processSpectrum, productBand, bandVars } from "@/lib/catalog-style";
import { useStore } from "@/components/store/store-provider";

/**
 * Del proceso más limpio al más frutal. El orden es real: indica cuánta fruta
 * (mucílago) acompaña al grano durante el secado.
 */
export function ProcessSpectrum() {
  const { products, showProduct } = useStore();
  const stops = processSpectrum
    .map((stop) => ({ ...stop, product: products.find((product) => product.id === stop.productId) }))
    .filter((stop) => stop.product);
  if (stops.length < 2) return null;

  return (
    <section className="process-section" id="procesos" aria-labelledby="process-title">
      <div className="section-shell">
        <div className="process-intro">
          <h2 id="process-title">Lo que cambia en la taza depende de cuánta fruta se queda con el grano</h2>
          <p>
            El mismo café de la finca puede secarse limpio, con parte de su miel o dentro de la cereza entera. Cada
            proceso deja un dulzor, un cuerpo y una acidez distintos.
          </p>
        </div>
        <div className="spectrum">
          <div className="spectrum-scale" aria-hidden>
            <span>Más limpio y brillante</span>
            <span>Más dulce y frutal</span>
          </div>
          <div
            className="spectrum-bar"
            aria-hidden
            style={{
              // Cada color arranca donde está su punto, al inicio de su columna.
              background: `linear-gradient(90deg, ${stops
                .map((stop, index) => `${productBand(stop.product!)} ${((index / stops.length) * 100).toFixed(1)}%`)
                .join(", ")}, ${productBand(stops[stops.length - 1].product!)} 100%)`,
            }}
          />
          <ol className="spectrum-stops">
            {stops.map((stop) => (
              <li key={stop.productId} style={bandVars(stop.product!)}>
                <button type="button" onClick={() => showProduct(stop.productId)}>
                  <span className="stop-dot" aria-hidden />
                  <b>{stop.name}</b>
                  <small>{stop.fruit}</small>
                  <span className="stop-text">{stop.text}</span>
                  <span className="stop-link">Ver este café</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
