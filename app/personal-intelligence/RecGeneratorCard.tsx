"use client";

import { useEffect, useState } from "react";

/**
 * Real working recommendation generator card — used for Movies + Books
 * on /personal-intelligence. Hits /api/personal-intelligence/recs with
 * the user's full twin context and returns 5 personalized picks with
 * a per-item "why this fits you" note.
 *
 * Replaces the "Shipping soon" placeholder for these cards. Demonstrates
 * the actual generation pipeline that future cards (merch, song, life
 * path, business projection) will use the same shape.
 */
type Item = { title: string; year: string; why: string };
// Rating values:
//   1 = "loved it" — strongest positive signal, recs that share traits
//       with this one get heavily weighted up
//   0 = "haven't rated" (default)
//  -1 = "didn't like" — used as a negative signal to avoid similar
//       recs in future generations
type Rating = 1 | 0 | -1;

/** Local storage key per generator so the persisted list survives reloads. */
function storageKey(kind: string): string {
  return `syncedin.pi.recs.${kind}`;
}

function loadStored(kind: string): {
  items: Item[];
  ratings: Record<string, Rating>;
} {
  if (typeof window === "undefined") return { items: [], ratings: {} };
  try {
    const raw = window.localStorage.getItem(storageKey(kind));
    if (!raw) return { items: [], ratings: {} };
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      ratings:
        parsed.ratings && typeof parsed.ratings === "object"
          ? parsed.ratings
          : {}
    };
  } catch {
    return { items: [], ratings: {} };
  }
}

function saveStored(
  kind: string,
  items: Item[],
  ratings: Record<string, Rating>
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(kind),
      JSON.stringify({ items, ratings })
    );
  } catch {
    /* quota / private mode — non-fatal */
  }
}

