"use client";

import { useEffect, useState } from "react";

/**
 * Background-analysis "dive" panel — the underlying coordination layer
 * that Jack's new architecture surfaces above the visible message
 * stack. Renders shared themes / complementary asks / hidden
 * synergies / friction / recommended destination so the user can see
 * the WHY behind the surface chat (which becomes a shorter pragmatic
 * presentation of this analysis).
 *
 * Auto-generates on mount if no dive exists yet for this conversation.
 * Cached server-side on conversations.context_dive jsonb so it only
 * runs once per pair unless the user clicks "↻ regenerate."
 */
type Dive = {
  headline?: string;
  shared_themes?: string[];
  complementary_asks?: Array<{
    ask_from: string;
    offer_from: string;
    why: string;
  }>;
  frictions?: string[];
  hidden_synergies?: string[];
  recommended_destination?: string;
  generated_at?: string;
};

export function ContextDivePanel({ conversationId }: { conversationId: string }) {
  const [dive, setDive] = useState<Dive | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Default expanded — Jack: the dive IS the underlying knowledge,
  // hiding it defeats the architecture. User can collapse if they
  // want pure-chat mode.
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/conversations/${conversationId}/context-dive`
        );
        const j = await r.json();
        if (cancelled) return;
        if (j.dive) {
          setDive(j.dive as Dive);
          setLoading(false);
        } else {
          // No dive yet — kick off generation on first mount.
          await generate(false);
        }
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message || "Couldn't load the dive.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function generate(force: boolean) {
    setErr(null);
    if (force) setRegenerating(true);
    else setLoading(true);
    try {
      const r = await fetch(
        `/api/conversations/${conversationId}/context-dive${force ? "?force=1" : ""}`,
        { method: "POST" }
      );
      const j = await r.json();
      if (!r.ok) {
        setErr(j.detail || j.error || `HTTP ${r.status}`);
      } else {
        setDive(j.dive as Dive);
      }
    } catch (e: any) {
      setErr(e?.message || "Couldn't run the dive.");
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }

  if (loading && !dive) {
    return (
      <div
        style={{
          marginBottom: 12,
          padding: "10px 14px",
          borderRadius: 12,
          background:
            "linear-gradient(135deg, rgba(31, 139, 255, 0.06) 0%, rgba(216, 59, 255, 0.06) 100%)",
          border: "1px solid rgba(31, 139, 255, 0.22)",
          fontSize: 12,
          color: "var(--text-dim)",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "#1f8bff",
            animation: "syncedin-dive-pulse 1.2s ease-in-out infinite"
          }}
        />
        <span>
          diving into both twins&apos; full context to find the underlying
          win-win…
        </span>
        <style>{`
          @keyframes syncedin-dive-pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  if (err && !dive) {
    return (
      <div
        style={{
          marginBottom: 12,
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid rgba(239, 68, 68, 0.32)",
          background: "rgba(239, 68, 68, 0.06)",
          fontSize: 12,
          color: "var(--text-dim)"
        }}
      >
        Couldn&apos;t run the context dive: {err}
        <button
          type="button"
          onClick={() => generate(true)}
          className="retro-btn"
          style={{ marginLeft: 10, fontSize: 11, padding: "4px 10px" }}
        >
          retry
        </button>
      </div>
    );
  }

  if (!dive) return null;

  return (
    <section
      style={{
        marginBottom: 14,
        borderRadius: 14,
        background:
          "linear-gradient(135deg, rgba(31, 139, 255, 0.06) 0%, rgba(216, 59, 255, 0.06) 100%)",
        border: "1px solid rgba(31, 139, 255, 0.28)"
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "10px 14px",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 10
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#1f8bff",
            background: "rgba(31, 139, 255, 0.14)",
            padding: "3px 8px",
            borderRadius: 6
          }}
        >
          ✦ underlying alignment
        </span>
        {dive.headline && (
          <span
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text)",
              lineHeight: 1.35
            }}
          >
            {dive.headline}
          </span>
        )}
        <span
          aria-hidden="true"
          style={{
            fontSize: 11,
            color: "var(--text-dim)",
            fontWeight: 700
          }}
        >
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          {dive.recommended_destination && (
            <Block
              label="recommended destination"
              accent="#10b981"
              body={dive.recommended_destination}
            />
          )}
          {dive.shared_themes && dive.shared_themes.length > 0 && (
            <Block
              label="shared themes"
              accent="#1f8bff"
              items={dive.shared_themes}
            />
          )}
          {dive.complementary_asks && dive.complementary_asks.length > 0 && (
            <Block
              label="complementary asks ↔ offers"
              accent="#6b2dc9"
              items={dive.complementary_asks.map(
                (c) =>
                  `${c.ask_from} needs ↔ ${c.offer_from} brings — ${c.why}`
              )}
            />
          )}
          {dive.hidden_synergies && dive.hidden_synergies.length > 0 && (
            <Block
              label="non-obvious synergies"
              accent="#d83bff"
              items={dive.hidden_synergies}
            />
          )}
          {dive.frictions && dive.frictions.length > 0 && (
            <Block
              label="frictions to watch"
              accent="#f59e0b"
              items={dive.frictions}
            />
          )}

          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 10,
              color: "var(--text-dim)"
            }}
          >
            <button
              type="button"
              onClick={() => generate(true)}
              disabled={regenerating}
              className="retro-btn"
              style={{
                fontSize: 10,
                padding: "4px 10px",
                borderRadius: 999
              }}
            >
              {regenerating ? "re-diving…" : "↻ re-dive"}
            </button>
            <span style={{ flex: 1 }} />
            <span>
              this analysis runs in the background; the chat below is the
              short pragmatic version
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function Block({
  label,
  accent,
  body,
  items
}: {
  label: string;
  accent: string;
  body?: string;
  items?: string[];
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 4
        }}
      >
        {label}
      </div>
      {body && (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--text)"
          }}
        >
          {body}
        </div>
      )}
      {items && (
        <ul
          style={{
            margin: 0,
            paddingLeft: 16,
            fontSize: 12.5,
            lineHeight: 1.5,
            color: "var(--text)"
          }}
        >
          {items.map((it, i) => (
            <li key={i} style={{ marginTop: i === 0 ? 0 : 3 }}>
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
