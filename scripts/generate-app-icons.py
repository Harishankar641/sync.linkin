#!/usr/bin/env python3
"""
SyncedIn app-icon generator (PIL native, no SVG engine required).

Renders a 1024x1024 master icon as a pure PIL image, then resizes to
every iOS + Android size. Drop the resulting `ios/` and `android/`
folders into the respective native projects.

Usage:
    python3 scripts/generate-app-icons.py
"""

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "app-icons"
OUT.mkdir(parents=True, exist_ok=True)

MASTER = 1024


def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def render_gradient_bg(size):
    """Diagonal gradient stops matching the SyncedIn brand palette."""
    img = Image.new("RGB", (size, size), (5, 2, 31))
    pixels = img.load()
    stops = [
        (0.00, (5, 2, 31)),       # #05021f deep
        (0.35, (30, 58, 255)),    # #1e3aff electric blue
        (0.65, (107, 45, 201)),   # #6b2dc9 violet
        (1.00, (216, 59, 255)),   # #d83bff hot magenta
    ]
    diag = (size - 1) * 2
    for y in range(size):
        for x in range(size):
            t = (x + y) / diag
            # Find the active stop segment.
            for i in range(len(stops) - 1):
                t0, c0 = stops[i]
                t1, c1 = stops[i + 1]
                if t0 <= t <= t1:
                    local = (t - t0) / (t1 - t0) if t1 != t0 else 0
                    pixels[x, y] = lerp_color(c0, c1, local)
                    break
            else:
                pixels[x, y] = stops[-1][1]
    return img


def add_radial_glow(img):
    """White-hot center bloom layered over the gradient."""
    size = img.size[0]
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g_pix = glow.load()
    cx, cy = size / 2, size / 2
    max_r = size * 0.55
    for y in range(size):
        for x in range(size):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            t = max(0, 1 - d / max_r)
            # Cubic falloff so the center reads bright but tails off fast.
            a = int(140 * (t ** 2))
            if a > 0:
                g_pix[x, y] = (255, 255, 255, a)
    img = img.convert("RGBA")
    img.alpha_composite(glow)
    return img


def draw_twin_rings(img):
    """Two interlocked rings + center dot. Drawn supersized then
    downsampled for clean anti-aliased edges."""
    size = img.size[0]
    SS = 4  # supersample factor
    layer = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # Coordinates in master-pixel space, scaled up by SS.
    s = SS
    left_c = (400 * s, 512 * s)
    right_c = (624 * s, 512 * s)
    r = 180 * s
    sw = 48 * s

    # Left ring — cool blue-white
    d.ellipse(
        [left_c[0] - r, left_c[1] - r, left_c[0] + r, left_c[1] + r],
        outline=(220, 232, 255, 255),
        width=sw
    )
    # Right ring — warm magenta-white
    d.ellipse(
        [right_c[0] - r, right_c[1] - r, right_c[0] + r, right_c[1] + r],
        outline=(255, 200, 255, 255),
        width=sw
    )
    # Center dot — pure white
    dot_r = 32 * s
    d.ellipse(
        [size * s / 2 - dot_r, size * s / 2 - dot_r,
         size * s / 2 + dot_r, size * s / 2 + dot_r],
        fill=(255, 255, 255, 255)
    )

    # Downsample for clean edges.
    layer = layer.resize((size, size), Image.LANCZOS)

    # Soft glow behind the rings.
    glow = layer.filter(ImageFilter.GaussianBlur(radius=14))
    img.alpha_composite(glow)
    img.alpha_composite(layer)
    return img


def render_master():
    img = render_gradient_bg(MASTER)
    img = add_radial_glow(img)
    img = draw_twin_rings(img)
    return img.convert("RGB")


def save_set(master, out_dir, sizes):
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, px in sizes:
        resized = master.resize((px, px), Image.LANCZOS)
        p = out_dir / f"{name}.png"
        resized.save(p, "PNG", optimize=True)
        paths.append(p)
        print(f"  ✓ {p.relative_to(ROOT)}  ({px}x{px})")
    return paths


def render_adaptive_foreground(size):
    """Android adaptive icon foreground — transparent bg, rings centered.
    The OS clips this into a 66% safe-zone inside a 108dp canvas, so the
    rings live in the inner ~67% of the rendered image."""
    SS = 4
    img = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = size * SS / 2, size * SS / 2
    r = size * SS * 0.18
    sep = size * SS * 0.12
    sw = int(size * SS * 0.05)
    d.ellipse(
        [cx - sep - r, cy - r, cx - sep + r, cy + r],
        outline=(220, 232, 255, 255), width=sw
    )
    d.ellipse(
        [cx + sep - r, cy - r, cx + sep + r, cy + r],
        outline=(255, 200, 255, 255), width=sw
    )
    dot = size * SS * 0.025
    d.ellipse(
        [cx - dot, cy - dot, cx + dot, cy + dot],
        fill=(255, 255, 255, 255)
    )
    return img.resize((size, size), Image.LANCZOS)


def render_adaptive_background(size):
    """Android adaptive icon background — full-bleed brand gradient."""
    return render_gradient_bg(size)


def render_screenshot_template():
    """6.7-inch iPhone screenshot template (1290x2796)."""
    W, H = 1290, 2796
    img = render_gradient_bg(max(W, H))
    img = img.crop((0, 0, W, H))
    d = ImageDraw.Draw(img)
    # Centered placeholder card for Cowork screenshot drop-in.
    card = (80, 420, 1210, 2420)
    d.rounded_rectangle(card, radius=64, fill=(255, 255, 255, 24))
    return img


def main():
    print("Rendering master 1024x1024…")
    master = render_master()
    master.save(OUT / "icon.master.png", "PNG", optimize=True)
    print(f"  ✓ {(OUT / 'icon.master.png').relative_to(ROOT)}")

    ios_sizes = [
        ("Icon-40", 40),
        ("Icon-58", 58),
        ("Icon-60", 60),
        ("Icon-76", 76),
        ("Icon-80", 80),
        ("Icon-87", 87),
        ("Icon-120", 120),
        ("Icon-152", 152),
        ("Icon-167", 167),
        ("Icon-180", 180),
        ("Icon-1024", 1024),
    ]
    print("\niOS icons:")
    save_set(master, OUT / "ios", ios_sizes)

    android_sizes = [
        ("ic_launcher_48", 48),
        ("ic_launcher_72", 72),
        ("ic_launcher_96", 96),
        ("ic_launcher_144", 144),
        ("ic_launcher_192", 192),
        ("ic_launcher_512", 512),
    ]
    print("\nAndroid legacy icons:")
    save_set(master, OUT / "android", android_sizes)

    print("\nAndroid adaptive icon (foreground + background, 432x432):")
    fg = render_adaptive_foreground(432)
    fg.save(OUT / "android" / "ic_launcher_foreground.png", "PNG", optimize=True)
    bg = render_adaptive_background(432)
    bg.save(OUT / "android" / "ic_launcher_background.png", "PNG", optimize=True)
    print("  ✓ android/ic_launcher_foreground.png")
    print("  ✓ android/ic_launcher_background.png")

    print("\nScreenshot template (1290x2796, 6.7-inch iPhone):")
    shot = render_screenshot_template()
    shot.save(OUT / "screenshot-template.png", "PNG", optimize=True)
    print("  ✓ screenshot-template.png")

    print(f"\nAll outputs at: {OUT}")


if __name__ == "__main__":
    main()
