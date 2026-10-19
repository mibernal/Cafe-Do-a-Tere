import type { Product, ProductCategory } from "@/lib/store-types";
import { methodPhrase } from "@/lib/grind-options";

/**
 * Perfil de taza de cada café en una escala orientativa de 1 a 5, definida
 * por la finca para comparar sus cafés entre sí. No es una catación
 * certificada ni un puntaje SCA, y la tienda lo presenta así. Alimenta la
 * comparación y el asistente "Ayúdame a elegir". Un café sin perfil usa el de
 * su categoría.
 *
 * Cómo se fijaron los valores (fuentes en docs/perfiles-de-taza.md):
 * - Los tres cafés comparten finca, altura (1.450–1.650 m) y variedades
 *   (Castillo 60 %, Caturra 40 %). Cenicafé y la prueba ciega de CRS y World
 *   Coffee Research no encontraron diferencias de calidad entre Castillo y
 *   Caturra, así que la variedad no separa los cafés: los separan la tostión
 *   y el proceso de beneficio.
 * - La variedad sí orienta las notas: el Castillo tiende a fruta no cítrica,
 *   chocolate oscuro y nueces tostadas; el Caturra, a floral, cacao y
 *   caramelo. Encaja con las notas que la finca ya describe en cada café.
 * - Tostión: al oscurecerla baja la acidez y sube el amargor; el dulzor
 *   apenas cambia y el cuerpo no sigue una línea recta (estudio de la SCA).
 * - Honey: frente a un lavado, acidez más redonda y menos cítrica, más cuerpo
 *   y más dulzor.
 * - Altura: 1.450–1.650 m cerca del ecuador es altura media-alta; da acidez
 *   presente pero no la más brillante (World Coffee Research ubica el óptimo
 *   del Caturra por encima de 1.600 m a esta latitud).
 * Ajusta los valores con la catación de cada lote.
 */
export type TasteId = "cacao" | "citrico" | "dulce" | "equilibrado";
export type DrinkId = "negro" | "leche";

export type CoffeeProfile = {
  intensity: number;
  acidity: number;
  body: number;
  sweetness: number;
  /** Afinidad con cada gusto (0 a 3). */
  taste: Partial<Record<TasteId, number>>;
  /** 2: se sostiene con leche; 1: va bien de las dos formas; 0: mejor solo. */
  milk: 0 | 1 | 2;
  /** Moliendas (valores de GRIND_OPTIONS) donde mejor se expresa. */
  methods: string[];
  /** Una línea que dice por qué elegirlo. */
  pitch: string;
  /** Tipo de tostión, si la finca lo ha confirmado. */
  roast?: string;
  /** Proceso de beneficio (lavado, honey, natural), si está confirmado. */
  postHarvest?: string;
};

const ESPRESSO = "Espresso · fina";
const MOKA = "Cafetera italiana (Moka) · media";
const V60 = "V60 / filtro manual · media";
const ELECTRIC = "Cafetera eléctrica · media-fina";
const CHEMEX = "Chemex · media-gruesa";
const PRESS = "Prensa francesa · gruesa";
const AEROPRESS = "AeroPress · media-fina";
const COLD = "Cold brew · media-gruesa";

const byProduct: Record<string, CoffeeProfile> = {
  // Tostión a la leña: la más desarrollada de la casa. Acidez baja (la finca
  // describe solo "una nota cítrica suave"), cuerpo alto y el amargor
  // agradable del cacao oscuro; el carácter del Castillo (chocolate oscuro,
  // nueces) es el que domina. Se sostiene con leche.
  lena: {
    intensity: 5,
    acidity: 2,
    body: 4,
    sweetness: 3,
    taste: { cacao: 3, equilibrado: 1 },
    milk: 2,
    methods: [ESPRESSO, MOKA, PRESS, ELECTRIC],
    pitch: "La taza más intensa de la casa: cacao oscuro, frutos secos y el final ahumado de la leña.",
    roast: "A la leña",
  },
  // Tostión media: conserva la acidez que da la altura (la más viva de los
  // tres), con dulzor de panela y chocolate con leche. Cuerpo medio. Es la
  // mejor opción para métodos de filtro.
  precision: {
    intensity: 3,
    acidity: 4,
    body: 3,
    sweetness: 4,
    taste: { citrico: 3, dulce: 2, equilibrado: 2 },
    milk: 1,
    methods: [V60, CHEMEX, AEROPRESS, ELECTRIC],
    pitch: "La más luminosa: naranja y mandarina con dulzor de panela, almendra y chocolate con leche.",
    roast: "Media",
  },
  // Honey Red: el mucílago redondea la acidez (media, según la finca), sube el
  // cuerpo (medio-alto) y da el mayor dulzor de la casa. Menos cítrico que la
  // tostión de precisión y con un fondo achocolatado.
  "honey-red": {
    intensity: 3,
    acidity: 3,
    body: 4,
    sweetness: 5,
    taste: { dulce: 3, equilibrado: 2, cacao: 1 },
    milk: 1,
    methods: [PRESS, AEROPRESS, V60, COLD],
    pitch: "La más dulce y redonda: acidez media, cuerpo medio-alto y el dulzor del proceso honey.",
    postHarvest: "Honey (Red)",
  },
  honey: {
    intensity: 3,
    acidity: 3,
    body: 4,
    sweetness: 4,
    taste: { dulce: 2, equilibrado: 2 },
    milk: 1,
    methods: [PRESS, V60, AEROPRESS],
    pitch: "Cuerpo medio-alto y acidez media, con el dulzor del proceso honey.",
  },
  "honey-black": {
    intensity: 4,
    acidity: 2,
    body: 5,
    sweetness: 5,
    taste: { dulce: 3, cacao: 1 },
    milk: 2,
    methods: [PRESS, ESPRESSO, COLD],
    pitch: "El honey más dulce e intenso: fruta confitada, melaza y un final largo.",
  },
  lavado: {
    intensity: 2,
    acidity: 4,
    body: 2,
    sweetness: 3,
    taste: { citrico: 2, equilibrado: 3 },
    milk: 0,
    methods: [V60, CHEMEX, ELECTRIC],
    pitch: "Una taza limpia y brillante para acompañar cualquier momento.",
  },
  natural: {
    intensity: 4,
    acidity: 3,
    body: 4,
    sweetness: 5,
    taste: { dulce: 3, citrico: 1 },
    milk: 1,
    methods: [V60, PRESS, COLD],
    pitch: "Fruta madura, chocolate y caramelo en una taza intensa y dulce.",
  },
};

