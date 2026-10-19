// Loader de next/image para el sitio estático (GitHub Pages no tiene
// optimizador de imágenes). scripts/build-pages.mjs genera, para cada JPG o
// PNG de public/assets, una versión WebP por cada ancho de lib/image-widths.json
// en out/assets/_w/<nombre>-<ancho>.webp, sin agrandar el original. Así el
// navegador descarga el tamaño que necesita en lugar del archivo completo.

export default function staticImageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  const match = /^(.*\/assets\/)([^/?#]+)\.(?:jpe?g|png)$/i.exec(src);
  return match ? `${match[1]}_w/${match[2]}-${width}.webp` : src;
}
