/**
 * Etiquetas ilustrativas: se generaron a partir de la etiqueta de Tostión de
 * precisión mientras llegan los empaques definitivos. La tienda no las muestra
 * como si fueran el empaque real: en su lugar usa la foto del café.
 *
 * Para publicar la etiqueta definitiva, reemplaza el archivo en public/assets
 * con el mismo nombre y quítalo de esta lista.
 */
export const PROVISIONAL_LABELS = new Set([
  "/assets/cafe-honey-red-250-front.jpg",
  "/assets/cafe-honey-red-500-front.jpg",
  "/assets/cafe-honey-black-250-front.jpg",
  "/assets/cafe-honey-black-500-front.jpg",
  "/assets/cafe-lavado-250-front.jpg",
  "/assets/cafe-lavado-500-front.jpg",
  "/assets/cafe-natural-250-front.jpg",
  "/assets/cafe-natural-500-front.jpg",
]);

export function isProvisionalLabel(path: string) {
  return PROVISIONAL_LABELS.has(path);
}
