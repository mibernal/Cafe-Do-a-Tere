"""
Imágenes de producto empacado: una bolsa doypack kraft con válvula y cierre
zip, con la etiqueta original del comercio aplicada al frente. La etiqueta no
se redibuja ni se recorta: solo se curva levemente y recibe la luz de la bolsa.

La bolsa de 250 g se dibuja más pequeña que la de 500 g en el mismo lienzo,
para que el cambio de presentación también se note en el tamaño.

Uso: python3 -I scripts/packaging/packshots.py public/assets
Salida: public/assets/pack-<etiqueta>.png (PNG con transparencia, 640 × 800)
"""
import sys
from pathlib import Path

import cv2
import numpy as np

ASSETS = Path(sys.argv[1] if len(sys.argv) > 1 else "public/assets")
SS = 2  # supermuestreo
OUT_W, OUT_H = 640, 800
W, H = OUT_W * SS, OUT_H * SS
rng = np.random.default_rng(7)


def smooth_noise(h, w, scale, seed):
    r = np.random.default_rng(seed)
    small = r.standard_normal((max(2, h // scale), max(2, w // scale))).astype(np.float32)
    return cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)


def kraft_texture(h, w):
    base = np.array([92, 138, 184], np.float32)  # BGR del kraft
    mottling = smooth_noise(h, w, 120, 1) * 0.022 + smooth_noise(h, w, 26, 2) * 0.012
    grain = rng.standard_normal((h, w)).astype(np.float32) * 0.035
    # Fibras: trazos cortos, mayormente verticales.
    fibers = np.zeros((h, w), np.float32)
    for _ in range(int(h * w / 900)):
        x, y = rng.integers(0, w), rng.integers(0, h)
        length = rng.integers(6, 28) * SS
        angle = np.pi / 2 + rng.normal(0, 0.35)
        x2, y2 = int(x + np.cos(angle) * length), int(y + np.sin(angle) * length)
        cv2.line(fibers, (int(x), int(y)), (x2, y2), float(rng.choice([-1, 1]) * rng.uniform(0.4, 1.0)), 1, cv2.LINE_AA)
    fibers = cv2.GaussianBlur(fibers, (0, 0), 0.8) * 0.05
    factor = 1 + mottling + grain + fibers
    return base[None, None, :] * factor[..., None]


def bag_geometry(scale):
    bh = int(H * 0.87 * scale)
    bw = int(bh * 0.651)
    x0 = (W - bw) // 2
    y1 = H - int(40 * SS)  # base de la bolsa
    y0 = y1 - bh
    return x0, y0, bw, bh


def silhouette(bw, bh):
    """Máscara de la bolsa en coordenadas locales: costados levemente
    abombados, esquinas inferiores redondeadas por el fuelle y borde superior
    dentado del sellado."""
    pts = []
    tooth = 7 * SS
    top_inset = 0.03 * bw
    # Borde superior dentado (izquierda → derecha)
    n = int((bw - 2 * top_inset) / (tooth * 1.6))
    for i in range(n + 1):
        x = top_inset + i * (bw - 2 * top_inset) / n
        pts.append((x, tooth * 0.9 if i % 2 else 0))
    # Costado derecho, con muesca de rasgado bajo el sellado
    seal = 0.065 * bh
    for t in np.linspace(0, 1, 60):
        y = seal * 0.2 + t * (bh - seal * 0.2)
        bulge = np.sin(np.pi * t) * 0.012 * bw
        flare = (t ** 3) * top_inset
        x = bw - top_inset + flare + bulge
        if abs(y - seal * 1.12) < 5 * SS:
            x -= (5 * SS - abs(y - seal * 1.12)) * 1.1
        pts.append((x, y))
    # Base redondeada (fuelle)
    r = 0.07 * bw
    for a in np.linspace(0, np.pi / 2, 16):
        pts.append((bw - r + np.cos(a) * r, bh - r + np.sin(a) * r))
    for a in np.linspace(np.pi / 2, np.pi, 16):
        pts.append((r + np.cos(a) * r, bh - r + np.sin(a) * r))
    for t in np.linspace(1, 0, 60):
        y = seal * 0.2 + t * (bh - seal * 0.2)
        bulge = np.sin(np.pi * t) * 0.012 * bw
        flare = (t ** 3) * top_inset
        x = top_inset - flare - bulge
        if abs(y - seal * 1.12) < 5 * SS:
            x += (5 * SS - abs(y - seal * 1.12)) * 1.1
        pts.append((x, y))
    mask = np.zeros((bh, bw), np.uint8)
    cv2.fillPoly(mask, [np.array(pts, np.int32)], 255, cv2.LINE_AA)
    return mask, seal


def shading(bw, bh, seal):
    u = np.linspace(0.0005, 0.9995, bw, dtype=np.float32)[None, :]
    v = np.linspace(0, 1, bh, dtype=np.float32)[:, None]
    # Volumen horizontal: la bolsa llena se curva hacia los bordes.
    body = 0.60 + 0.44 * np.sin(np.pi * u) ** 0.5
    # Costuras laterales: borde algo más oscuro con un filo de luz.
    side = -0.10 * (np.exp(-(u ** 2) / 0.0009) + np.exp(-((1 - u) ** 2) / 0.0009))
    side += 0.05 * (np.exp(-((u - 0.035) ** 2) / 0.00006) + np.exp(-((u - 0.965) ** 2) / 0.00006))
    highlight = 0.10 * np.exp(-((u - 0.34) ** 2) / 0.006)
    rim = -0.10 * np.exp(-((u - 0.94) ** 2) / 0.002)
    # Vertical: sombra bajo el zip y fuelle inferior.
    s = seal / bh
    zip_shadow = -0.10 * np.exp(-((v - (s + 0.05)) ** 2) / 0.0006)
    zip_ridge = 0.08 * np.exp(-((v - (s + 0.042)) ** 2) / 0.00004)
    top_fall = -0.06 * np.clip(1 - (v - s) / 0.12, 0, 1) * (v > s)
    gusset = -0.16 * np.clip((v - 0.9) / 0.1, 0, 1) ** 1.6
    gusset_line = -0.09 * np.exp(-((v - 0.935) ** 2) / 0.00003) * np.sin(np.pi * u) ** 0.3
    shade = body + side + highlight + rim + zip_shadow + zip_ridge + top_fall + gusset + gusset_line
    # Ondulación del papel y pliegues suaves en las esquinas.
    shade += smooth_noise(bh, bw, 70, 5) * 0.018 * (v > s)
    yy, xx = np.mgrid[0:bh, 0:bw].astype(np.float32)
    for cx, cy, ang, amp in [(0.12, 0.16, 0.9, 0.05), (0.88, 0.17, -0.9, 0.05), (0.1, 0.86, -0.7, 0.04), (0.9, 0.87, 0.7, 0.04)]:
        d = (xx / bw - cx) * np.cos(ang) + (yy / bh - cy) * np.sin(ang)
        fall = np.exp(-(((xx / bw - cx) ** 2 + (yy / bh - cy) ** 2) / 0.006))
        shade += amp * np.sin(d * 90) * fall
    # Sellado superior: más plano y claro.
    seal_zone = (v < s).astype(np.float32)
    shade = shade * (1 - seal_zone) + (0.97 + 0.04 * np.sin(np.pi * u) ** 2) * seal_zone
    return shade.astype(np.float32)


def crimp(tex, bh, bw, seal):
    """Estrías verticales del sellado térmico."""
    y = int(seal)
    xs = np.arange(bw, dtype=np.float32)
    lines = 1 + 0.07 * np.sin(xs * 2 * np.pi / (3.2 * SS))
    tex[:y] *= lines[None, :, None]
    cv2.line(tex, (0, y), (bw, y), (70, 105, 140), max(1, SS), cv2.LINE_AA)
    return tex


def valve(img, cx, cy, r):
    """Válvula desgasificadora redonda."""
    overlay = img.copy()
    cv2.circle(overlay, (cx, cy + int(r * 0.12)), int(r * 1.08), (40, 60, 80), -1, cv2.LINE_AA)
    img[:] = cv2.addWeighted(overlay, 0.35, img, 0.65, 0)
    cv2.circle(img, (cx, cy), r, (58, 72, 86), -1, cv2.LINE_AA)
    cv2.circle(img, (cx, cy), int(r * 0.78), (78, 92, 106), -1, cv2.LINE_AA)
    cv2.circle(img, (cx, cy), int(r * 0.42), (64, 77, 90), -1, cv2.LINE_AA)
    for k in range(4):
        a = k * np.pi / 2 + np.pi / 4
        cv2.circle(img, (int(cx + np.cos(a) * r * 0.6), int(cy + np.sin(a) * r * 0.6)), max(2, int(r * 0.08)), (40, 50, 60), -1, cv2.LINE_AA)
    cv2.ellipse(img, (cx - int(r * 0.25), cy - int(r * 0.3)), (int(r * 0.45), int(r * 0.2)), -30, 0, 360, (150, 160, 170), -1, cv2.LINE_AA)


def curved_label(label, width, height):
    """Etiqueta con curvatura horizontal leve (la bolsa llena es convexa)."""
    lab = cv2.resize(label, (width, height), interpolation=cv2.INTER_CUBIC)
    xs = np.linspace(-1, 1, width, dtype=np.float32)
    bend = 0.6  # radianes de arco visibles a cada lado: curvatura suave
    src_x = np.arcsin(xs * np.sin(bend)) / bend
    map_x = np.tile(((src_x + 1) / 2 * (width - 1))[None, :], (height, 1)).astype(np.float32)
    map_y = np.tile(np.arange(height, dtype=np.float32)[:, None], (1, width))
    return cv2.remap(lab, map_x, map_y, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def rounded_mask(h, w, r):
    m = np.zeros((h, w), np.uint8)
    cv2.rectangle(m, (r, 0), (w - r, h), 255, -1)
    cv2.rectangle(m, (0, r), (w, h - r), 255, -1)
    for cx, cy in [(r, r), (w - r, r), (r, h - r), (w - r, h - r)]:
        cv2.circle(m, (cx, cy), r, 255, -1, cv2.LINE_AA)
    return m


def render(label_name, out_name, weight):
    label = cv2.imread(str(ASSETS / label_name))
    if label is None:
        raise SystemExit(f"No se encontró {label_name}")
    scale = 1.0 if weight >= 500 else 0.84
    x0, y0, bw, bh = bag_geometry(scale)
    mask, seal = silhouette(bw, bh)
    shade = shading(bw, bh, seal)
    tex = kraft_texture(bh, bw)
    tex = crimp(tex, bh, bw, seal)
    bag = tex * shade[..., None]

    # Etiqueta: ancho 80 % de la bolsa, centrada bajo la válvula.
    lw = int(bw * 0.80)
    lh = int(lw * label.shape[0] / label.shape[1])
    lx = (bw - lw) // 2
    ly = int(bh * 0.205)
    if ly + lh > bh * 0.93:
        ly = int(bh * 0.93) - lh
    lab = curved_label(label, lw, lh).astype(np.float32)
    lmask = rounded_mask(lh, lw, int(9 * SS * scale)).astype(np.float32) / 255
    lmask = cv2.GaussianBlur(lmask, (0, 0), 0.6)
    # Sombra fina del adhesivo sobre el kraft.
    sh = np.zeros((bh, bw), np.float32)
    sh[ly : ly + lh, lx : lx + lw] = lmask
    sh = cv2.GaussianBlur(np.roll(sh, (int(2 * SS), int(1 * SS)), (0, 1)), (0, 0), 2.2 * SS)
    bag *= (1 - 0.32 * sh)[..., None]
    # La etiqueta toma la luz de la bolsa (más suave que el kraft).
    lshade = shade[ly : ly + lh, lx : lx + lw]
    lshade = 0.965 + 0.45 * (lshade - lshade.mean())
    lshade = np.clip(lshade, 0.84, 1.02)
    gloss = 0.025 * np.exp(-((np.linspace(0, 1, lw)[None, :] - 0.3) ** 2) / 0.01)
    lab = lab * lshade[..., None] + 255 * gloss[..., None]
    region = bag[ly : ly + lh, lx : lx + lw]
    bag[ly : ly + lh, lx : lx + lw] = region * (1 - lmask[..., None]) + lab * lmask[..., None]

    bag = np.clip(bag, 0, 255).astype(np.uint8)
    valve(bag, bw // 2, int(bh * 0.135), int(bw * 0.045))

    # Lienzo con transparencia y sombra de contacto.
    canvas = np.zeros((H, W, 4), np.float32)
    shadow = np.zeros((H, W), np.float32)
    cv2.ellipse(shadow, (W // 2, y0 + bh - int(4 * SS)), (int(bw * 0.52), int(26 * SS * scale)), 0, 0, 360, 1, -1)
    shadow = cv2.GaussianBlur(shadow, (0, 0), 16 * SS) * 0.55
    soft = np.zeros((H, W), np.float32)
    soft[y0 : y0 + bh, x0 : x0 + bw] = mask / 255
    soft = cv2.GaussianBlur(np.roll(soft, (int(14 * SS), int(10 * SS)), (0, 1)), (0, 0), 22 * SS) * 0.22
    shadow_alpha = np.clip(shadow + soft, 0, 0.6)
    canvas[..., 3] = shadow_alpha
    canvas[..., :3] = np.array([20, 28, 38], np.float32)
    a = (mask / 255).astype(np.float32)
    sub = canvas[y0 : y0 + bh, x0 : x0 + bw]
    sub[..., :3] = sub[..., :3] * (1 - a[..., None]) * (sub[..., 3:4]) + bag * a[..., None]
    alpha = a + sub[..., 3] * (1 - a)
    with np.errstate(invalid="ignore", divide="ignore"):
        sub[..., :3] = np.where(alpha[..., None] > 0, sub[..., :3] / np.maximum(alpha[..., None], 1e-4), 0)
    sub[..., 3] = alpha
    canvas[..., 3] *= 255
    out = cv2.resize(canvas, (OUT_W, OUT_H), interpolation=cv2.INTER_AREA)
    out = np.clip(out, 0, 255).astype(np.uint8)
    save_png(out, ASSETS / out_name)
    print(out_name)


def save_png(bgra, path):
    """PNG de 256 colores con transparencia (~200 KB) si está disponible
    libimagequant (pip install imagequant); si no, PNG completo."""
    try:
        import imagequant
        from PIL import Image
    except ImportError:
        cv2.imwrite(str(path), bgra, [cv2.IMWRITE_PNG_COMPRESSION, 9])
        return
    rgba = Image.fromarray(cv2.cvtColor(bgra, cv2.COLOR_BGRA2RGBA))
    imagequant.quantize_pil_image(rgba, dithering_level=1.0, max_colors=256, min_quality=70, max_quality=95).save(path, optimize=True)


# (etiqueta, imagen de salida, peso)
PACKS = [
    ("cafe-lena-250-front.jpg", 250),
    ("cafe-lena-500-ground-front.jpg", 500),
    ("cafe-lena-500-beans-front.jpg", 500),
    ("cafe-precision-250-front.jpg", 250),
    ("cafe-precision-500-front.jpg", 500),
]
for coffee in ["honey-red", "honey-black", "lavado", "natural"]:
    for weight in (250, 500):
        PACKS.append((f"cafe-{coffee}-{weight}-front.jpg", weight))
        PACKS.append((f"cafe-{coffee}-{weight}-beans-front.jpg", weight))

if __name__ == "__main__":
    only = sys.argv[2:] or None
    for label_name, weight in PACKS:
        out_name = "pack-" + label_name.removeprefix("cafe-").replace("-front.jpg", ".png")
        if only and not any(o in label_name for o in only):
            continue
        render(label_name, out_name, weight)
