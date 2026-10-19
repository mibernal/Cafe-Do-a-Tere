import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AdminLoginForm } from "@/components/admin-login-form";
import { logoSrc } from "@/lib/site";

export const metadata: Metadata = {
  title: "Acceso al panel",
  robots: { index: false, follow: false, noarchive: true },
};
export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <Image src={logoSrc} alt="" width={96} height={96} />
        <h1 id="login-title">Panel de la tienda</h1>
        <p>Ingresa con tu cuenta administradora para gestionar pedidos, inventario y precios.</p>
        <AdminLoginForm />
      </section>
      <Link className="text-link" href="/">
        Volver a la tienda
      </Link>
    </main>
  );
}
