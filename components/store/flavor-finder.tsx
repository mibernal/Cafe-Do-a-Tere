"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import type { Product } from "@/lib/store-types";
import { GRIND_OPTIONS } from "@/lib/grind-options";
import { bandVars } from "@/lib/catalog-style";
import { drinkOptions, rankCoffees, tasteOptions, type Answers } from "@/lib/coffee-profiles";
import { ProductPurchase, resolveSelection, type Selection } from "@/components/store/product-purchase";
import { isPurchasable, useStore } from "@/components/store/store-provider";
import { logoSrc } from "@/lib/site";
import { isPackShot } from "@/lib/provisional-assets";

const methodOptions = GRIND_OPTIONS.map((option) => ({
  value: option.value,
  label: option.value === "En grano" ? "Lo muelo en casa" : option.method,
}));

/** Presentación y molienda iniciales: la que se puede comprar y trae la molienda pedida. */
function defaultSelection(product: Product, method: string | undefined, ordersEnabled: boolean): Selection | undefined {
  const sellable = (variant: Product["variants"][number]) => !ordersEnabled || isPurchasable(variant);
  const withGrind = (variant: Product["variants"][number]) => Boolean(method && variant.grinds.includes(method));
  const variant =
    product.variants.find((item) => sellable(item) && withGrind(item)) ??
    product.variants.find(withGrind) ??
    product.variants.find(sellable) ??
    product.variants[0];
  if (!variant) return undefined;
  // La molienda solo se precarga cuando el comprador dijo cómo prepara su
  // café; si no, la elige él en la ficha.
  return { variantId: variant.id, grind: method && variant.grinds.includes(method) ? method : "" };
}

function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  compact,
}: {
  legend: string;
  name: string;
  options: { id: T; label: string; hint?: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  return (
    <fieldset className="choice-group">
      <legend>{legend}</legend>
      <div className={compact ? "choice-row is-compact" : "choice-row"}>
        {options.map((option) => (
          <label key={option.id} className={value === option.id ? "choice is-selected" : "choice"}>
            <input type="radio" name={name} value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} />
            <span>
              <b>{option.label}</b>
              {option.hint && <small>{option.hint}</small>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FlavorFinder() {
  const { products, options } = useStore();
  const [answers, setAnswers] = useState<Answers>({});
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [manual, setManual] = useState<{ key: string; selection: Selection } | null>(null);

  const ranking = useMemo(
    () =>
      rankCoffees(products, answers, (product) => !options.ordersEnabled || product.variants.some(isPurchasable)),
    [products, answers, options.ordersEnabled],
  );
  if (products.length < 2) return null;

  const top = ranking[0] ?? null;
  const shown = ranking.find((item) => item.product.id === pickedId) ?? top;
  const alternative = shown ? ranking.find((item) => item.product.id !== shown.product.id && item.score > 0) : undefined;

  const product = shown?.product ?? null;
  const key = `${product?.id ?? ""}|${answers.method ?? ""}`;
  const selection = product
    ? manual?.key === key
      ? manual.selection
      : defaultSelection(product, answers.method, options.ordersEnabled)
    : undefined;
  const resolved = product ? resolveSelection(product, selection) : null;
  const grindMissing = Boolean(answers.method && resolved && resolved.grind !== answers.method && manual?.key !== key);

  function answer(patch: Answers) {
    setAnswers((current) => ({ ...current, ...patch }));
    setPickedId(null);
  }

  return (
    <section className="finder-section" id="elegir" aria-labelledby="finder-title">
      <div className="section-shell finder-layout">
        <div className="finder-questions">
          <h2 id="finder-title">¿No sabes cuál elegir?</h2>
          <p className="finder-lead">
            Con tu primera respuesta te sugerimos un café. Las otras dos afinan la sugerencia y la molienda.
          </p>
          <ChoiceGroup
            legend="1. ¿Qué sabores disfrutas?"
            name="finder-taste"
            options={tasteOptions}
            value={answers.taste}
            onChange={(taste) => answer({ taste })}
          />
          <ChoiceGroup
            legend="2. ¿Cómo lo tomas?"
            name="finder-drink"
            options={drinkOptions}
            value={answers.drink}
            onChange={(drink) => answer({ drink })}
          />
          <ChoiceGroup
            legend="3. ¿Cómo lo preparas?"
            name="finder-method"
            options={methodOptions.map((item) => ({ id: item.value, label: item.label }))}
            value={answers.method}
            onChange={(method) => answer({ method })}
            compact
          />
          {(answers.taste || answers.drink || answers.method) && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAnswers({});
                setPickedId(null);
                setManual(null);
              }}
            >
              <RotateCcw size={15} aria-hidden />
              Empezar de nuevo
            </button>
          )}
        </div>

        <div className="finder-result" aria-live="polite">
          {product && shown && resolved?.variant ? (
            <article className="suggestion" style={bandVars(product)}>
              <div className="suggestion-visual">
                <Image
                  src={resolved.image}
                  alt={isPackShot(resolved.image) ? `Bolsa de ${product.name}, ${resolved.variant.label}` : `Etiqueta de ${product.name}`}
                  fill
                  sizes="(max-width: 800px) 60vw, 220px"
                />
              </div>
              <div className="suggestion-body">
                <p className="suggestion-kicker">{shown === top ? "Te sugerimos" : "También te puede gustar"}</p>
                <h3>{product.name}</h3>
                <ul className="reason-list">
                  {shown.reasons.map((reason) => (
                    <li key={reason}>
                      <Check size={15} aria-hidden />
                      {reason}
                    </li>
                  ))}
                </ul>
                {grindMissing && (
                  <p className="suggestion-note">
                    Este café no viene en esa molienda: elige otra o pídelo en grano.
                  </p>
                )}
                <ProductPurchase
                  product={product}
                  selection={selection}
                  onSelect={(next) => setManual({ key, selection: next })}
                />
                {alternative && (
                  <p className="suggestion-alt">
                    {shown === top ? "¿Prefieres otra opción? " : "Nuestra primera sugerencia es "}
                    <button type="button" onClick={() => setPickedId(alternative.product.id)}>
                      {shown === top ? `Ver ${alternative.product.name}` : alternative.product.name}
                    </button>
                  </p>
                )}
              </div>
            </article>
          ) : (
            <div className="suggestion-placeholder">
              <Image src={logoSrc} alt="" width={112} height={112} />
              <p>Cuéntanos qué sabores disfrutas y Doña Tere te sugiere uno de sus cafés.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
