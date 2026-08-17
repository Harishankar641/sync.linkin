"use client";

import { useState } from "react";

/**
 * Inline portfolio-URL card for /settings. Shows the canonical
 * /u/<handle> URL with copy + open buttons. If the user doesn't have a
 * handle yet (legacy accounts before the auto-handle backfill),
 * surfaces a CTA to /onboarding instead.
 */
export function PortfolioCard({
  portfolioUrl,
  displayName
}: {
  portfolioUrl: string | null;
  displayName: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!portfolioUrl) return;
    try {
      await navigator.clipboard.writeText(portfolioUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy:", portfolioUrl);
    }
  }

  if (!portfolioUrl) {
    return (
      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background: "var(--panel-2)",
          border: "1px dashed var(--border-bright)",
          fontSize: 13.5,
          color: "var(--text-dim)",
          lineHeight: 1.5
        }}
      >
        Your portfolio URL gets generated the first time you finish
        onboarding. Tap{" "}
        <a
          href="/onboarding"
          style={{
            color: "#1f8bff",
            fontWeight: 700,
            textDecoration: "underline"
          }}
        >
          edit your twin
        </a>{" "}
        and save to claim yours.
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 10,
          background: "var(--panel-2)",
          border: "1px solid var(--border)"
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            color: "var(--text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {portfolioUrl}
        </div>
        <button
          type="button"
          onClick={copy}
          className="retro-btn text-xs"
          style={{
            padding: "6px 12px",
            fontWeight: 700,
            borderColor: copied ? "#22c55e" : undefined,
            color: copied ? "#15803d" : undefined
          }}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
        <a
          href={portfolioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="retro-btn retro-btn-primary text-xs"
          style={{
            padding: "6px 12px",
            fontWeight: 700,
            textDecoration: "none"
          }}
        >
          open →
        </a>
      </div>
      <p
        style={{
          marginTop: 8,
          fontSize: 11,
          color: "var(--text-dim)"
        }}
      >
        Public to anyone with the link. Renders {displayName}&apos;s
        bio, scraped highlights, and recent twin agreements (you control
        which agreements are visible from your dashboard).
      </p>
    </div>
  );
}
