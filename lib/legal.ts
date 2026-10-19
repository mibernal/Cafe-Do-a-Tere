// Datos del responsable del comercio para los términos y la política de
// datos. Se configuran con variables de entorno (ver .env.example) y nunca se
// suponen: mientras falte alguno, las páginas legales se muestran como
// borrador, no se indexan y el pago en línea permanece cerrado.

export type LegalField = { key: string; label: string; value: string };

function env(name: string) {
  return (process.env[name] ?? "").trim();
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
  { id: "impuestos", label: "Confirmar si los precios incluyen impuestos", file: "app/terminos/page.tsx" },
  { id: "medios-pago", label: "Medios de pago aceptados al confirmar por WhatsApp", file: "app/terminos/page.tsx" },
  { id: "envios", label: "Envíos: cobertura, tiempos, transportadoras y entregas fallidas", file: "app/terminos/page.tsx" },
  { id: "retracto", label: "Alcance del retracto para alimentos y café molido a la medida", file: "app/terminos/page.tsx" },
  { id: "encargados", label: "Encargados reales del tratamiento de datos", file: "app/privacidad/page.tsx" },
  { id: "conservacion", label: "Tiempo de conservación de los datos", file: "app/privacidad/page.tsx" },
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
