"use client";

import { useState } from "react";

/**
 * Universal Personal-Intelligence generator card. Hits
 * /api/personal-intelligence/generate with a `kind` and renders the
 * structured JSON the model returns. Each kind has a tailored render
 * branch — life-path → stages list, plot → 3 variants, business →
 * milestone arc, images → copy-prompt list, song → lyric stanzas,
 * merch → piece grid.
 */
type AnyPayload = Record<string, any>;

export function PiGeneratorCard({
  kind,
  icon,
  eyebrow,
  title,
  blurb,
  accent
}: {
  kind: "life-path" | "plot" | "business" | "images" | "song" | "merch";
  icon: string;
  eyebrow: string;
  title: string;
  blurb: string;
  accent: string;
}) {
  const [payload, setPayload] = useState<AnyPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function generate() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/personal-intelligence/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind })
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      }
      setPayload(j.payload ?? null);
    } catch (e: any) {
      setErr(
        e?.message ||
          "Couldn't generate. Make sure your twin has goals + context."
      );
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    try {
      navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy:", text);
    }
  }

  return (
    <article className="pi-card pi-card-live" style={{ position: "relative" }}>
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
        .pi-block {
          margin-top: 10px;
          padding: 12px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 10px;
        }
        .pi-block h4 {
          font-size: 13px; font-weight: 700; margin: 0 0 6px;
          color: var(--text);
        }
        .pi-block p, .pi-block li {
          font-size: 12.5px; line-height: 1.55; color: var(--text-dim);
        }
        .pi-block ul { margin: 4px 0 0; padding-left: 18px; }
        .pi-copy {
          margin-top: 6px;
          background: transparent;
          border: 1px solid var(--border);
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 6px;
          color: var(--text-dim);
          cursor: pointer;
        }
      `}</style>

      <span className="icon" aria-hidden="true">{icon}</span>
      <span className="eyebrow" style={{ color: accent }}>{eyebrow}</span>
      <h3>{title}</h3>
      <p className="blurb">{blurb}</p>

      {!payload && (
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="pi-gen-btn"
        >
          {busy ? "generating…" : `✦ generate for me`}
        </button>
      )}

      {err && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444" }}>
          {err}
        </div>
      )}

      {payload && (
        <>
          {kind === "life-path" && <LifePath p={payload} />}
          {kind === "plot" && <PlotIdeas p={payload} onCopy={copy} />}
          {kind === "business" && <Business p={payload} />}
          {kind === "images" && <Images p={payload} onCopy={copy} />}
          {kind === "song" && <Song p={payload} onCopy={copy} />}
          {kind === "merch" && <Merch p={payload} />}
          <button
            type="button"
            onClick={() => {
              setPayload(null);
              void generate();
            }}
            className="pi-copy"
            style={{ alignSelf: "flex-start", marginTop: 8 }}
          >
            ↻ regenerate
          </button>
        </>
      )}
    </article>
  );
}

function LifePath({ p }: { p: AnyPayload }) {
  return (
    <div>
      {p.headline && (
        <div className="pi-block">
          <p style={{ fontWeight: 600, color: "var(--text)" }}>{p.headline}</p>
        </div>
      )}
      {Array.isArray(p.stages) && (
        <div className="pi-block">
          <h4>Stages</h4>
          <ul>
            {p.stages.map((s: any, i: number) => (
              <li key={i}>
                <strong style={{ color: "var(--text)" }}>{s.label}</strong>
                {s.year_band ? ` (${s.year_band})` : ""} — {s.summary}
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.current_chapter && (
        <div className="pi-block">
          <h4>Where you are now</h4>
          <p>{p.current_chapter}</p>
        </div>
      )}
      {Array.isArray(p.next_moves) && (
        <div className="pi-block">
          <h4>Next moves</h4>
          <ul>
            {p.next_moves.map((m: any, i: number) => (
              <li key={i}>
                <strong style={{ color: "var(--text)" }}>{m.action}</strong>
                {" — "}
                {m.why}
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.ten_year_arc && (
        <div className="pi-block">
          <h4>If you compound this for 10 years</h4>
          <p>{p.ten_year_arc}</p>
        </div>
      )}
    </div>
  );
}

function PlotIdeas({
  p,
  onCopy
}: {
  p: AnyPayload;
  onCopy: (s: string) => void;
}) {
  return (
    <>
      {(["memoir", "novel", "screenplay"] as const).map((k) =>
        p[k] ? (
          <div key={k} className="pi-block">
            <h4>
              {k[0].toUpperCase() + k.slice(1)}:{" "}
              <span style={{ color: "var(--text)" }}>{p[k].title}</span>
            </h4>
            <p style={{ fontStyle: "italic" }}>{p[k].logline}</p>
            <p style={{ marginTop: 6 }}>{p[k].outline}</p>
            <button
              type="button"
              onClick={() =>
                onCopy(
                  `${p[k].title}\n\n${p[k].logline}\n\n${p[k].outline}`
                )
              }
              className="pi-copy"
            >
              copy {k}
            </button>
          </div>
        ) : null
      )}
    </>
  );
}

function Business({ p }: { p: AnyPayload }) {
  return (
    <>
      {p.venture_name && (
        <div className="pi-block">
          <h4>{p.venture_name}</h4>
          <p>{p.thesis}</p>
        </div>
      )}
      {p.tam && (
        <div className="pi-block">
          <h4>Market read</h4>
          <p>{p.tam}</p>
        </div>
      )}
      {p.wedge && (
        <div className="pi-block">
          <h4>Your wedge</h4>
          <p>{p.wedge}</p>
        </div>
      )}
      {p.gtm && (
        <div className="pi-block">
          <h4>GTM (first 3 moves)</h4>
          <p>{p.gtm}</p>
        </div>
      )}
      {Array.isArray(p.milestones) && (
        <div className="pi-block">
          <h4>Milestone arc</h4>
          <ul>
            {p.milestones.map((m: any, i: number) => (
              <li key={i}>
                <strong style={{ color: "var(--text)" }}>{m.horizon}:</strong>{" "}
                {m.what} <em>({m.signal})</em>
              </li>
            ))}
          </ul>
        </div>
      )}
      {Array.isArray(p.exit_paths) && (
        <div className="pi-block">
          <h4>Exit paths</h4>
          <ul>
            {p.exit_paths.map((e: string, i: number) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Images({
  p,
  onCopy
}: {
  p: AnyPayload;
  onCopy: (s: string) => void;
}) {
  return (
    <>
      {p.intro && (
        <div className="pi-block">
          <p>{p.intro}</p>
        </div>
      )}
      {Array.isArray(p.prompts) &&
        p.prompts.map((pr: any, i: number) => (
          <div key={i} className="pi-block">
            <h4>{pr.title}</h4>
            <p style={{ fontFamily: "ui-monospace, monospace" }}>{pr.prompt}</p>
            <button
              type="button"
              onClick={() => onCopy(pr.prompt)}
              className="pi-copy"
            >
              copy prompt
            </button>
          </div>
        ))}
    </>
  );
}

function Song({
  p,
  onCopy
}: {
  p: AnyPayload;
  onCopy: (s: string) => void;
}) {
  return (
    <>
      {p.title && (
        <div className="pi-block">
          <h4>{p.title}</h4>
          <p>
            <strong style={{ color: "var(--text)" }}>{p.genre}</strong>
            {p.tempo_bpm ? ` · ${p.tempo_bpm} bpm` : ""}
            {p.tonality ? ` · ${p.tonality}` : ""}
          </p>
        </div>
      )}
      {p.story_arc && (
        <div className="pi-block">
          <h4>The story</h4>
          <p>{p.story_arc}</p>
        </div>
      )}
      {(["verse_1", "chorus", "verse_2", "bridge"] as const).map((k) =>
        p[k] ? (
          <div key={k} className="pi-block">
            <h4>{k.replace("_", " ")}</h4>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "var(--text-dim)"
              }}
            >
              {p[k]}
            </pre>
          </div>
        ) : null
      )}
      <button
        type="button"
        onClick={() =>
          onCopy(
            `${p.title}\n\n[Verse 1]\n${p.verse_1}\n\n[Chorus]\n${p.chorus}\n\n[Verse 2]\n${p.verse_2}\n\n[Bridge]\n${p.bridge ?? ""}`
          )
        }
        className="pi-copy"
        style={{ alignSelf: "flex-start" }}
      >
        copy full lyrics
      </button>
    </>
  );
}

function Merch({ p }: { p: AnyPayload }) {
  return (
    <>
      {p.line_name && (
        <div className="pi-block">
          <h4>{p.line_name}</h4>
          <p style={{ fontStyle: "italic" }}>{p.tagline}</p>
        </div>
      )}
      {Array.isArray(p.pieces) &&
        p.pieces.map((m: any, i: number) => (
          <div key={i} className="pi-block">
            <h4>
              {m.type ? `[${m.type}] ` : ""}
              {m.name}
            </h4>
            <p>
              <strong style={{ color: "var(--text)" }}>Front:</strong> {m.front}
            </p>
            {m.back && m.back !== "none" && (
              <p>
                <strong style={{ color: "var(--text)" }}>Back:</strong> {m.back}
              </p>
            )}
            <p style={{ color: "var(--text-dim)" }}>
              {m.color ? `Color: ${m.color}. ` : ""}
              {m.audience ? `For: ${m.audience}.` : ""}
            </p>
          </div>
        ))}
    </>
  );
}
