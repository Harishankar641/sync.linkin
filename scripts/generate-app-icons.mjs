#!/usr/bin/env node
/**
 * SyncedIn app icon generator.
 *
 * Renders the master 1024x1024 brand icon as SVG, then uses ImageMagick
 * to rasterize it to every size iOS + Android expect. Drop the output
 * folder contents into:
 *   - ios/App/App/Assets.xcassets/AppIcon.appiconset/   (iOS catalog)
 *   - android/app/src/main/res/mipmap-*                 (Android)
 *
 * Run from project root:
 *   node scripts/generate-app-icons.mjs
 *
 * Requires `convert` (ImageMagick) on PATH.
 */

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "public", "app-icons");
mkdirSync(OUT_DIR, { recursive: true });

/**
 * Master 1024x1024 icon. Brand mark = twin-pair interlocked circles on
 * the SyncedIn gradient. White-hot inner glow conveys "two clones
 * about to sync". Rounded square corner radius matches iOS native icon
 * grid (180/1024 ≈ 17.6% — Apple applies the squircle mask, but the
 * App Store still expects a square master, so we render a square here
 * and the OS handles the corners).
 */
function masterSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#05021f"/>
      <stop offset="35%" stop-color="#1e3aff"/>
      <stop offset="65%" stop-color="#6b2dc9"/>
      <stop offset="100%" stop-color="#d83bff"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.55">
      <stop offset="0%" stop-color="rgba(255,255,255,0.55)"/>
      <stop offset="60%" stop-color="rgba(255,255,255,0.05)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <linearGradient id="ringLeft" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#a8b6ff"/>
    </linearGradient>
    <linearGradient id="ringRight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff9cff"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="12"/>
      <feOffset dx="0" dy="6"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
  <g filter="url(#softGlow)">
    <circle cx="400" cy="512" r="180" fill="none" stroke="url(#ringLeft)" stroke-width="48"/>
    <circle cx="624" cy="512" r="180" fill="none" stroke="url(#ringRight)" stroke-width="48"/>
    <circle cx="512" cy="512" r="32" fill="#ffffff"/>
  </g>
</svg>`;
}

const masterSvgPath = join(OUT_DIR, "icon.master.svg");
writeFileSync(masterSvgPath, masterSvg());

// iOS App Icon catalog: every size the Asset Catalog wants. Sizes are
// expressed as pixels (already 1x/2x/3x flattened) since that's what
// `convert` outputs and what Xcode happily ingests via drag-drop.
const IOS_SIZES = [
  { name: "Icon-40", px: 40 },
  { name: "Icon-58", px: 58 },
  { name: "Icon-60", px: 60 },
  { name: "Icon-76", px: 76 },
  { name: "Icon-80", px: 80 },
  { name: "Icon-87", px: 87 },
  { name: "Icon-120", px: 120 },
  { name: "Icon-152", px: 152 },
  { name: "Icon-167", px: 167 },
  { name: "Icon-180", px: 180 },
  { name: "Icon-1024", px: 1024 } // App Store marketing icon
];

const ANDROID_SIZES = [
  { name: "ic_launcher_48", px: 48 }, // mdpi
  { name: "ic_launcher_72", px: 72 }, // hdpi
  { name: "ic_launcher_96", px: 96 }, // xhdpi
  { name: "ic_launcher_144", px: 144 }, // xxhdpi
  { name: "ic_launcher_192", px: 192 }, // xxxhdpi
  { name: "ic_launcher_512", px: 512 } // Play Store listing icon
];

function render(target, sizePx) {
  const out = join(OUT_DIR, `${target}.png`);
  execSync(
    `convert -background none -density 384 -resize ${sizePx}x${sizePx} "${masterSvgPath}" "${out}"`,
    { stdio: "inherit" }
  );
  return out;
}

console.log(`Rendering iOS icons → ${OUT_DIR}/ios/`);
mkdirSync(join(OUT_DIR, "ios"), { recursive: true });
for (const s of IOS_SIZES) {
  const out = join("ios", s.name);
  render(out, s.px);
}

console.log(`Rendering Android icons → ${OUT_DIR}/android/`);
mkdirSync(join(OUT_DIR, "android"), { recursive: true });
for (const s of ANDROID_SIZES) {
  const out = join("android", s.name);
  render(out, s.px);
}

// Android adaptive icon = a foreground SVG (transparent bg) + a background
// SVG (solid color/gradient). Android Studio composites them on-device.
const adaptiveFg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <defs>
    <linearGradient id="ringLeft" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#a8b6ff"/>
    </linearGradient>
    <linearGradient id="ringRight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff9cff"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  <g transform="translate(54 54)">
    <circle cx="-12" cy="0" r="14" fill="none" stroke="url(#ringLeft)" stroke-width="4"/>
    <circle cx="12" cy="0" r="14" fill="none" stroke="url(#ringRight)" stroke-width="4"/>
    <circle cx="0" cy="0" r="2.5" fill="#ffffff"/>
  </g>
</svg>`;
const adaptiveBg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#05021f"/>
      <stop offset="35%" stop-color="#1e3aff"/>
      <stop offset="65%" stop-color="#6b2dc9"/>
      <stop offset="100%" stop-color="#d83bff"/>
    </linearGradient>
  </defs>
  <rect width="108" height="108" fill="url(#bg)"/>
