"use client";

import { useState } from "react";

/**
 * Owner-only floating "Regenerate" button. Calls /api/portfolio-generate
 * with force=true, then reloads the page so the new sections render.
 *
 * Editable prompt — Jack: "on the regenerate for portfolio page lets
 * expose the prompt and let someone edit." Click the button once to
 * pop open a textarea where the owner can add custom direction
 * ("make it darker", "lead with my Brazil chapter", "no projects
 * section"). The text is appended to the system prompt as
 * "EXTRA DIRECTION FROM THE USER" so the model weights it heavily.
 *
 * Hidden via parent guard (isOwner) — never shown to other viewers.
 */
export function RegenerateButton({ hasExisting }: { hasExisting: boolean }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState("");
  const [err, setErr] = useState<string>("");

  async function go() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/portfolio-generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          force: true,
          extra_instructions: extra.trim() || undefined
        })
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      }
      setTimeout(() => window.location.reload(), 400);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 22,
        right: 22,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        maxWidth: "calc(100vw - 44px)"
      }}
    >
      {open && (
        // Editable prompt strip — only shown after first click.
        <div
          style={{
            width: 380,
            maxWidth: "calc(100vw - 44px)",
            background: "var(--panel-solid)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 14,
            boxShadow: "0 18px 38px -12px rgba(15, 23, 42, 0.25)",
            color: "var(--text)"
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#6b2dc9",
              marginBottom: 6
            }}
          >
            Tell your twin's AI what you want
          </div>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              color: "var(--text-dim)",
              lineHeight: 1.5
            }}
          >
            Optional. Add direction — &ldquo;dark mode&rdquo;, &ldquo;lead with
            my Brazil chapter&rdquo;, &ldquo;drop the values section&rdquo;.
            We&apos;ll send your twin context PLUS this note.
          </p>
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value.slice(0, 1200))}
            rows={4}
            placeholder="(optional) Direction for the redesign…"
            style={{
              width: "100%",
              padding: 10,
              fontSize: 13,
              lineHeight: 1.4,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              resize: "vertical"
            }}
          />
          <div
            style={{
              marginTop: 6,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--text-dim)"
            }}
          >
            <span>{extra.length}/1200</span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setExtra("");
              }}
              style={{
                background: "transparent",
                border: 0,
                color: "var(--text-dim)",
                cursor: "pointer",
                fontSize: 11
              }}
            >
              cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={busy}
            style={{
              padding: "12px 14px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--panel-solid)",
              color: "var(--text)",
              cursor: "pointer"
            }}
            title="Add custom direction before regenerating."
          >
            ✎ edit prompt
          </button>
        )}
        <button
          type="button"
          onClick={go}
          disabled={busy}
          style={{
            padding: "12px 18px",
            fontSize: 13,
            fontWeight: 800,
            borderRadius: 999,
            border: "none",
            color: "#fff",
            background:
              "linear-gradient(135deg, #1f59ff 0%, #6b2dc9 100%)",
            boxShadow: "0 14px 28px -10px rgba(31, 89, 255, 0.55)",
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.85 : 1,
            letterSpacing: "0.02em"
          }}
          title="Re-runs the AI over your full twin context to redesign this page."
        >
          {busy
            ? "✦ regenerating…"
            : hasExisting
              ? "✦ regenerate site"
              : "✦ generate my site"}
        </button>
      </div>
      {err && (
        <span style={{ fontSize: 11, color: "#ef4444" }}>{err}</span>
      )}
    </div>
  );
}
