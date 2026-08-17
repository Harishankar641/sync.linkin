"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * OgPreviewControl (owner-only) — preview the social/share image and pick
 * a template. Jack: a banner that already has its own text collides with
 * the overlay, so let hosts keep the banner but choose a cleaner social
 * image template.
 *
 * Templates:
 *   - banner_text  : banner + name + "Join · Sync with the network"
 *   - banner_clean : banner only, no big overlay (banner already has text)
 *   - card         : ignore banner, clean branded card
 */
const TEMPLATES: { key: string; label: string; hint: string }[] = [
  { key: "banner_text", label: "Banner + text", hint: "Overlay name & CTA on your banner" },
  { key: "banner_clean", label: "Banner only", hint: "No overlay — best if your banner has its own text" },
  { key: "card", label: "Clean card", hint: "Branded gradient card, ignores the banner" }
];

export function OgPreviewControl({
  slug,
  initialTemplate,
  hasBanner
}: {
  slug: string;
  initialTemplate: string;
  hasBanner: boolean;
}) {
  const router = useRouter();
  const [tpl, setTpl] = useState(
    initialTemplate || (hasBanner ? "banner_text" : "card")
  );
  const [bust, setBust] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  async function choose(key: string) {
    if (busy || key === tpl) {
      setTpl(key);
      return;
    }
    setBusy(true);
    setTpl(key);
    try {
      await fetch(`/api/communities/${slug}/og-template`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template: key })
      });
      // Bust the browser/image cache so the preview re-renders.
      setBust(Date.now());
      router.refresh();
    } catch {
      /* best-effort */
    } finally {
      setBusy(false);
    }
  }

  const previewSrc = `/conferences/${slug}/opengraph-image?t=${tpl}&v=${bust}`;

  return (
    <div style={{ maxWidth: 520 }}>
      <div
        className="retro-label"
        style={{ color: "var(--amber-bright)", marginBottom: 8 }}
      >
        social / share image
      </div>
      <div
        style={{
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid var(--border)",
          aspectRatio: "1200 / 630",
          background: "var(--panel-2)"
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={previewSrc}
          src={previewSrc}
          alt="Social share preview"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
        This is how your link looks when shared. Pick a template — if your
        banner already has text, &quot;Banner only&quot; keeps it clean.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {TEMPLATES.map((t) => {
          const active = t.key === tpl;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => choose(t.key)}
              disabled={busy}
              title={t.hint}
              className={active ? "retro-btn retro-btn-primary text-xs" : "retro-btn text-xs"}
              style={{ padding: "6px 12px", fontWeight: 700 }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
