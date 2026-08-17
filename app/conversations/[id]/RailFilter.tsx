"use client";

import { useRef, useState } from "react";

/**
 * RailFilter (#20) — the sort control next to "ALL" in the conversation
 * rail. The rail rows are server-rendered (each carries data-ts +
 * data-score). On change this reorders them client-side via CSS `order`
 * so we don't need to round-trip the server or refactor the rail into a
 * client component.
 *
 * Modes:
 *   - recent  → most recent activity first (the server default)
 *   - outcome → highest outcome score first
 */
type Mode = "recent" | "outcome";

export function RailFilter() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("recent");
  const ref = useRef<HTMLDivElement | null>(null);

  function apply(next: Mode) {
    setMode(next);
    setOpen(false);
    const aside = ref.current?.closest("aside");
    if (!aside) return;
    const rows = Array.from(
      aside.querySelectorAll<HTMLElement>("[data-rail-row]")
    );
    const keyed = rows.map((el) => ({
      el,
      ts: Number(el.dataset.ts || "0"),
      score: Number(el.dataset.score || "0")
    }));
    keyed.sort((a, b) =>
      next === "outcome" ? b.score - a.score : b.ts - a.ts
    );
    // Controls (the "all" link + this filter) keep order 0; rows start at
    // 1 so they always sit below the controls.
    keyed.forEach((k, i) => {
      k.el.style.order = String(i + 1);
    });
  }

  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Sort conversations"
        title="Sort conversations"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          padding: "5px 4px",
          borderRadius: 8,
          background: "var(--panel-2)",
          border: "1px solid var(--border)",
          color: "var(--text-dim)",
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: "pointer"
        }}
      >
        ⊿ {mode === "outcome" ? "outcome" : "recent"}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: "var(--panel-solid)",
            border: "1px solid var(--border-bright)",
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "0 10px 30px -12px rgba(0,0,0,0.4)"
          }}
        >
          {([
            { k: "recent", label: "Recent" },
            { k: "outcome", label: "Top outcome" }
          ] as { k: Mode; label: string }[]).map((o) => (
            <button
              key={o.k}
              type="button"
              onClick={() => apply(o.k)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "7px 9px",
                background:
                  mode === o.k ? "var(--panel-2)" : "transparent",
                border: "none",
                color: "var(--text)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
