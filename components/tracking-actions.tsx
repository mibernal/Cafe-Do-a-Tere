"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

/** Consulta de nuevo el estado mientras el pago está en curso (máximo 3 minutos). */
export function AutoRefresh({ intervalMs = 8000, maxMs = 180000 }: { intervalMs?: number; maxMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - started > maxMs || document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [router, intervalMs, maxMs]);
  return (
    <button type="button" className="text-button refresh-button" onClick={() => startTransition(() => router.refresh())} disabled={pending}>
      <RefreshCw size={15} aria-hidden className={pending ? "spin" : undefined} />
      {pending ? "Consultando…" : "Actualizar estado"}
    </button>
  );
}

/** Permite al cliente liberar su reserva antes de pagar o confirmar. */
export function CancelOrderButton({ token, label }: { token: string; label: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "No fue posible cancelar el pedido.");
      try {
        window.localStorage.removeItem("cafe-dona-tere-last-order");
      } catch {
        /* sin almacenamiento */
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible cancelar el pedido.");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="text-button danger-link" onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }
  return (
    <div className="confirm-cancel" role="group" aria-label="Confirmar cancelación">
      <p>¿Cancelar el pedido? Liberaremos las unidades reservadas.</p>
      <div>
        <button type="button" className="button button-danger" onClick={cancel} disabled={busy}>
          {busy ? "Cancelando…" : "Sí, cancelar pedido"}
        </button>
        <button type="button" className="text-button" onClick={() => setConfirming(false)} disabled={busy}>
          No, mantenerlo
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
