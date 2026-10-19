"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { GRIND_OPTIONS } from "@/lib/grind-options";
import { productBand, bandVars } from "@/lib/catalog-style";
import { ProductPurchase, resolveSelection, type Selection } from "@/components/store/product-purchase";
import { useStore } from "@/components/store/store-provider";

const tastes = [
  { id: "cacao", label: "Chocolate y cacao, intenso", productIds: ["lena", "honey-black"], why: "Su tostión a la leña da cacao oscuro, frutos secos y un final ahumado que se siente en cada sorbo." },
  { id: "citrico", label: "Cítrico y dulce, luminoso", productIds: ["precision", "lavado"], why: "Una tostión media que conserva la naranja, la mandarina y la panela del grano." },
  { id: "fruta", label: "Fruta madura y mucho dulzor", productIds: ["natural", "honey-black", "honey-red"], why: "Secar el grano con su fruta le da notas de fruta madura, caramelo y un cuerpo sedoso." },
  { id: "limpio", label: "Limpio y equilibrado, para diario", productIds: ["lavado", "precision"], why: "El proceso lavado deja una taza clara y balanceada que acompaña cualquier momento." },
  { id: "descubrir", label: "Algo especial para descubrir", productIds: ["honey-red", "honey", "honey-black"], why: "Un microlote honey: más dulzor y cuerpo, secado con calma en la finca." },
] as const;

const methods = GRIND_OPTIONS.map((option) => ({
  value: option.value,
  label: option.value === "En grano" ? "Lo muelo en casa" : option.method,
}));

export function FlavorFinder() {
  const { products } = useStore();
  const [taste, setTaste] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [selection, setSelection] = useState<Selection | undefined>();

  const tasteOption = tastes.find((item) => item.id === taste);
  const product = tasteOption
    ? tasteOption.productIds.map((id) => products.find((item) => item.id === id)).find(Boolean) ?? null
    : null;

  // Cada respuesta nueva reinicia la sugerencia con la molienda elegida.
  useEffect(() => {
    if (!product || !method) return;
    const variant = product.variants.find((item) => item.grinds.includes(method)) ?? product.variants[0];
    if (variant) setSelection({ variantId: variant.id, grind: variant.grinds.includes(method) ? method : variant.grinds[0] });
  }, [product, method]);

  const resolved = product ? resolveSelection(product, selection) : null;
  const grindMissing = Boolean(product && method && resolved && resolved.grind !== method);

  return (
    <section className="finder-section" id="elegir" aria-labelledby="finder-title">
      <div className="section-shell finder-layout">
        <div className="finder-questions">
          <h2 id="finder-title">¿No sabes cuál elegir?</h2>
          <p className="finder-lead">Dos respuestas y te sugerimos un café, ya con la molienda para tu método.</p>
          <fieldset className="choice-group">
            <legend>¿Qué sabores disfrutas más?</legend>
            <div>
              {tastes.map((item) => (
                <label key={item.id} className={taste === item.id ? "choice is-selected" : "choice"}>
                  <input type="radio" name="finder-taste" value={item.id} checked={taste === item.id} onChange={() => setTaste(item.id)} />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="choice-group">
            <legend>¿Cómo lo preparas?</legend>
            <div>
              {methods.map((item) => (
                <label key={item.value} className={method === item.value ? "choice is-selected" : "choice"}>
                  <input type="radio" name="finder-method" value={item.value} checked={method === item.value} onChange={() => setMethod(item.value)} />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="finder-result" aria-live="polite">
          {product && method && resolved?.variant ? (
            <article className="suggestion" style={bandVars(product)}>
              <div className="suggestion-visual">
                <Image src={resolved.image} alt={`Etiqueta de ${product.name}`} fill sizes="(max-width: 800px) 40vw, 200px" />
              </div>
              <div className="suggestion-body">
                <p className="suggestion-kicker">Te sugerimos</p>
                <h3>{product.name}</h3>
                <p>{tasteOption?.why}</p>
                {grindMissing && (
                  <p className="suggestion-note">Esta presentación no viene en esa molienda; te dejamos la más cercana disponible.</p>
                )}
                <ProductPurchase product={product} selection={selection} onSelect={setSelection} />
              </div>
            </article>
          ) : (
            <div className="suggestion-placeholder">
              <Image src="/assets/logo-cafe-dona-tere.png" alt="" width={120} height={120} />
              <p>Elige un sabor y tu método de preparación para ver la sugerencia de Doña Tere.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
