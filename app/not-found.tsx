import Image from "next/image";
import Link from "next/link";
import { renderPerRequest } from "@/lib/request-time";
import { logoSrc } from "@/lib/site";

export default async function NotFound() {
  await renderPerRequest();
  return (
    <main className="simple-page">
      <Image src={logoSrc} alt="" width={120} height={120} />
      <h1>No encontramos esta página</h1>
      <p>El enlace puede estar incompleto o haber vencido. Si buscabas un pedido, revisa el enlace completo que recibiste al comprar.</p>
      <Link className="button button-primary" href="/">
        Volver a la tienda
      </Link>
    </main>
  );
}
