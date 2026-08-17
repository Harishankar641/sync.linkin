#!/usr/bin/env python3
"""Generate the 2732x2732 brand splash for iOS Capacitor."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SPLASH_DIR = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset"
SIZE = 2732


def lerp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def gradient_bg(size):
    img = Image.new("RGB", (size, size), (5, 2, 31))
    pix = img.load()
    stops = [
        (0.00, (5, 2, 31)),
        (0.35, (30, 58, 255)),
        (0.65, (107, 45, 201)),
        (1.00, (216, 59, 255)),
    ]
    diag = (size - 1) * 2
    for y in range(size):
        for x in range(size):
            t = (x + y) / diag
            for i in range(len(stops) - 1):
                t0, c0 = stops[i]
                t1, c1 = stops[i + 1]
                if t0 <= t <= t1:
                    local = (t - t0) / (t1 - t0) if t1 != t0 else 0
                    pix[x, y] = lerp(c0, c1, local)
                    break
            else:
                pix[x, y] = stops[-1][1]
    return img


def radial_glow(img):
    size = img.size[0]
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gp = glow.load()
    cx, cy = size / 2, size / 2
    max_r = size * 0.55
    for y in range(size):
        for x in range(size):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            t = max(0, 1 - d / max_r)
            a = int(140 * (t ** 2))
            if a > 0:
                gp[x, y] = (255, 255, 255, a)
    img = img.convert("RGBA")
    img.alpha_composite(glow)
    return img


def main():
    print(f"Rendering {SIZE}x{SIZE} splash…")
    img = gradient_bg(SIZE)
    img = radial_glow(img)

    # Twin-pair rings supersampled then downsampled for smooth edges.
    SS = 2
    layer = Image.new("RGBA", (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = SIZE * SS / 2, SIZE * SS / 2
    r = 380 * SS
    sep = 230 * SS
    sw = 90 * SS
    d.ellipse(
        [cx - sep - r, cy - r, cx - sep + r, cy + r],
        outline=(220, 232, 255, 255), width=sw,
    )
    d.ellipse(
        [cx + sep - r, cy - r, cx + sep + r, cy + r],
        outline=(255, 200, 255, 255), width=sw,
    )
    dot = 60 * SS
    d.ellipse(
        [cx - dot, cy - dot, cx + dot, cy + dot], fill=(255, 255, 255, 255)
    )
    layer = layer.resize((SIZE, SIZE), Image.LANCZOS)
    glow = layer.filter(ImageFilter.GaussianBlur(radius=24))
    img.alpha_composite(glow)
    img.alpha_composite(layer)

    out = img.convert("RGB")
    SPLASH_DIR.mkdir(parents=True, exist_ok=True)
    for name in (
        "splash-2732x2732.png",
        "splash-2732x2732-1.png",
        "splash-2732x2732-2.png",
    ):
        p = SPLASH_DIR / name
        out.save(p, "PNG", optimize=True)
        print(f"  ✓ {p.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
