"use client";

import Image from "next/image";
import { useState } from "react";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useStore } from "@/components/store/store-provider";

const links = [
  { href: "#cafes", label: "Cafés" },
  { href: "#procesos", label: "Procesos" },
  { href: "#elegir", label: "Ayúdame a elegir" },
  { href: "#finca", label: "La finca" },
  { href: "#ayuda", label: "Preguntas" },
];

export function SiteHeader({ announcement }: { announcement: string }) {
  const { totalItems, openCart } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="announcement">
        <p>{announcement}</p>
      </div>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Café Doña Tere, inicio">
          <Image src="/assets/logo-cafe-dona-tere.png" alt="" width={52} height={52} preload />
          <span>
            <strong>Café Doña Tere</strong>
            <small>Finca La Libertad, Cachipay</small>
          </span>
        </a>
        <nav id="main-nav" className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Secciones de la tienda">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <button
            type="button"
            className="bag-button"
            onClick={openCart}
            aria-label={totalItems ? `Abrir bolsa, ${totalItems} ${totalItems === 1 ? "café" : "cafés"}` : "Abrir bolsa"}
          >
            <ShoppingBag size={19} aria-hidden />
            <span className="bag-label">Bolsa</span>
            <b className={totalItems ? "bag-count" : "bag-count is-empty"} aria-hidden>
              {totalItems}
            </b>
          </button>
          <button
            type="button"
            className="menu-button"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </header>
    </>
  );
}
