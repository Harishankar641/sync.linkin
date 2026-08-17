"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Per-conversation goal override input. Sits in the conversation right
 * rail on desktop (above the proposed-destination panel). Lets the user
 * pivot what their twin is pitching for THIS specific recipient without
 * rewriting the head goal in /onboarding.
 *
 * UX:
 *   - Collapsed: shows "⊙ set goal for this convo" link.
 *   - Expanded: small textarea + save/clear buttons.
 *   - Persists to /api/conversations/<id>/goal (POST), reads on mount.
 *   - Debounced auto-save after 600ms of idle typing so the user can
 *     close the panel without thinking about a save button.
 *
 * Intentionally desktop-only by default — mobile real estate is too
 * precious to spend on this surface. We render under a `hidden lg:block`
 * wrapper inline at the call site.
 */
export function PerConversationGoal({
  conversationId,
  otherName
}: {
  conversationId: string;
  otherName: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/conversations/${conversationId}/goal`
        );
        const j = await r.json();
        if (cancelled) return;
        const g = (j?.goal_override as string | null) || "";
        setValue(g);
        // Auto-open the panel if a goal is already set — the user
        // should see what's active.
        if (g.trim().length > 0) setOpen(true);
      } catch {
        /* leave empty */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  function persist(next: string) {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/conversations/${conversationId}/goal`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ goal: next })
        });
        setSavedAt(Date.now());
      } catch {
        /* non-fatal */
      } finally {
        setSaving(false);
      }
    }, 600);
  }

  const firstName = otherName.split(/\s+/)[0] || otherName;

  if (!loaded) return null;

  return (
    <div
      className="block mb-3"
      style={{
        padding: "10px 12px",
        background: "var(--panel-2)",
        border: "1px dashed var(--border-bright)",
        borderRadius: 10
      }}
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="retro-dim text-xs"
          style={{
            background: "transparent",
            border: 0,
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
            width: "100%"
          }}
        >
          ⊙ set a specific goal for this conversation with {firstName} →
        </button>
      ) : (
        <div>
          <div
            className="retro-label"
            style={{
              color: "var(--amber-bright)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 8
            }}
          >
            <span>goal for this convo with {firstName}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close goal panel"
              title="Close"
              style={{
                // Bumped from a 10px text glyph with no padding (mobile
                // tap-target was ~14px, miss-tap city) to a proper 28px
                // hit zone with visible border.
                width: 28,
                height: 28,
                borderRadius: 14,
                background: "transparent",
                border: "1px solid var(--border)",
                cursor: "pointer",
                padding: 0,
                fontSize: 14,
                lineHeight: 1,
                color: "var(--text-dim)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              ✕
            </button>
          </div>
          <textarea
            value={value}
            onChange={(e) => {
              const next = e.target.value;
              setValue(next);
              persist(next);
            }}
            rows={2}
            placeholder="e.g. raise a $2M seed · find a CTO · land a podcast slot"
            className="retro-input mt-2 text-sm"
            style={{ minHeight: 56 }}
          />
          <div
            className="text-xs mt-1 flex items-center justify-between"
            style={{ color: "var(--text-dim)" }}
          >
            <span>
              Layered on top of your head goal. Your twin uses this here
              only.
            </span>
            <span>
              {saving
                ? "saving…"
                : savedAt
                  ? "saved ✓"
                  : value.trim().length > 0
                    ? `${value.trim().length} chars`
                    : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
