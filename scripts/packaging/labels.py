"""
Completa las etiquetas que faltan a partir de las etiquetas originales del
comercio, sin redibujar la marca:

- Versión EN GRANO de cada etiqueta "Tostado y molido": se trasplantan el
  ícono del empaque con granos, la celda "Café tostado en grano" y el pie
  "Café tostado y en grano" desde la etiqueta original de Tostado a la leña
  500 g en grano.
- Tostión de precisión 250 g: la etiqueta de 500 g con el peso "250 g" de la
  misma familia de etiquetas.

Uso: python3 -I scripts/packaging/labels.py public/assets
"""
import sys
from pathlib import Path

import cv2
import numpy as np

ASSETS = Path(sys.argv[1] if len(sys.argv) > 1 else "public/assets")
BEANS_SRC = ASSETS / "cafe-lena-500-beans-front.jpg"


def read(name):
    image = cv2.imread(str(ASSETS / name))
    if image is None:
        raise SystemExit(f"No se encontró {name}")
    return image


def paper_color(patch):
    """Color del papel: mediana de los píxeles más claros del recorte."""
    lum = patch.mean(axis=2)
    light = patch[lum >= np.percentile(lum, 70)]
    return np.median(light, axis=0)


def ink_mask(patch, paper, threshold=28):
    diff = np.abs(patch.astype(float) - paper).max(axis=2)
    return (diff > threshold).astype(np.uint8) * 255


def erase(dst, box, pad=2):
    """Borra la tinta del recuadro con inpainting para dejar solo el papel."""
    x0, y0, x1, y1 = box
    region = dst[y0:y1, x0:x1]
    mask = ink_mask(region, paper_color(region), threshold=22)
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=pad)
    dst[y0:y1, x0:x1] = cv2.inpaint(region, mask, 5, cv2.INPAINT_TELEA)


def stamp(dst, src, src_box, dx, dy):
    """Pone la tinta de src (recuadro src_box) sobre dst desplazada (dx, dy),
    en modo multiplicar respecto al papel de cada etiqueta."""
    x0, y0, x1, y1 = src_box
    patch = src[y0:y1, x0:x1].astype(float)
    ratio = np.clip(patch / paper_color(src[y0:y1, x0:x1]), 0, 1.0)
    # Bordes suaves para que no se note el recorte.
    h, w = ratio.shape[:2]
    feather = np.ones((h, w), float)
    edge = 3
    ramp = np.linspace(0, 1, edge + 2)[1:-1]
    feather[:edge, :] *= ramp[:, None]
    feather[-edge:, :] *= ramp[::-1][:, None]
    feather[:, :edge] *= ramp[None, :]
    feather[:, -edge:] *= ramp[::-1][None, :]
    ratio = 1 - (1 - ratio) * feather[..., None]
    tx0, ty0 = x0 + dx, y0 + dy
    target = dst[ty0 : ty0 + h, tx0 : tx0 + w].astype(float)
    dst[ty0 : ty0 + h, tx0 : tx0 + w] = np.clip(target * ratio, 0, 255).astype(np.uint8)


def ink_bbox(image, box, threshold=40):
    x0, y0, x1, y1 = box
    region = image[y0:y1, x0:x1]
    ys, xs = np.nonzero(ink_mask(region, paper_color(region), threshold))
    return x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1


def match_offset(src, dst, tpl_box, search_box):
    gs, gd = (cv2.cvtColor(i, cv2.COLOR_BGR2GRAY) for i in (src, dst))
    x0, y0, x1, y1 = tpl_box
    sx0, sy0, sx1, sy1 = search_box
    result = cv2.matchTemplate(gd[sy0:sy1, sx0:sx1], gs[y0:y1, x0:x1], cv2.TM_CCOEFF_NORMED)
    _, score, _, loc = cv2.minMaxLoc(result)
    return sx0 + loc[0] - x0, sy0 + loc[1] - y0, score


def to_beans(name, out_name):
    src, dst = read(BEANS_SRC.name), read(name)
    # Alineación por el texto común "CAFÉ TOSTADO" de la cuarta columna.
    dx, dy, score = match_offset(src, dst, (314, 468, 396, 486), (280, 440, 420, 520))
    if score < 0.7:
        raise SystemExit(f"{name}: no se pudo alinear (score {score:.2f})")

    # 1) Ícono del empaque (columna 3), sin tocar el peso.
    bag_src = (238, 414, 300, 466)
    erase(dst, (bag_src[0] + dx - 4, bag_src[1] + dy - 2, bag_src[2] + dx + 4, bag_src[3] + dy + 1))
    stamp(dst, src, bag_src, dx, dy)

    # 2) Celda "Café tostado en grano" completa (ícono y texto).
    cell_src = (304, 412, 404, 504)
    erase(dst, (cell_src[0] + dx - 2, cell_src[1] + dy - 2, min(cell_src[2] + dx + 4, 418), cell_src[3] + dy + 2))
    stamp(dst, src, cell_src, dx, dy)

    # 3) Pie "Café tostado y en grano", centrado sobre el pie original.
    foot_dst = ink_bbox(dst, (60, 560, 360, 579))
    foot_src = ink_bbox(src, (60, 558, 360, 579))
    fdx = round((foot_dst[0] + foot_dst[2]) / 2 - (foot_src[0] + foot_src[2]) / 2)
    fdy = foot_dst[1] - foot_src[1]
    erase(dst, (foot_dst[0] - 3, foot_dst[1] - 2, foot_dst[2] + 3, min(foot_dst[3] + 2, 580)))
    box = (foot_src[0] - 2, foot_src[1] - 2, foot_src[2] + 2, min(foot_src[3] + 2, 580 - max(fdy, 0)))
    stamp(dst, src, box, fdx, fdy)

    cv2.imwrite(str(ASSETS / out_name), dst, [cv2.IMWRITE_JPEG_QUALITY, 94])
    print(f"{out_name}  (alineación {dx},{dy} · {score:.2f})")


def precision_250():
    dst = read("cafe-precision-500-front.jpg")
    src = read("cafe-honey-red-250-front.jpg")  # misma familia, peso 250 g
    a = read("cafe-honey-red-500-front.jpg")
    diff = np.abs(src.astype(int) - a.astype(int)).max(axis=2) > 30
    ys, xs = np.nonzero(diff)
    x0, y0, x1, y1 = xs.min() - 3, ys.min() - 3, xs.max() + 4, ys.max() + 4
    dst[y0:y1, x0:x1] = src[y0:y1, x0:x1]
    cv2.imwrite(str(ASSETS / "cafe-precision-250-front.jpg"), dst, [cv2.IMWRITE_JPEG_QUALITY, 94])
    print("cafe-precision-250-front.jpg")


if __name__ == "__main__":
    precision_250()
    for coffee in ["honey-red", "honey-black", "lavado", "natural"]:
        for weight in (250, 500):
            to_beans(f"cafe-{coffee}-{weight}-front.jpg", f"cafe-{coffee}-{weight}-beans-front.jpg")
