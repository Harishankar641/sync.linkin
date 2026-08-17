#!/usr/bin/env python3
"""Generate Google Play Store listing assets.

  - feature-graphic.png  : 1024x500 banner shown above the screenshots in
                           the Play Store listing. Required for Production.
  - icon-512.png         : 512x512 high-res icon for the store listing
                           (separate from the in-app launcher icon).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "play-assets"
OUT.mkdir(parents=True, exist_ok=True)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(w, h, stops):
    img = Image.new("RGB", (w, h), stops[0][1])
    p = img.load()
    diag = (w - 1) + (h - 1)
    for y in range(h):
        for x in range(w):
            t = (x + y) / diag
            for i in range(len(stops) - 1):
                t0, c0 = stops[i]
                t1, c1 = stops[i + 1]
                if t0 <= t <= t1:
                    local = (t - t0) / (t1 - t0) if t1 != t0 else 0
                    p[x, y] = lerp(c0, c1, local)
                    break
            else:
                p[x, y] = stops[-1][1]
    return img


BRAND = [
    (0.00, (5, 2, 31)),
    (0.35, (30, 58, 255)),
    (0.65, (107, 45, 201)),
    (1.00, (216, 59, 255)),
]


def feature_graphic():
    W, H = 1024, 500
    img = gradient(W, H, BRAND).convert("RGBA")

    # Rings on the left third
    SS = 2
    layer = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = 220 * SS, H * SS / 2
    r = 110 * SS
    sep = 70 * SS
    sw = 28 * SS
    d.ellipse(
        [cx - sep - r, cy - r, cx - sep + r, cy + r],
        outline=(220, 232, 255, 255), width=sw,
    )
    d.ellipse(
        [cx + sep - r, cy - r, cx + sep + r, cy + r],
        outline=(255, 200, 255, 255), width=sw,
    )
    dot = 18 * SS
    d.ellipse(
        [cx - dot, cy - dot, cx + dot, cy + dot], fill=(255, 255, 255, 255)
    )
    layer = layer.resize((W, H), Image.LANCZOS)
    glow = layer.filter(ImageFilter.GaussianBlur(radius=12))
    img.alpha_composite(glow)
    img.alpha_composite(layer)

    # Text on the right side. Try a sequence of font paths, fall back
    # to Pillow's bundled default font with explicit size (Pillow 10+).
    d2 = ImageDraw.Draw(img)
    candidate_bold = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Avenir Next.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    candidate_sub = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    def load(paths, size):
        for p in paths:
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
        try:
            return ImageFont.load_default(size=size)  # Pillow 10+
        except TypeError:
            return ImageFont.load_default()
    font_big = load(candidate_bold, 72)
    font_sub = load(candidate_sub, 30)

    d2.text((440, 170), "SyncedIn",
            font=font_big, fill=(255, 255, 255, 255))
    d2.text((440, 270),
            "Your digital twin talks to theirs.",
            font=font_sub, fill=(220, 232, 255, 255))
    d2.text((440, 308),
            "Two clones find the win-win",
            font=font_sub, fill=(220, 232, 255, 255))
    d2.text((440, 346),
            "before either of you spends a minute on a call.",
            font=font_sub, fill=(220, 232, 255, 255))

    out = OUT / "feature-graphic.png"
    img.convert("RGB").save(out, "PNG", optimize=True)
    print(f"  ✓ {out.relative_to(ROOT)}  (1024x500)")


def store_icon():
    """512x512 high-res store-listing icon (different from in-app launcher
    icon — Play wants its own copy for the listing card)."""
    W = 512
    img = gradient(W, W, BRAND).convert("RGBA")
    SS = 4
    layer = Image.new("RGBA", (W * SS, W * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = W * SS / 2, W * SS / 2
    r = 90 * SS
    sep = 55 * SS
    sw = 24 * SS
    d.ellipse(
        [cx - sep - r, cy - r, cx - sep + r, cy + r],
        outline=(220, 232, 255, 255), width=sw,
    )
    d.ellipse(
        [cx + sep - r, cy - r, cx + sep + r, cy + r],
        outline=(255, 200, 255, 255), width=sw,
    )
    dot = 16 * SS
    d.ellipse(
        [cx - dot, cy - dot, cx + dot, cy + dot], fill=(255, 255, 255, 255)
    )
    layer = layer.resize((W, W), Image.LANCZOS)
    glow = layer.filter(ImageFilter.GaussianBlur(radius=8))
    img.alpha_composite(glow)
    img.alpha_composite(layer)
    out = OUT / "icon-512.png"
    img.convert("RGB").save(out, "PNG", optimize=True)
    print(f"  ✓ {out.relative_to(ROOT)}  (512x512)")


if __name__ == "__main__":
    feature_graphic()
    store_icon()
    print(f"\nPlay Store assets at: {OUT}")
