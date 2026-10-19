export const GRIND_OPTIONS = [
  {
    value: "Espresso · fina",
    method: "Espresso",
    texture: "Fina",
    description: "Para máquinas de espresso y extracciones rápidas.",
  },
  {
    value: "Cafetera italiana (Moka) · media",
    method: "Cafetera italiana (Moka)",
    texture: "Media",
    description: "Un punto medio para empezar; ajústalo al flujo de tu moka.",
  },
  {
    value: "V60 / filtro manual · media",
    method: "V60 o filtro manual",
    texture: "Media",
    description: "Una molienda equilibrada para métodos de vertido manual.",
  },
  {
    value: "Cafetera eléctrica · media-fina",
    method: "Cafetera eléctrica",
    texture: "Media a fina",
    description: "Un punto versátil para cafeteras de goteo y filtros de papel.",
  },
  {
    value: "Chemex · media-gruesa",
    method: "Chemex",
    texture: "Media a gruesa",
    description: "Acompaña filtros gruesos y tiempos de vertido pausados.",
  },
  {
    value: "Prensa francesa · gruesa",
    method: "Prensa francesa",
    texture: "Gruesa",
    description: "Tamaño amplio para una inmersión limpia y con buen cuerpo.",
  },
  {
    value: "AeroPress · media-fina",
    method: "AeroPress",
    texture: "Media a fina",
    description: "Una base versátil para experimentar con tiempo y presión.",
  },
  {
    value: "Cold brew · media-gruesa",
    method: "Cold brew",
    texture: "Media a gruesa",
    description: "Adecuada para preparar café por inmersión prolongada en frío.",
  },
  {
    value: "En grano",
    method: "En grano",
    texture: "Grano entero",
    description: "Conserva el grano entero para molerlo justo antes de preparar.",
  },
] as const;

export type GrindValue = (typeof GRIND_OPTIONS)[number]["value"];
export const GROUND_GRIND_VALUES = GRIND_OPTIONS.slice(0, -1).map(
  (option) => option.value,
);

export function getGrindOption(value: string) {
  return (
    GRIND_OPTIONS.find((option) => option.value === value) ?? {
      value,
      method: value === "Molido" ? "Molienda clásica" : value,
      texture: value === "Molido" ? "Por definir" : "Preparación especial",
      description:
        value === "Molido"
          ? "La presentación de molienda disponible para este lote."
          : "Consulta con la finca la preparación recomendada para este café.",
    }
  );
}

const GENERIC_METHOD_WORDS = new Set(["Espresso", "Cafetera", "Prensa", "Cold"]);

/** Método en minúscula para frases ("cafetera italiana (Moka)", "V60 o filtro manual"). */
export function methodPhrase(value: string) {
  const { method } = getGrindOption(value);
  const [first, ...rest] = method.split(" ");
  return [GENERIC_METHOD_WORDS.has(first) ? first.toLowerCase() : first, ...rest].join(" ");
}

/** Frase corta para resúmenes: "en grano" o "molienda V60 o filtro manual". */
export function grindPhrase(value: string) {
  return getGrindOption(value).method === "En grano" ? "en grano" : `molienda ${methodPhrase(value)}`;
}

/** Notas de taza como frase: "Cacao, frutos secos, final ahumado". */
export function notesPhrase(notes: string[]) {
  const text = notes.map((note) => note.toLowerCase()).join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
