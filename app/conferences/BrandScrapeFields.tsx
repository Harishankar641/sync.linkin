"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Brand-scrape input pair for /communities/new + /conferences/new + edit.
 * Host pastes a website URL — we fire /api/scrape-room-brand, auto-fill
 * the name field, the description field, and stash logo_url / brand_color
 * into hidden fields so the server action can persist them.
 *
 * #156 — "Community/Conference custom branding via website URL"
 *
 * Wiring expects sibling form inputs (selected by name) so the same
 * `<form>` handles everything. Pass the field names of the live name +
 * description inputs in case they differ between pages.
 */
export function BrandScrapeFields({
  nameField = "name",
  descriptionField = "description",
  defaultUrl = "",
  defaultLogoUrl = "",
  defaultBrandColor = "",
  defaultOgImageUrl = ""
}: {
  nameField?: string;
  descriptionField?: string;
  defaultUrl?: string;
  defaultLogoUrl?: string;
  defaultBrandColor?: string;
  defaultOgImageUrl?: string;
}) {
  const [url, setUrl] = useState(defaultUrl);
  const [status, setStatus] = useState<"idle" | "fetching" | "ok" | "err">(
    defaultLogoUrl || defaultBrandColor ? "ok" : "idle"
  );
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState(defaultLogoUrl);
  const [brandColor, setBrandColor] = useState(defaultBrandColor);
  const [ogImageUrl, setOgImageUrl] = useState(defaultOgImageUrl);

  // Track the latest in-flight scrape so a stale response doesn't
  // clobber the latest one.
  const seqRef = useRef(0);

  const runScrape = async (raw: string) => {
    let candidate = raw.trim();
    if (!candidate) return;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = "https://" + candidate.replace(/^\/+/, "");
    }
    setStatus("fetching");
    setErrMsg(null);
    const mySeq = ++seqRef.current;
    try {
      const res = await fetch(
        `/api/scrape-room-brand?url=${encodeURIComponent(candidate)}`,
        { cache: "no-store" }
      );
      const j: any = await res.json().catch(() => ({}));
      if (seqRef.current !== mySeq) return;
      if (!res.ok || j?.error) {
        setStatus("err");
        setErrMsg(j?.error || `http_${res.status}`);
        return;
      }
      setStatus("ok");
      if (j?.logo_url) setLogoUrl(String(j.logo_url));
      if (j?.theme_color) setBrandColor(String(j.theme_color));
      if (j?.og_image_url) setOgImageUrl(String(j.og_image_url));
      // Soft-fill the sibling form inputs only if they're empty — we
      // never want to overwrite something the user has already typed.
      const form = document.activeElement
        ? (document.activeElement as HTMLElement).closest("form")
        : document.querySelector("form");
      if (form && j?.name) {
        const n = form.querySelector(
          `input[name="${nameField}"]`
        ) as HTMLInputElement | null;
        if (n && !n.value.trim()) n.value = String(j.name).slice(0, 80);
      }
      if (form && j?.blurb) {
        const d = form.querySelector(
          `[name="${descriptionField}"]`
        ) as HTMLInputElement | HTMLTextAreaElement | null;
        if (d && !("value" in d ? d.value : "").trim()) {
          d.value = String(j.blurb).slice(0, 280);
        }
      }
    } catch (e: any) {
      if (seqRef.current !== mySeq) return;
      setStatus("err");
      setErrMsg(e?.message ?? "fetch_failed");
    }
  };

  // Debounce auto-fetch when the user pastes / types a URL.
  useEffect(() => {
    if (!url.trim()) return;
    // Only fire when it looks URL-ish (has a dot, reasonable length).
    if (url.trim().length < 4 || !/\./.test(url)) return;
    const t = window.setTimeout(() => {
      runScrape(url);
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <div className="retro-panel" style={{ padding: "12px 14px" }}>
      <div className="text-sm font-semibold">Website URL (optional)</div>
      <div className="retro-dim text-xs mt-1">
        Paste your community / conference homepage and we&apos;ll auto-fill
        the logo, brand color, name, and one-liner.
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input
          name="website_url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://devcon.org"
          className="retro-input flex-1"
        />
        <button
          type="button"
          onClick={() => runScrape(url)}
          disabled={status === "fetching" || !url.trim()}
          className="retro-btn text-xs"
          style={{ minWidth: 78 }}
        >
          {status === "fetching" ? "Reading…" : "Auto-fill"}
        </button>
      </div>

      {/* Hidden fields persisted by the server action — kept in sync with
          local state so the form submission carries the scraped values. */}
      <input type="hidden" name="logo_url" value={logoUrl} />
      <input type="hidden" name="brand_color" value={brandColor} />
      <input type="hidden" name="og_image_url" value={ogImageUrl} />

      {(logoUrl || brandColor) && (
        <div
          className="mt-3 flex items-center gap-3 text-xs"
          style={{ color: "var(--text-dim)" }}
        >
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="logo preview"
              width={32}
              height={32}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                objectFit: "cover",
                border: "1px solid var(--border)"
              }}
            />
          )}
          {brandColor && (
            <span className="flex items-center gap-1">
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: brandColor,
                  border: "1px solid var(--border)"
                }}
              />
              <span style={{ fontFamily: "monospace" }}>{brandColor}</span>
            </span>
          )}
          {status === "ok" && (
            <span style={{ color: "var(--green, #6cc24a)" }}>· detected</span>
          )}
        </div>
      )}
      {status === "err" && errMsg && (
        <div
          className="mt-2 text-xs"
          style={{ color: "var(--red, #d44)" }}
        >
          Couldn&apos;t read that site ({errMsg}). You can still type the
          name + description manually.
        </div>
      )}
    </div>
  );
}