export function RecGeneratorCard({
  kind,
  icon,
  eyebrow,
  title,
  blurb,
  accent
}: {
  kind: "movies" | "books" | "shows" | "albums" | "podcasts";
  icon: string;
  eyebrow: string;
  title: string;
  blurb: string;
  accent: string;
}) {
  // Items accumulate across generations (Jack: "let me generate more
  // recommendations and never delete them"). Rated items provide
  // positive / negative signal to the next generation.
  const [items, setItems] = useState<Item[]>([]);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [hydrated, setHydrated] = useState(false);
  const [why, setWhy] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  // Hydrate from localStorage on mount so the rec list survives reloads.
  useEffect(() => {
    const stored = loadStored(kind);
    setItems(stored.items);
    setRatings(stored.ratings);
    setHydrated(true);
  }, [kind]);

  // Persist on every change (post-hydration so the empty initial state
  // doesn't blow away saved items).
  useEffect(() => {
    if (!hydrated) return;
    saveStored(kind, items, ratings);
  }, [hydrated, kind, items, ratings]);

  function itemKey(it: Item): string {
    return `${it.title}::${it.year}`.toLowerCase();
  }

  async function generate() {
    setBusy(true);
    setErr("");
    try {
      const loved = items.filter((it) => ratings[itemKey(it)] === 1);
      const disliked = items.filter((it) => ratings[itemKey(it)] === -1);
      const res = await fetch("/api/personal-intelligence/recs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          why_loved: why.trim() || undefined,
          // Tell the server what NOT to recommend again (already in the list)
          // and what the user has rated up / down so it can lean into / away
          // from those signals.
          already_recommended: items.map((it) => `${it.title} (${it.year})`),
          loved: loved.map((it) => `${it.title} (${it.year})`),
          disliked: disliked.map((it) => `${it.title} (${it.year})`)
        })
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      }
      const next: Item[] = j.items ?? [];
      // Append, dedupe by title+year, oldest first stays first.
      setItems((prev) => {
        const seen = new Set(prev.map((it) => itemKey(it)));
        const additions = next.filter((it) => !seen.has(itemKey(it)));
        return [...prev, ...additions];
      });
    } catch (e: any) {
      setErr(
        e?.message ||
          "Couldn't generate. Make sure your twin has goals + bio set up."
      );
    } finally {
      setBusy(false);
    }
  }

  function rate(it: Item, value: Rating) {
    const key = itemKey(it);
    setRatings((prev) => {
      // Toggle: clicking the same rating again clears it.
      const next = { ...prev };
      if (prev[key] === value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  return (
    <article
      className="pi-card pi-card-live"
      style={{ position: "relative" }}
    >
      <style>{`
        .pi-card-live {
          padding: 18px;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--panel-solid);
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 200px;
        }
        .pi-card-live .icon { font-size: 28px; line-height: 1; }
        .pi-card-live .eyebrow {
          font-size: 10px; font-weight: 800; letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .pi-card-live h3 {
          font-size: 16px; font-weight: 800; letter-spacing: -0.005em;
          margin: 0; line-height: 1.25;
        }
        .pi-card-live p.blurb {
          font-size: 13px; line-height: 1.55; color: var(--text-dim); margin: 0;
        }
        .pi-gen-btn {
          margin-top: 10px;
          padding: 9px 14px;
          font-size: 13px;
          font-weight: 700;
          border-radius: 10px;
          background: var(--text);
          color: var(--bg);
          border: 0;
          cursor: pointer;
          align-self: flex-start;
        }
        .pi-gen-btn:disabled { opacity: 0.6; cursor: wait; }
        .pi-why-toggle {
          background: transparent;
          border: 0;
          color: var(--text-dim);
          font-size: 11px;
          text-decoration: underline;
          padding: 0;
          margin-top: 6px;
          cursor: pointer;
          align-self: flex-start;
        }
        .pi-rec-list {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pi-rec {
          padding: 10px 12px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 10px;
        }
        .pi-rec .title-row {
          display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
        }
        .pi-rec .t { font-weight: 700; font-size: 13.5px; }
        .pi-rec .yr { font-size: 11px; color: var(--text-dim); }
        .pi-rec .why {
          margin-top: 4px;
          font-size: 12px;
          color: var(--text-dim);
          line-height: 1.5;
        }
      `}</style>

      <span className="icon" aria-hidden="true">{icon}</span>
      <span className="eyebrow" style={{ color: accent }}>{eyebrow}</span>
      <h3>{title}</h3>
      <p className="blurb">{blurb}</p>

      {items.length === 0 && (
        <>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="pi-gen-btn"
          >
            {busy ? "recommending…" : `✦ recommend ${kind} for me`}
          </button>
          <button
            type="button"
            onClick={() => setWhyOpen((v) => !v)}
            className="pi-why-toggle"
          >
            {whyOpen ? "hide context" : "add context: tell us one you loved"}
          </button>
          {whyOpen && (
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value.slice(0, 800))}
              rows={3}
              placeholder={`e.g. "Loved Severance because the corporate-existential dread hit way too close to home" — the more specific, the better the picks.`}
              className="retro-input"
              style={{
                marginTop: 6,
                fontSize: 13,
                padding: 8,
                minHeight: 72,
                width: "100%"
              }}
            />
          )}
        </>
      )}

      {err && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444" }}>
          {err}
        </div>
      )}

      {items.length > 0 && (
        <>
          <div
            className="pi-rec-list"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 10
            }}
          >
            {items.map((it) => {
              const key = itemKey(it);
              const r = ratings[key] ?? 0;
              return (
                <div
                  key={key}
                  className="pi-rec"
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background: "var(--panel-2)",
                    border:
                      r === 1
                        ? "1px solid rgba(34, 197, 94, 0.5)"
                        : r === -1
                          ? "1px solid rgba(239, 68, 68, 0.45)"
                          : "1px solid var(--border)"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 8,
                      flexWrap: "wrap"
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span
                        style={{ fontWeight: 700, fontSize: 13.5 }}
                      >
                        {it.title}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-dim)",
                          marginLeft: 6
                        }}
                      >
                        {it.year}
                      </span>
                    </div>
                    {/* Rating buttons. Click toggles. Loved = teaches
                        the next generation to lean into similar picks;
                        disliked = teaches it to avoid the trait. */}
                    <div
                      style={{ display: "inline-flex", gap: 4, flexShrink: 0 }}
                    >
                      <button
                        type="button"
                        onClick={() => rate(it, 1)}
                        title={
                          r === 1
                            ? "Loved — future recs will lean into this"
                            : "Mark as loved"
                        }
                        style={{
                          width: 28,
                          height: 24,
                          fontSize: 13,
                          border:
                            r === 1
                              ? "1px solid #22c55e"
                              : "1px solid var(--border)",
                          background:
                            r === 1
                              ? "rgba(34, 197, 94, 0.15)"
                              : "transparent",
                          borderRadius: 6,
                          cursor: "pointer",
                          color: r === 1 ? "#15803d" : "var(--text-dim)"
                        }}
                      >
                        ❤
                      </button>
                      <button
                        type="button"
                        onClick={() => rate(it, -1)}
                        title={
                          r === -1
                            ? "Not for me — future recs will steer away"
                            : "Not for me"
                        }
                        style={{
                          width: 28,
                          height: 24,
                          fontSize: 13,
                          border:
                            r === -1
                              ? "1px solid #ef4444"
                              : "1px solid var(--border)",
                          background:
                            r === -1
                              ? "rgba(239, 68, 68, 0.12)"
                              : "transparent",
                          borderRadius: 6,
                          cursor: "pointer",
                          color: r === -1 ? "#dc2626" : "var(--text-dim)"
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div
                    className="why"
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: "var(--text-dim)",
                      lineHeight: 1.5
                    }}
                  >
                    {it.why}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Generate-more — appends new picks, never wipes the list.
              Avoids re-recommending anything already in `items` and
              leans into the ❤ / away from the ✕ via server-side
              prompt context (see /api/personal-intelligence/recs). */}
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="pi-gen-btn"
            style={{ marginTop: 12 }}
          >
            {busy
              ? "recommending…"
              : `✦ recommend more (${items.length} so far)`}
          </button>
          {(Object.values(ratings).some((v) => v === 1) ||
            Object.values(ratings).some((v) => v === -1)) && (
            <p
              style={{
                marginTop: 6,
                fontSize: 11,
                color: "var(--text-dim)"
              }}
            >
              Your ratings are feeding the next batch — loved picks
              steer toward similar, ✕ picks steer away.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  `Clear all ${items.length} ${kind} recommendations? Your ratings will reset too.`
                )
              ) {
                setItems([]);
                setRatings({});
                setWhy("");
              }
            }}
            className="pi-why-toggle"
            style={{ alignSelf: "flex-start", marginTop: 6 }}
          >
            clear list
          </button>
        </>
      )}
    </article>
  );
}
