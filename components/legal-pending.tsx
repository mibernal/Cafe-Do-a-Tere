import { legalValue } from "@/lib/legal";

/** Dato legal configurado o un marcador visible de "pendiente". Nunca un valor supuesto. */
export function LegalValue({ field, label }: { field: string; label: string }) {
  const value = legalValue(field);
  return value ? <>{value}</> : <Pending>{label}</Pending>;
}

/** Texto que el comercio debe completar o validar antes de publicar. */
export function Pending({ children }: { children: React.ReactNode }) {
  return <mark className="legal-pending">Pendiente: {children}</mark>;
}
