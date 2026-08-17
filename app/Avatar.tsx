"use client";

/**
 * Avatar — gradient-initials placeholder unless we have a working
 * photo URL. If avatarUrl is present, render the image; on load
 * failure, fall back to the same initials chip the no-URL path uses.
 *
 * Previously this was a server component that rendered <img> with no
 * onError handler — so dead URLs (LinkedIn CDN links expire, X CDN
 * URLs are auth-walled, etc.) showed a browser broken-image icon
 * forever. Jack: "lets fix this image error." Now a client component
 * so onError fires when the image fails to load, swapping to the
 * gradient initials.
 *
 * The gradient is derived deterministically from the user id (or name)
 * so each person always gets the same look across the app.
 */

import { useState } from "react";

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function gradientFor(seed: string): [string, string] {
  const palettes: Array<[string, string]> = [
    ["#3a4dff", "#8b3dff"],
    ["#1f8bff", "#3a4dff"],
    ["#ff6b6b", "#ff8a3d"],
    ["#5ee5b2", "#1f8bff"],
    ["#ffd54d", "#ff8a3d"],
    ["#a060ff", "#ff77ee"],
    ["#3cd870", "#1f8bff"],
    ["#ff4d6d", "#a060ff"]
  ];
  return palettes[hashCode(seed) % palettes.length];
}

export function Avatar({
  id,
  name,
  avatarUrl,
  size = 40,
  ringColor
}: {
  id: string;
  name: string;
  avatarUrl?: string | null;
  size?: number;
  ringColor?: string;
}) {
  // Track image-load failures so we can swap to the initials fallback.
  // Keyed on the avatarUrl itself so a parent passing a NEW url after
  // a previous failure gets a fresh attempt instead of being stuck on
  // the fallback.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const useImage = avatarUrl && failedUrl !== avatarUrl;

  const [a, b] = gradientFor(id || name || "x");
  const txt = initials(name);
  const fontSize = Math.max(10, Math.round(size * 0.4));

  if (useImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl as string}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailedUrl(avatarUrl as string)}
        // referrerPolicy=no-referrer helps LinkedIn / Google photo URLs
        // load — many CDNs reject cross-origin requests that include a
        // referer header pointing to a different domain.
        referrerPolicy="no-referrer"
        loading="lazy"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: ringColor ? `2px solid ${ringColor}` : undefined,
          display: "inline-block",
          // Underlying gradient peeks through during load + on partial
          // transparency, so a slow-loading photo doesn't show a blank
          // white circle.
          background: `linear-gradient(135deg, ${a}, ${b})`
        }}
      />
    );
  }

  return (
    <div
      aria-label={`Avatar for ${name}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${a}, ${b})`,
        color: "#ffffff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
        fontWeight: 700,
        fontSize,
        letterSpacing: "0.02em",
        flexShrink: 0,
        textShadow: "0 1px 1px rgba(0,0,0,0.15)",
        border: ringColor ? `2px solid ${ringColor}` : undefined,
        userSelect: "none"
      }}
    >
      {txt}
    </div>
  );
}
