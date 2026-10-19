"""
Etiqueta de un peso nuevo a partir de una existente de la misma familia:
cambia solo los dígitos del "Contenido neto" y conserva el resto de la
etiqueta (incluido el "0 g" original). Los dígitos nuevos se dibujan con una
serif bold equivalente (Liberation Serif Bold) a la misma altura y color.

Uso: python3 -I scripts/packaging/weight.py public/assets honey-red 250 340
     (crea cafe-honey-red-340-front.jpg y cafe-honey-red-340-beans-front.jpg)
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(sys.argv[1])
COFFEE, SRC_WEIGHT, NEW_WEIGHT = sys.argv[2], sys.argv[3], sys.argv[4]
FONT = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"
SS = 8

# Posición de los dos primeros dígitos del peso en la familia de etiquetas
# derivada de Tostión de precisión (420 × 580): "2" y "5" de "250 g".
SLOTS = [(243, 251), (253, 261)]
TOP, BASE = 496, 507  # alto de los dígitos (sin descendentes)
ERASE = (241, 494, 263, 510)


def glyph(ch, height_px):
    """Dígito en escala de grises (0 = tinta) con alto exacto height_px."""
    size = 10
    font = ImageFont.truetype(FONT, size)
    while True:
        bb = font.getbbox(ch)
        if bb[3] - bb[1] >= height_px * SS:
            break
        size += 1
        font = ImageFont.truetype(FONT, size)
    bb = font.getbbox(ch)
    img = Image.new("L", (bb[2] - bb[0] + 4 * SS, bb[3] - bb[1] + 4 * SS), 255)
    ImageDraw.Draw(img).text((2 * SS - bb[0], 2 * SS - bb[1]), ch, font=font, fill=0)
    arr = np.asarray(img, np.float32)
    ys, xs = np.nonzero(arr < 128)
    arr = arr[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    h = height_px
    w = max(1, round(arr.shape[1] * h / arr.shape[0]))
    return cv2.resize(arr, (w, h), interpolation=cv2.INTER_AREA) / 255.0


def relabel(src_name, out_name):
    img = cv2.imread(str(ASSETS / src_name))
    if img is None:
        raise SystemExit(f"No se encontró {src_name}")
    x0, y0, x1, y1 = ERASE
    region = img[y0:y1, x0:x1]
    lum = region.mean(axis=2)
    mask = (lum < np.percentile(lum, 85) - 25).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=2)
    img[y0:y1, x0:x1] = cv2.inpaint(region, mask, 4, cv2.INPAINT_TELEA)

    ink = np.array([20, 30, 39], np.float32)  # BGR de la tinta original
    digits = NEW_WEIGHT[:-1]  # se conserva el "0" final y la "g"
    if NEW_WEIGHT[-1] != "0" or len(digits) != len(SLOTS):
        raise SystemExit("Solo pesos de tres cifras terminados en 0 (p. ej. 340)")
    for ch, (sx0, sx1) in zip(digits, SLOTS):
        g = glyph(ch, BASE - TOP + 1)
        h, w = g.shape
        cx = (sx0 + sx1) / 2
        gx = int(round(cx - w / 2))
        area = img[TOP : TOP + h, gx : gx + w].astype(np.float32)
        alpha = np.clip((1 - g) * 1.35, 0, 1)[..., None]  # el original es algo más grueso
        img[TOP : TOP + h, gx : gx + w] = np.clip(area * (1 - alpha) + ink * alpha, 0, 255).astype(np.uint8)
    cv2.imwrite(str(ASSETS / out_name), img, [cv2.IMWRITE_JPEG_QUALITY, 94])
    print(out_name)


if __name__ == "__main__":
    relabel(f"cafe-{COFFEE}-{SRC_WEIGHT}-front.jpg", f"cafe-{COFFEE}-{NEW_WEIGHT}-front.jpg")
    beans = ASSETS / f"cafe-{COFFEE}-{SRC_WEIGHT}-beans-front.jpg"
    if beans.exists():
        relabel(beans.name, f"cafe-{COFFEE}-{NEW_WEIGHT}-beans-front.jpg")
