"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="simple-page">
      <h1>Algo no cargó bien</h1>
      <p>Puede ser una falla momentánea de conexión. Intenta de nuevo; tu bolsa sigue guardada en este navegador.</p>
      <div className="simple-actions">
        <button type="button" className="button button-primary" onClick={reset}>
          Intentar de nuevo
        </button>
        <Link className="button button-outline" href="/">
          Ir a la tienda
        </Link>
      </div>
    </main>
  );
}
