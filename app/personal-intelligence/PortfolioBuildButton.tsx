"use client";

import { useState } from "react";

/**
 * One-click portfolio builder. Hits POST /api/personal-intelligence/build-portfolio
 * which assigns a handle (idempotent) and returns the public URL. Then
 * opens the portfolio in a new tab.
 *
 * Replaces the previous "claim handle in /settings first" loop Jack
 * flagged: "I tapped Build My Portfolio One Click and it took me to
 * settings rather than building the portfolio and showing it to me."
 */
export function PortfolioBuildButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  async function build() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/personal-intelligence/build-portfolio", {
        method: "POST"
      });
      const j = await res.json();
      if (!res.ok || !j.url) {
        throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      }
      // Open immediately so the user SEES the page (Jack's exact ask:
      // "and showing it to me"). Hit window.open synchronously inside
      // the click handler so iOS Safari doesn't block it.
      window.open(j.url, "_blank", "noopener,noreferrer");
      // Also refresh the page so the PI card flips to the "view your
      // portfolio" state.
      window.location.reload();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "flex-start"
      }}
    >
      <button
        type="button"
        onClick={build}
        disabled={busy}
        className="retro-btn retro-btn-primary"
        style={{
          fontSize: 12,
          padding: "8px 14px",
          opacity: busy ? 0.6 : 1
        }}
      >
        {busy ? "Building…" : "✦ Build my portfolio"}
      </button>
      {err && (
        <p style={{ fontSize: 11, color: "#ef4444", margin: 0 }}>
          {err}
        </p>
      )}
    </div>
  );
}
