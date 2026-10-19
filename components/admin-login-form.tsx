"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo iniciar sesión.");
      router.replace("/admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión.");
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label className="field">
        <span>Correo</span>
        <input name="email" type="email" autoComplete="username" maxLength={254} required />
      </label>
      <label className="field">
        <span>Contraseña</span>
        <input name="password" type="password" autoComplete="current-password" maxLength={256} required />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button button-primary button-block" disabled={busy}>
        {busy ? "Validando…" : "Entrar al panel"}
      </button>
    </form>
  );
}
