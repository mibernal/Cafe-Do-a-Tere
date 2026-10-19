import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main className="simple-page">
      <Image src="/assets/logo-cafe-dona-tere.png" alt="" width={120} height={120} />
      <h1>No encontramos esta página</h1>
      <p>El enlace puede estar incompleto o haber vencido. Si buscabas un pedido, revisa el enlace completo que recibiste al comprar.</p>
      <Link className="button button-primary" href="/">
        Volver a la tienda
      </Link>
    </main>
  );
}
