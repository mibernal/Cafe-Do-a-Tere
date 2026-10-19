"use client";

import { useId, useRef, useState } from "react";
import { MessageCircle, ShoppingBag } from "lucide-react";
import type { Product, ProductVariant } from "@/lib/store-types";
import { formatCOP } from "@/lib/money";
import { getGrindOption, grindPhrase } from "@/lib/grind-options";
import { whatsappLink } from "@/lib/site";
import { isPurchasable, useStore } from "@/components/store/store-provider";

/** Presentación y molienda elegidas por el comprador. Molienda vacía: aún no eligió. */
export type Selection = { variantId: string; grind: string };

/**
 * La molienda nunca se elige por el comprador: si no la ha indicado (o la que
 * tenía no existe en la presentación actual), queda vacía hasta que la elija.
 */
export function resolveSelection(product: Product, selection?: Selection) {
  const variant = product.variants.find((item) => item.id === selection?.variantId) ?? product.variants[0];
  const grind = variant && selection?.grind && variant.grinds.includes(selection.grind) ? selection.grind : "";
  const image = variant ? (grind === "En grano" && variant.beanImage ? variant.beanImage : variant.image) : product.image;
  return { variant, grind, image };
}

/** Solo se muestran precios confirmados por la finca; nunca cifras de referencia. */
export function priceLabel(variant: ProductVariant) {
  return variant.priceConfirmed && variant.priceCop > 0
    ? { amount: formatCOP(variant.priceCop), confirmed: true }
    : { amount: "Precio por confirmar", confirmed: false };
}

function grindOptionLabel(value: string) {
  const option = getGrindOption(value);
  return option.method === "En grano" ? "En grano (sin moler)" : `${option.method}, ${option.texture.toLowerCase()}`;
}

export function ProductPurchase({
  product,
  selection,
  onSelect,
  onAdded,
}: {
  product: Product;
  selection?: Selection;
  onSelect: (selection: Selection) => void;
  onAdded?: () => void;
}) {
  const { addItem, options } = useStore();
  const fieldId = useId();
  const grindRef = useRef<HTMLSelectElement>(null);
  const [showGrindError, setShowGrindError] = useState(false);
  const { variant, grind } = resolveSelection(product, selection);
  if (!variant) return null;

  const price = priceLabel(variant);
  const soldOut = variant.priceConfirmed && !variant.available;
  // Con pago en línea solo se agrega lo que se puede cobrar; en modo WhatsApp
  // la bolsa arma la consulta, salvo presentaciones agotadas.
  const canAdd = options.ordersEnabled ? isPurchasable(variant) : !soldOut;
  const addLabel = options.ordersEnabled || price.confirmed ? "Agregar a la bolsa" : "Agregar para consultar";
  // La molienda anterior no existe en esta presentación: se pide de nuevo.
  const lostGrind = Boolean(selection?.grind) && !grind;
  const grindError = showGrindError && !grind;
  const hintId = `${fieldId}-grind-hint`;
  const inquiry = whatsappLink(
    `Hola, Café Doña Tere. Me interesa ${product.name} ${variant.label}${grind ? `, ${grindPhrase(grind)}` : ""}. ¿Me confirman precio y disponibilidad?`,
  );

  function add() {
    if (!grind) {
      setShowGrindError(true);
      grindRef.current?.focus();
      return;
    }
    if (addItem(product, variant!, grind)) {
      setShowGrindError(false);
      onAdded?.();
    }
  }

  return (
    <div className="purchase">
      <div className="price-row">
        <strong className={price.confirmed ? "price" : "price price-pending"}>{price.amount}</strong>
        <small>{variant.label}</small>
      </div>

      {product.variants.length > 1 ? (
        <fieldset className="size-picker">
          <legend>Presentación</legend>
          <div>
            {product.variants.map((item) => (
              <label key={item.id} className="size-option">
                <input
                  type="radio"
                  name={`${fieldId}-size`}
                  value={item.id}
                  checked={item.id === variant.id}
                  onChange={() => onSelect({ variantId: item.id, grind: selection?.grind ?? "" })}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="size-single">
          Presentación <b>{variant.label}</b>
        </p>
      )}

      <label className="grind-picker" htmlFor={`${fieldId}-grind`}>
        <span>Molienda</span>
        <select
          ref={grindRef}
          id={`${fieldId}-grind`}
          value={grind}
          aria-invalid={grindError || undefined}
          aria-describedby={hintId}
          onChange={(event) => {
            setShowGrindError(false);
            onSelect({ variantId: variant.id, grind: event.target.value });
          }}
        >
          <option value="" disabled>
            Elige tu molienda
          </option>
          {variant.grinds.map((value) => (
            <option key={value} value={value}>
              {grindOptionLabel(value)}
            </option>
          ))}
        </select>
      </label>
      <p id={hintId} className={grindError ? "grind-hint is-error" : "grind-hint"} role={grindError ? "alert" : undefined}>
        {grind
          ? getGrindOption(grind).description
          : grindError
            ? "Elige la molienda antes de agregar el café."
            : lostGrind
              ? `Esta presentación no viene en ${grindPhrase(selection!.grind)}. Elige otra molienda.`
              : "Dinos cómo lo preparas y lo molemos para ese método, o pídelo en grano."}
      </p>

      {canAdd ? (
        <button type="button" className="button button-primary add-button" onClick={add}>
          <ShoppingBag size={17} aria-hidden />
          {addLabel}
        </button>
      ) : (
        <a className="button button-outline add-button" href={inquiry} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={17} aria-hidden />
          {soldOut ? "Agotado: avísame por WhatsApp" : "Consultar por WhatsApp"}
        </a>
      )}
    </div>
  );
}
