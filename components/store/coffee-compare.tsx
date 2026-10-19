"use client";

import Image from "next/image";
import type { Product } from "@/lib/store-types";
import { bandVars } from "@/lib/catalog-style";
import { coffeeProfile, countCoffees, type CoffeeProfile } from "@/lib/coffee-profiles";
import { getGrindOption, notesPhrase } from "@/lib/grind-options";
import { formatCOP } from "@/lib/money";
import { useStore } from "@/components/store/store-provider";

const scales: { key: keyof Pick<CoffeeProfile, "intensity" | "acidity" | "body" | "sweetness">; label: string; hint: string }[] = [
  { key: "intensity", label: "Intensidad", hint: "Qué tan fuerte se siente" },
  { key: "acidity", label: "Acidez", hint: "La viveza de la taza" },
  { key: "body", label: "Cuerpo", hint: "Qué tan densa se siente" },
  { key: "sweetness", label: "Dulzor", hint: "Sin necesidad de azúcar" },
];

const milkLabels = ["Mejor solo", "Solo o con leche", "Ideal con leche"];

function Meter({ value }: { value: number }) {
  return (
    <span className="meter" role="img" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <i key={step} className={step <= value ? "is-on" : undefined} />
      ))}
    </span>
  );
}

function priceFrom(product: Product) {
  const confirmed = product.variants.filter((variant) => variant.priceConfirmed && variant.priceCop > 0);
  if (confirmed.length) {
    const cheapest = confirmed.reduce((min, variant) => (variant.priceCop < min.priceCop ? variant : min));
    return `Desde ${formatCOP(cheapest.priceCop)} (${cheapest.label})`;
  }
  return "Por confirmar";
}

function packImage(product: Product) {
  return product.variants.find((variant) => variant.image.endsWith("-front.jpg"))?.image ?? product.image;
}

export function CoffeeCompare() {
  const { products, showProduct } = useStore();
  if (products.length < 2) return null;

  return (
    <section className="compare-section" id="comparar" aria-labelledby="compare-title">
      <div className="section-shell">
        <div className="compare-intro">
          <h2 id="compare-title">{countCoffees(products.length)}, lado a lado</h2>
          <p>Así se diferencian en la taza, en una escala orientativa de 1 a 5 hecha por la finca para comparar sus cafés (no es una catación certificada). Toca uno para verlo en el catálogo.</p>
        </div>
        <div className="compare-scroll" role="region" aria-label="Tabla comparativa de los cafés" tabIndex={0}>
          <table className="compare-table" style={{ "--compare-cols": products.length } as React.CSSProperties}>
            <caption className="sr-only">Perfil de taza, preparación sugerida y precio de cada café</caption>
            <thead>
              <tr>
                <td />
                {products.map((product) => (
                  <th key={product.id} scope="col" style={bandVars(product)}>
                    <button type="button" className="compare-head" onClick={() => showProduct(product.id)}>
                      <span className="compare-pack">
                        <Image src={packImage(product)} alt="" fill sizes="96px" />
                      </span>
                      <span className="band-ribbon">{product.process}</span>
                      <b>{product.name}</b>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scales.map((scale) => (
                <tr key={scale.key}>
                  <th scope="row">
                    {scale.label}
                    <small>{scale.hint}</small>
                  </th>
                  {products.map((product) => (
                    <td key={product.id} style={bandVars(product)}>
                      <Meter value={coffeeProfile(product)[scale.key]} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">En taza</th>
                {products.map((product) => (
                  <td key={product.id}>{notesPhrase(product.notes)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">¿Con leche?</th>
                {products.map((product) => (
                  <td key={product.id}>{milkLabels[coffeeProfile(product).milk]}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Brilla en</th>
                {products.map((product) => (
                  <td key={product.id}>
                    {coffeeProfile(product)
                      .methods.map((method) => getGrindOption(method).method)
                      .join(", ")}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Precio</th>
                {products.map((product) => (
                  <td key={product.id} className="compare-price">
                    {priceFrom(product)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
