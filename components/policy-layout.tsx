import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { logoSrc } from "@/lib/site";

export function PolicyLayout({ title, draftNote, children }: { title: string; draftNote?: string; children: React.ReactNode }) {
  return (
    <main className="policy-page">
      <header className="tracking-header">
        <Link className="brand" href="/">
          <Image src={logoSrc} alt="" width={46} height={46} />
          <span>
            <strong>Café Doña Tere</strong>
            <small>Finca La Libertad, Cachipay</small>
          </span>
        </Link>
        <Link className="text-link back-link" href="/">
          <ArrowLeft size={15} aria-hidden />
          Volver a la tienda
        </Link>
      </header>
      <article className="policy-body">
        <h1>{title}</h1>
        {draftNote && <p className="policy-draft">{draftNote}</p>}
        {children}
      </article>
    </main>
  );
}
