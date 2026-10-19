// Datos del responsable del comercio para los términos y la política de
// datos. Los publicó el propio comercio; una variable de entorno con el mismo
// nombre los reemplaza (ver .env.example). Nunca se suponen: mientras falte un
// dato o un texto, las páginas legales se muestran como borrador, no se
// indexan y el pago en línea permanece cerrado.

export type LegalField = { key: string; label: string; value: string };

/**
 * Datos del responsable publicados por el comercio. Una variable de entorno
 * con el mismo nombre tiene prioridad (hosting o Variables de GitHub Actions).
 */
const MERCHANT: Record<string, string> = {
  BUSINESS_LEGAL_NAME: "MIGUEL ANGEL BERNAL",
  BUSINESS_TAX_ID: "1069583873",
  BUSINESS_ADDRESS: "Carrera 92 # 72A-69, Bogotá",
  BUSINESS_LEGAL_EMAIL: "miguelangelbernal1991@gmail.com",
};

function env(name: string) {
  return (process.env[name] ?? "").trim() || MERCHANT[name] || "";
}

export function legalFields(): LegalField[] {
  return [
    { key: "BUSINESS_LEGAL_NAME", label: "Razón social o nombre del responsable", value: env("BUSINESS_LEGAL_NAME") },
    { key: "BUSINESS_TAX_ID", label: "NIT o cédula", value: env("BUSINESS_TAX_ID") },
    { key: "BUSINESS_ADDRESS", label: "Dirección de notificaciones", value: env("BUSINESS_ADDRESS") },
    {
      key: "BUSINESS_LEGAL_EMAIL",
      label: "Correo de atención y de datos personales",
      value: env("BUSINESS_LEGAL_EMAIL") || env("NEXT_PUBLIC_CONTACT_EMAIL"),
    },
  ];
}

export function legalValue(key: string) {
  return legalFields().find((field) => field.key === key)?.value ?? "";
}

/**
 * Contenidos que el comercio debe redactar y hacer revisar por un profesional.
 * Cuando un texto quede definitivo en su página, quítalo de esta lista.
 */
export const PENDING_LEGAL_CONTENT: { id: string; label: string; file: string }[] = [
  { id: "retracto", label: "Alcance del retracto para alimentos y café molido a la medida", file: "app/terminos/page.tsx" },
  { id: "encargados", label: "Encargados reales del tratamiento de datos", file: "app/privacidad/page.tsx" },
];

/** Todo lo que falta para publicar los documentos legales como definitivos. */
export function missingLegalItems() {
  return [
    ...legalFields()
      .filter((field) => !field.value)
      .map((field) => `${field.label} (${field.key})`),
    ...PENDING_LEGAL_CONTENT.map((item) => `${item.label} (${item.file})`),
  ];
}

export function legalComplete() {
  return missingLegalItems().length === 0;
}