const byCategory: Record<ProductCategory, CoffeeProfile> = {
  wood: byProduct.lena,
  precision: byProduct.precision,
  honey: byProduct.honey,
  washed: byProduct.lavado,
  natural: byProduct.natural,
  gift: { ...byProduct.precision, taste: { equilibrado: 2 }, pitch: "" },
};

export function coffeeProfile(product: Pick<Product, "id" | "category">): CoffeeProfile {
  return byProduct[product.id] ?? byCategory[product.category];
}

export const tasteOptions: { id: TasteId; label: string; hint: string }[] = [
  { id: "cacao", label: "Chocolate y cacao", hint: "Intenso, con carácter" },
  { id: "citrico", label: "Cítrico y luminoso", hint: "Naranja, mandarina, final limpio" },
  { id: "dulce", label: "Dulce y redondo", hint: "Suave, dulce, sin amargor" },
  { id: "equilibrado", label: "Equilibrado", hint: "Para todos los días" },
];

export const drinkOptions: { id: DrinkId; label: string; hint: string }[] = [
  { id: "negro", label: "Solo, como un tinto", hint: "Sin leche" },
  { id: "leche", label: "Con leche", hint: "Perico, capuchino o latte" },
];

export type Answers = { taste?: TasteId; drink?: DrinkId; method?: string };

export type Recommendation = { product: Product; score: number; reasons: string[] };

/**
 * Ordena los cafés publicados según las respuestas. Funciona con respuestas
 * parciales y solo recomienda cafés que existen en el catálogo.
 */
export function rankCoffees(products: Product[], answers: Answers, isAvailable: (product: Product) => boolean): Recommendation[] {
  if (!answers.taste) return [];
  return products
    .map((product, index) => {
      const profile = coffeeProfile(product);
      const reasons: string[] = [];
      let score = 0;

      const affinity = profile.taste[answers.taste!] ?? 0;
      score += affinity * 3;
      if (affinity >= 2) {
        const notes = product.notes.slice(0, 3).join(", ").toLowerCase();
        reasons.push(notes ? `Tiene lo que buscas: ${notes}.` : profile.pitch);
      }

      if (answers.drink === "leche") {
        score += profile.milk * 2;
        if (profile.milk === 2) reasons.push("Tiene cuerpo para no perderse en la leche.");
        else if (profile.milk === 1) reasons.push("Va bien solo o con un poco de leche.");
      } else if (answers.drink === "negro") {
        if (profile.milk <= 1) {
          score += 1.5;
          reasons.push("Se luce solo, sin leche ni azúcar.");
        }
      }

      if (answers.method) {
        // Un café que no viene en esa molienda solo gana si el gusto lo justifica.
        const offered = product.variants.some((variant) => variant.grinds.includes(answers.method!));
        if (!offered) {
          score -= 3;
        } else if (answers.method === "En grano") {
          reasons.push("Te lo enviamos en grano para que lo muelas justo antes de preparar.");
        } else if (profile.methods.includes(answers.method)) {
          score += 1.5;
          reasons.push(`Se expresa muy bien en ${methodPhrase(answers.method)}, y te lo molemos para eso.`);
        } else {
          reasons.push(`Te lo molemos para ${methodPhrase(answers.method)}.`);
        }
      }

      // Entre perfiles parecidos se prefiere el que hoy se puede comprar y el
      // que la finca ordenó primero en el catálogo.
      if (isAvailable(product)) score += 0.75;
      score -= index * 0.01;
      return { product, score, reasons: reasons.length ? reasons : [profile.pitch].filter(Boolean) };
    })
    .sort((a, b) => b.score - a.score);
}

const numberWords = ["", "Un", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"];

/** "Tres cafés", "Un café", "12 cafés". */
export function countCoffees(count: number) {
  const word = numberWords[count] ?? String(count);
  return `${word} ${count === 1 ? "café" : "cafés"}`;
}
