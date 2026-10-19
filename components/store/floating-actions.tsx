"use client";

import { MessageCircle, ShoppingBag } from "lucide-react";
import { formatCOP } from "@/lib/money";
import { whatsappLink } from "@/lib/site";
import { useStore } from "@/components/store/store-provider";

export function FloatingActions() {
  const { totalItems, subtotal, openCart, cartOpen } = useStore();
  return (
    <>
      {totalItems > 0 && !cartOpen && (
        <button type="button" className="mobile-bag-bar" onClick={openCart}>
          <ShoppingBag size={18} aria-hidden />
          <span>
            Ver bolsa ({totalItems})
          </span>
          {subtotal > 0 && <b>{formatCOP(subtotal)}</b>}
        </button>
      )}
      <a
        className={totalItems > 0 ? "whatsapp-float has-bar" : "whatsapp-float"}
        href={whatsappLink("Hola, Café Doña Tere. Quiero hacer una pregunta.")}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escríbenos por WhatsApp"
      >
        <MessageCircle size={24} aria-hidden />
      </a>
    </>
  );
}
