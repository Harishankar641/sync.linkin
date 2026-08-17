"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * GroupLimitControl — owner-only. Sets an optional member cap on the
 * room. The cap drives the "pairings at the limit" projection shown to
 * everyone (Jack: a limit "gives some pressure for people to join").
 */
export function GroupLimitControl({
  slug,
  initialLimit
}: {
  slug: string;
  initialLimit: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialLimit ? String(initialLimit) : "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await fetch(`/api/communities/${slug}/limit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: value.trim() === "" ? null : Number(value) })
      });
      setOpen(false);
      router.refresh();
    } catch {
      /* best-effort */
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--amber-bright)",
          fontSize: 11,
          fontWeight: 800
        }}
      >
        {initialLimit ? `✎ edit group limit (${initialLimit})` : "+ set a group limit"}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. 50"
        className="retro-input"
        style={{ width: 90, fontSize: 13, padding: "4px 8px" }}
      />
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="retro-btn retro-btn-primary"
        style={{ fontSize: 11, padding: "5px 10px" }}
      >
        {busy ? "Saving…" : "Save limit"}
      </button>
      <button
        type="button"
        onClick={() => {
          setValue("");
          save();
        }}
        disabled={busy}
        className="retro-btn"
        style={{ fontSize: 11, padding: "5px 10px" }}
      >
        No limit
      </button>
    </div>
  );
}
