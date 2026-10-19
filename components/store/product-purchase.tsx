"use client";

import { useId } from "react";
import { MessageCircle, ShoppingBag } from "lucide-react";
import type { Product, ProductVariant } from "@/lib/store-types";
import { formatCOP } from "@/lib/money";
import { getGrindOption } from "@/lib/grind-options";
import { whatsappLink } from "@/lib/site";
import { isPurchasable, useStore } from "@/components/store/store-provider";

export type Selection = { variantId: string; grind: string };

export function resolveSelection(product: Product, selection?: Selection) {
  const variant = product.variants.find((item) => item.id === selection?.variantId) ?? product.variants[0];
  const grind = variant && selection && variant.grinds.includes(selection.grind) ? selection.grind : (variant?.grinds[0] ?? "");
  const image = variant ? (grind === "En grano" && variant.beanImage ? variant.beanImage : variant.image) : product.image;
  return { variant, grind, image };
}

export function priceLabel(variant: ProductVariant) {
  if (variant.priceConfirmed && variant.priceCop > 0) return { amount: formatCOP(variant.priceCop), note: "" };
  if (variant.priceCop > 0) return { amount: formatCOP(variant.priceCop), note: "Precio de referencia" };
  return { amount: "Precio por confirmar", note: "" };
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
  const { variant, grind } = resolveSelection(product, selection);
  if (!variant) return null;
  const grindOption = getGrindOption(grind);
  const price = priceLabel(variant);
  const purchasable = isPurchasable(variant);
  const canAdd = options.ordersEnabled ? purchasable : true;
  const inquiry = whatsappLink(
    `Hola, Café Doña Tere. Me interesa ${product.name} ${variant.label}, molienda ${grindOption.method}. ¿Me confirman precio y disponibilidad?`,
  );

  return (
    <div className="purchase">
      <div className="price-row">
        <strong className={variant.priceCop > 0 ? "price" : "price price-pending"}>{price.amount}</strong>
        {price.note && <small>{price.note}</small>}
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
                  onChange={() => onSelect({ variantId: item.id, grind })}
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
          id={`${fieldId}-grind`}
          value={grind}
          onChange={(event) => onSelect({ variantId: variant.id, grind: event.target.value })}
        >
          {variant.grinds.map((value) => {
            const option = getGrindOption(value);
            return (
              <option key={value} value={value}>
                {option.method === "En grano" ? "En grano (sin moler)" : `${option.method}, ${option.texture.toLowerCase()}`}
              </option>
            );
          })}
        </select>
      </label>
      <p className="grind-hint">{grindOption.description}</p>

      {canAdd ? (
        <button
          type="button"
          className="button button-primary add-button"
          onClick={() => {
            if (addItem(product, variant, grind)) onAdded?.();
          }}
        >
          <ShoppingBag size={17} aria-hidden />
          Agregar a la bolsa
        </button>
      ) : (
        <a className="button button-outline add-button" href={inquiry} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={17} aria-hidden />
          {variant.priceConfirmed && !variant.available ? "Agotado: avísame por WhatsApp" : "Consultar por WhatsApp"}
        </a>
      )}
    </div>
  );
}
