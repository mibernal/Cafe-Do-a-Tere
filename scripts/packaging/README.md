# Imágenes de producto empacado

La tienda muestra cada presentación como una bolsa doypack kraft (válvula,
cierre zip y sellado dentado) con la etiqueta del comercio aplicada al
frente. La etiqueta no se redibuja: se usa el archivo original
`public/assets/cafe-*-front.jpg`, con una curvatura leve y la luz de la bolsa.

| Script | Qué hace |
|---|---|
| `labels.py` | Completa las etiquetas que faltan: la versión **en grano** de Honey Red, Honey Black, Lavado y Natural (250 g y 500 g), tomando el ícono, la celda «Café tostado en grano» y el pie de la etiqueta original de Tostado a la leña 500 g en grano; y **Tostión de precisión 250 g** (la etiqueta de 500 g con el peso de 250 g). |
| `packshots.py` | Genera `public/assets/pack-<café>-<peso>[-beans].png` (640 × 800, con transparencia). La bolsa de 250 g se dibuja más pequeña que la de 500 g. |

```bash
pip install opencv-python-headless numpy pillow imagequant
python3 -I scripts/packaging/labels.py public/assets      # solo si cambian las etiquetas base
python3 -I scripts/packaging/packshots.py public/assets   # todas las bolsas
python3 -I scripts/packaging/packshots.py public/assets honey-red   # solo las que coincidan
```

## Cambiar una etiqueta por la definitiva

1. Reemplaza `public/assets/cafe-<café>-<peso>-front.jpg` (y `-beans-front.jpg`
   si vende en grano) con el mismo nombre, 420 × 580 px.
2. Vuelve a generar sus bolsas con `packshots.py`.
3. Quita sus nombres de `ILLUSTRATIVE_PACKS` en `lib/provisional-assets.ts`
   para que deje de mostrarse el aviso «Empaque ilustrativo».

Si el empaque real no es una bolsa kraft, los colores y la forma están en
`kraft_texture()`, `silhouette()` y `shading()` de `packshots.py`.
