"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * HostBriefEditor (#15) — inline editor for the host's brief on a
 * community/conference page. Only rendered for the room owner.
 *
 * Flow: read view (brief + ✎ edit) → edit view (textarea + Save) →
 * scope confirm ("Edit globally or just here?") → POST → refresh.
 */
export function HostBriefEditor({
  slug,
  initialBrief
}: {
  slug: string;
  initialBrief: string;
}) {
  const router = useRouter();
  const [brief, setBrief] = useState(initialBrief);
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const [draft, setDraft] = useState(initialBrief);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(scope: "global" | "local") {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/communities/${slug}/host-brief`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: draft.trim(), scope })
      });
      const j = await res.json().catch(() => ({}) as any);
      if (!res.ok || j?.error) {
        throw new Error(j?.detail || j?.error || "Save failed.");
      }
      setBrief(draft.trim());
      setMode("view");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "view") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: brief ? "var(--text-dim)" : "var(--text-dim)",
            fontStyle: brief ? "normal" : "italic"
          }}
        >
          {brief || "Add a short brief about you as the host…"}
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft(brief);
            setMode("edit");
          }}
          style={{
            alignSelf: "flex-start",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "var(--amber-bright)",
            fontSize: 11,
            fontWeight: 800
          }}
        >
          ✎ edit your brief
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        autoFocus
        disabled={mode === "confirm" || busy}
        placeholder="A short brief about you as the host — what you're building, who you want to meet."
        className="retro-input"
        style={{ fontSize: 13, lineHeight: 1.5, resize: "vertical" }}
      />
      {err && (
        <div style={{ fontSize: 11, color: "var(--red, #ef4444)" }}>{err}</div>
      )}

      {mode === "edit" ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={!draft.trim() || busy}
            onClick={() => setMode("confirm")}
            className="retro-btn retro-btn-primary"
            style={{ fontSize: 12, padding: "6px 12px" }}
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode("view");
              setErr(null);
            }}
            className="retro-btn"
            style={{ fontSize: 12, padding: "6px 12px" }}
          >
            Cancel
          </button>
        </div>
      ) : (
        // Scope confirm — "Edit globally or just here?"
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
            Edit globally or just here?
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => save("global")}
              className="retro-btn retro-btn-primary"
              style={{ fontSize: 12, padding: "6px 12px" }}
              title="Updates your brief everywhere on SyncedIn"
            >
              {busy ? "Saving…" : "Everywhere"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => save("local")}
              className="retro-btn"
              style={{ fontSize: 12, padding: "6px 12px" }}
              title="Only changes the brief shown on this room's page"
            >
              {busy ? "Saving…" : "Just this room"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("edit")}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-dim)",
                fontSize: 11,
                fontWeight: 700
              }}
            >
              ← back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