</svg>`;
writeFileSync(join(OUT_DIR, "android", "ic_launcher_foreground.svg"), adaptiveFg);
writeFileSync(join(OUT_DIR, "android", "ic_launcher_background.svg"), adaptiveBg);

// Render adaptive PNGs too (Android Studio prefers PNG fallbacks).
execSync(
  `convert -background none -density 384 -resize 432x432 "${join(OUT_DIR, "android", "ic_launcher_foreground.svg")}" "${join(OUT_DIR, "android", "ic_launcher_foreground.png")}"`
);
execSync(
  `convert -background none -density 384 -resize 432x432 "${join(OUT_DIR, "android", "ic_launcher_background.svg")}" "${join(OUT_DIR, "android", "ic_launcher_background.png")}"`
);

// Screenshot template — 1290×2796 (iPhone 16 Pro Max safe). Renders the
// status-bar + a centered placeholder with brand chrome. Jack drops
// his own Cowork captures over the placeholder area when filing the
// App Store listing.
const screenshotSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1290 2796">
  <defs>
    <linearGradient id="frame" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b0b16"/>
      <stop offset="100%" stop-color="#1a0f2a"/>
    </linearGradient>
  </defs>
  <rect width="1290" height="2796" fill="url(#frame)"/>
  <text x="645" y="240" text-anchor="middle" fill="#ffffff" font-family="-apple-system, system-ui, sans-serif" font-weight="800" font-size="92">SyncedIn</text>
  <text x="645" y="310" text-anchor="middle" fill="#a8b6ff" font-family="-apple-system, system-ui, sans-serif" font-weight="500" font-size="38">Twin-to-twin networking</text>
  <rect x="80" y="420" width="1130" height="2000" rx="64" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
  <text x="645" y="1400" text-anchor="middle" fill="rgba(255,255,255,0.35)" font-family="-apple-system, system-ui, sans-serif" font-weight="500" font-size="36">screenshot goes here · 1130 × 2000</text>
  <text x="645" y="2620" text-anchor="middle" fill="#ffffff" font-family="-apple-system, system-ui, sans-serif" font-weight="700" font-size="58">syncedin.org</text>
</svg>`;
writeFileSync(join(OUT_DIR, "screenshot-template.svg"), screenshotSvg);
execSync(
  `convert -background none -density 192 -resize 1290x2796 "${join(OUT_DIR, "screenshot-template.svg")}" "${join(OUT_DIR, "screenshot-template.png")}"`
);

console.log(`\n✓ Done. Output at: ${OUT_DIR}`);
console.log(`  - ios/Icon-1024.png         → App Store marketing icon`);
console.log(`  - ios/Icon-180.png          → iPhone 60pt @3x`);
console.log(`  - ios/Icon-167.png          → iPad Pro 83.5pt @2x`);
console.log(`  - android/ic_launcher_*.png → Drop into res/mipmap-*`);
console.log(`  - screenshot-template.png   → 6.7-inch iPhone listing template`);
