"use client";

import { useState } from "react";

type ScrapeResult = {
  ok?: boolean;
  source_url?: string;
  name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  links?: Array<{ label: string; url: string; intent: string }>;
  error?: string;
  detail?: string;
};

// Pre-signup hand-off: we stash the scrape in sessionStorage so the
// onboarding flow can pick it up after the user signs in via Google /
// magic link. Keyed under a single stable key — last import wins.
const HANDOFF_KEY = "syncedin_linkme_handoff_v1";

/**
 * Client island for /for/linkme. Single input → fires scrape API →
 * renders a preview card the user can confirm before signing up.
 * Mobile-first, just like the DM chat.
 */
export function LinkmeImporter() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/linkme-import?url=${encodeURIComponent(url.trim())}`,
        { cache: "no-store" }
      );
      const j: ScrapeResult = await res.json();
      if (!res.ok || j.error) {
        setErr(j.detail || j.error || "Couldn't import that URL.");
        return;
      }
      setResult(j);
      // Stash for the post-signup wire-up.
      try {
        window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(j));
      } catch {
        /* private mode — non-fatal */
      }
    } catch (e: any) {
      setErr(e?.message ?? "Network error.");
    } finally {
      setBusy(false);
    }
  }

  function continueToSignup() {
    // Carry a flag through the auth flow so the post-signup hook knows
    // to apply the cached scrape (the actual data lives in
    // sessionStorage under HANDOFF_KEY, set above). Auth lives at
    // /login (handles both signup + signin via magic link / Google).
    // `next` lands the user on /onboarding after auth completes.
    window.location.href =
      "/login?from=linkme&next=" +
      encodeURIComponent("/onboarding?from=linkme");
  }

  if (result?.ok) {
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid #e8e6f5",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 12px 36px -16px rgba(31, 89, 255, 0.15)"
        }}
      >
        {/* PROFILE PREVIEW */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 12
          }}
        >
          {result.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.avatar_url}
              alt={result.name ?? "you"}
              width={56}
              height={56}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                objectFit: "cover",
                border: "2px solid #fff",
                boxShadow: "0 0 0 1px #e8e6f5"
              }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background:
                  "linear-gradient(135deg, #2358ff 0%, #6b2dc9 100%)"
              }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              {result.name ?? "(no name found)"}
            </div>
            {result.bio && (
              <div
                style={{
                  fontSize: 13,
                  color: "#4a5066",
                  lineHeight: 1.4,
                  marginTop: 2
                }}
              >
                {result.bio.slice(0, 160)}
              </div>
            )}
          </div>
        </div>

        {/* LINKS PULLED */}
        {result.links && result.links.length > 0 && (
          <div
            style={{
              borderTop: "1px dashed #e8e6f5",
              paddingTop: 12,
              marginTop: 6
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#6e768c",
                marginBottom: 8
              }}
            >
              {result.links.length} link{result.links.length === 1 ? "" : "s"}{" "}
              your twin will route visitors to
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 240,
                overflowY: "auto"
              }}
            >
              {result.links.slice(0, 12).map((l, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "#f7f5ff",
                    fontSize: 13
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#6b2dc9",
                      padding: "2px 6px",
                      borderRadius: 999,
                      background: "rgba(107,45,201,0.1)",
                      flexShrink: 0
                    }}
                  >
                    {l.intent}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {l.label}
                  </span>
                </div>
              ))}
              {result.links.length > 12 && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#6e768c",
                    paddingLeft: 8
                  }}
                >
                  + {result.links.length - 12} more
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={continueToSignup}
          style={{
            marginTop: 18,
            width: "100%",
            padding: "14px 16px",
            borderRadius: 12,
            border: "none",
            background:
              "linear-gradient(135deg, #2358ff 0%, #6b2dc9 100%)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 15,
            cursor: "pointer"
          }}
        >
          Continue → build my AI twin
        </button>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setUrl("");
          }}
          style={{
            marginTop: 8,
            width: "100%",
            padding: "10px 16px",
            borderRadius: 12,
            border: "1px solid #e8e6f5",
            background: "#fff",
            color: "#4a5066",
            fontSize: 13,
            cursor: "pointer"
          }}
        >
          ← Try a different URL
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "stretch"
        }}
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void run();
            }
          }}
          placeholder="link.me/yourname"
          style={{
            flex: 1,
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #d9d6ec",
            background: "#fff",
            color: "#0e1322",
            fontSize: 16,
            outline: "none",
            minWidth: 0
          }}
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || !url.trim()}
          style={{
            padding: "0 18px",
            borderRadius: 12,
            border: "none",
            background:
              busy || !url.trim()
                ? "#d9d6ec"
                : "linear-gradient(135deg, #2358ff 0%, #6b2dc9 100%)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 14,
            cursor: busy ? "wait" : "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          {busy ? "Reading…" : "Generate"}
        </button>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#6e768c",
          marginTop: 8,
          lineHeight: 1.5
        }}
      >
        Works with link.me/yourname, yourname.link.me, and linktr.ee URLs.
        Your page stays public; we just read what visitors already see.
      </div>
      {err && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: "#fff0ee",
            border: "1px solid #ffd6d1",
            color: "#b3261e",
            fontSize: 13,
            lineHeight: 1.5
          }}
        >
          {err}
        </div>
      )}
    </div>
  );
}
