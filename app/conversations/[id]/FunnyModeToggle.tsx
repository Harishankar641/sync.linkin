"use client";

import { useEffect, useState } from "react";

/**
 * Per-conversation funny-mode toggle. Lives in the conversation header
 * so users can flip it on/off without leaving the chat. When ON, the
 * twin prompt builder swaps to personality-first wiring (emojis, jokes,
 * lighter register) — still drives toward something real but in a
 * much more fun way.
 */
export function FunnyModeToggle({
  conversationId,
  initialOn = false
}: {
  conversationId: string;
  initialOn?: boolean;
}) {
  const [on, setOn] = useState(initialOn);
  const [busy, setBusy] = useState(false);

  // Fetch the current value once on mount in case the server-rendered
  // initial drifted from what the API says.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/funny-mode`
        );
        const j = await res.json();
        if (!cancelled && typeof j.funny_mode === "boolean") {
          setOn(j.funny_mode);
        }
      } catch {
        /* keep server-rendered value */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  async function toggle() {
    setBusy(true);
    const next = !on;
    setOn(next);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/funny-mode`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ funny_mode: next })
        }
      );
      if (!res.ok) {
        setOn(!next); // revert on failure
      }
    } catch {
      setOn(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={
        on
          ? "Funny mode is ON — twins lead with personality, emojis welcome"
          : "Turn on funny mode — twins get more personality-forward"
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: busy ? "wait" : "pointer",
        background: on ? "rgba(216, 59, 255, 0.12)" : "var(--panel-2)",
        color: on ? "#d83bff" : "var(--text-dim)",
        border: `1px solid ${on ? "rgba(216, 59, 255, 0.40)" : "var(--border)"}`,
        transition: "all 0.15s ease"
      }}
    >
      <span aria-hidden="true">{on ? "✦" : "⊙"}</span>
      <span>{on ? "funny" : "serious"}</span>
    </button>
  );
}
