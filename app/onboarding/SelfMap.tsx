"use client";

import { useEffect, useRef, useState } from "react";

/**
 * SelfMap — a research-grounded "map of self".
 *
 * Replaces the old free-form constellation (SelfGraph). Instead of vague
 * concept clusters, it renders the user's twin against four established
 * frameworks, computed server-side by /api/twin/self-map:
 *   - Big Five / OCEAN  → the radar pentagon (centerpiece)
 *   - Schwartz values   → priority bars
 *   - Self-Determination Theory drives → autonomy / competence / relatedness
 *   - McAdams narrative identity → the one-line theme up top
 *
 * Theme-aware (CSS variables) so it reads correctly in the Command Center
 * light theme AND dark mode — the old SelfGraph was hardcoded dark and
 * clashed with the rebrand. Honesty: any trait with no signal renders as
 * "not enough signal yet" rather than a fake number.
 */

type BigFive = { trait: string; score: number | null; evidence: string };
type Value = { name: string; score: number; note: string };
type Drive = { name: string; score: number | null; note: string };
type Map = {
  name: string;
  confidence: "thin" | "forming" | "rich";
  identity: string;
  narrative: string;
  bigFive: BigFive[];
  values: Value[];
  drives: Drive[];
};

const TRAIT_LABEL: Record<string, string> = {
  openness: "Openness",
  conscientiousness: "Conscientiousness",
  extraversion: "Extraversion",
  agreeableness: "Agreeableness",
  neuroticism: "Neuroticism"
};
// Short axis labels for the radar so they don't collide.
const TRAIT_SHORT: Record<string, string> = {
  openness: "Open",
  conscientiousness: "Consc.",
  extraversion: "Extra.",
  agreeableness: "Agree.",
  neuroticism: "Neuro."
};
const TRAIT_ORDER = [
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "neuroticism"
];

export function SelfMap({
  formSelector = "form"
}: {
  formSelector?: string;
}) {
  const [map, setMap] = useState<Map | null>(null);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function readForm(): Record<string, string> {
    if (typeof document === "undefined") return {};
    const form = document.querySelector(formSelector) as HTMLFormElement | null;
    if (!form) return {};
    const out: Record<string, string> = {};
    form
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input[name], textarea[name]"
      )
      .forEach((el) => {
        out[el.name] = el.value;
      });
    return out;
  }

  async function refresh() {
    const f = readForm();
    const blob = [
      f.goals,
      f.deal_preferences,
      f.communication_style,
      f.deal_breakers,
      f.ai_export_blob
    ]
      .filter(Boolean)
      .join("");
    if (blob.trim().length < 12) {
      setMap(null);
      setEmpty(true);
      return;
    }
    setEmpty(false);
    setLoading(true);
    try {
      const r = await fetch("/api/twin/self-map", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: f.display_name,
          goals: f.goals,
          deal_preferences: f.deal_preferences,
          communication_style: f.communication_style,
          deal_breakers: f.deal_breakers,
          ai_export_blob: f.ai_export_blob
        })
      });
      const j = (await r.json()) as Map;
      if (j && Array.isArray(j.bigFive)) setMap(j);
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const form = document.querySelector(formSelector) as HTMLFormElement | null;
    if (!form) return;
    const handler = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(refresh, 1100);
    };
    form.addEventListener("input", handler);
    handler();
    return () => {
      form.removeEventListener("input", handler);
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confLabel =
    map?.confidence === "rich"
      ? "Detailed portrait"
      : map?.confidence === "forming"
      ? "Forming — add more to sharpen"
      : "Early sketch";

  return (
    <div
      className="retro-panel retro-shadow"
      style={{ padding: 22, overflow: "hidden" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div
            className="retro-label"
            style={{ color: "var(--amber-bright)" }}
          >
            map of self
          </div>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--text-dim)", maxWidth: 520 }}
          >
            Your twin read against four frameworks psychologists actually use —
            Big Five traits, Schwartz values, Self-Determination drives, and a
            narrative identity line. Inferred from your context; it sharpens as
            you add more.
          </p>
        </div>
        {loading && (
          <div
            className="text-xs flex items-center gap-1.5 shrink-0"
            style={{ color: "var(--amber-bright)" }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--green)",
                boxShadow: "0 0 8px var(--green)",
                animation: "sm-pulse 1.2s ease-in-out infinite"
              }}
            />
            reading
          </div>
        )}
      </div>

      {empty ? (
        <div
          style={{
            padding: "56px 16px",
            textAlign: "center",
            color: "var(--text-dim)",
            fontSize: 14
          }}
        >
          Your map forms here.
          <br />
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            Add goals or paste context to begin.
          </span>
        </div>
      ) : !map ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "var(--text-dim)",
            fontSize: 14
          }}
        >
          Reading your context…
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {/* Narrative identity — the McAdams line */}
          {map.identity ? (
            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))",
                border: "1px solid var(--border-bright)"
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.35,
                  color: "var(--text)"
                }}
              >
                {map.identity}
              </div>
              {map.narrative && (
                <p
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: "var(--text-dim)",
                    lineHeight: 1.5
                  }}
                >
                  {map.narrative}
                </p>
              )}
            </div>
          ) : null}

          {/* Confidence chip */}
          <div
            style={{
              marginTop: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-dim)"
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background:
                  map.confidence === "rich"
                    ? "var(--green)"
                    : map.confidence === "forming"
                    ? "var(--amber-bright)"
                    : "var(--text-dim)"
              }}
            />
            {confLabel}
          </div>

          {/* Two-column body: radar left, values+drives right */}
          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 22,
              alignItems: "start"
            }}
          >
            <div>
              <SectionTitle>Big Five (OCEAN)</SectionTitle>
              <BigFiveRadar five={map.bigFive} />
              <BigFiveLegend five={map.bigFive} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <div>
                <SectionTitle>Core values · Schwartz</SectionTitle>
                {map.values.length > 0 ? (
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10
                    }}
                  >
                    {map.values.slice(0, 6).map((v) => (
                      <Bar
                        key={v.name}
                        label={v.name}
                        note={v.note}
                        score={v.score}
                        color="var(--amber)"
                      />
                    ))}
                  </div>
                ) : (
                  <Unknown />
                )}
              </div>

              <div>
                <SectionTitle>Drives · Self-Determination</SectionTitle>
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10
                  }}
                >
                  {map.drives.map((d) => (
                    <Bar
                      key={d.name}
                      label={d.name}
                      note={d.note}
                      score={d.score}
                      color="var(--green)"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sm-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes sm-grow {
          from { opacity: 0; transform: scaleX(0.2); }
          to { opacity: 1; transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--text-dim)"
      }}
    >
      {children}
    </div>
  );
}

function Unknown() {
  return (
    <div
      style={{
        marginTop: 10,
        fontSize: 12,
        color: "var(--text-dim)",
        fontStyle: "italic"
      }}
    >
      Not enough signal yet — add more context.
    </div>
  );
}

/** Horizontal score bar with a label, optional note, and a value pill. */
function Bar({
  label,
  note,
  score,
  color
}: {
  label: string;
  note?: string;
  score: number | null;
  color: string;
}) {
  const known = typeof score === "number";
  const pct = known ? Math.max(0, Math.min(100, score as number)) : 0;
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: known ? color : "var(--text-dim)"
          }}
        >
          {known ? `${pct}` : "—"}
        </span>
      </div>
      <div
        style={{
          marginTop: 5,
          height: 8,
          borderRadius: 999,
          background: "var(--panel-2)",
          overflow: "hidden",
          border: "1px solid var(--border)"
        }}
      >
        {known && (
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${color}, var(--amber-bright))`,
              transformOrigin: "left center",
              animation: "sm-grow 0.5s ease both"
            }}
          />
        )}
      </div>
      {note && (
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: "var(--text-dim)",
            lineHeight: 1.3
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}

/**
 * Big Five radar — a 5-axis pentagon. Known traits plot at their score;
 * unknown traits plot at a faint baseline so the shape stays readable and
 * the gap reads as "we don't know this yet."
 */
function BigFiveRadar({ five }: { five: BigFive[] }) {
  const byTrait = new Map(five.map((t) => [t.trait, t]));
  const ordered = TRAIT_ORDER.map(
    (k) => byTrait.get(k) ?? { trait: k, score: null, evidence: "" }
  );

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const R = 96;
  const N = 5;

  // Angle for axis i — start at top, go clockwise.
  const angle = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const point = (i: number, r: number) => ({
    x: cx + Math.cos(angle(i)) * r,
    y: cy + Math.sin(angle(i)) * r
  });

  // Grid rings at 25/50/75/100%.
  const rings = [0.25, 0.5, 0.75, 1].map((f) =>
    Array.from({ length: N }, (_, i) => point(i, R * f))
      .map((p) => `${p.x},${p.y}`)
      .join(" ")
  );

  // Data polygon — unknowns sit at 12% so the shape never collapses to a
  // dot, but visibly dips where we lack signal.
  const dataPts = ordered.map((t, i) => {
    const f = typeof t.score === "number" ? (t.score as number) / 100 : 0.12;
    return point(i, R * Math.max(0.04, f));
  });
  const dataPoly = dataPts.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="auto"
        style={{ maxWidth: 300 }}
        role="img"
        aria-label="Big Five personality radar"
      >
        <defs>
          <linearGradient id="sm-radar-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.30" />
          </linearGradient>
        </defs>

        {/* Grid rings */}
        {rings.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}
        {/* Spokes */}
        {ordered.map((_, i) => {
          const p = point(i, R);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="var(--border)"
              strokeWidth={1}
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={dataPoly}
          fill="url(#sm-radar-fill)"
          stroke="#6366f1"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Vertices */}
        {dataPts.map((p, i) => {
          const known = typeof ordered[i].score === "number";
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={known ? 3.5 : 2.5}
              fill={known ? "#6366f1" : "var(--text-dim)"}
              opacity={known ? 1 : 0.5}
            />
          );
        })}

        {/* Axis labels */}
        {ordered.map((t, i) => {
          const p = point(i, R + 18);
          const known = typeof t.score === "number";
          return (
            <text
              key={i}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={700}
              fill={known ? "var(--text)" : "var(--text-dim)"}
              style={{ fontFamily: "Inter, system-ui, sans-serif" }}
            >
              {TRAIT_SHORT[t.trait] ?? t.trait}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/** Per-trait readout under the radar — score or "—" + short evidence. */
function BigFiveLegend({ five }: { five: BigFive[] }) {
  const byTrait = new Map(five.map((t) => [t.trait, t]));
  const ordered = TRAIT_ORDER.map(
    (k) => byTrait.get(k) ?? { trait: k, score: null, evidence: "" }
  );
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
      {ordered.map((t) => {
        const known = typeof t.score === "number";
        return (
          <div
            key={t.trait}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              fontSize: 12
            }}
          >
            <span
              style={{
                width: 122,
                flexShrink: 0,
                fontWeight: 700,
                color: "var(--text)"
              }}
            >
              {TRAIT_LABEL[t.trait] ?? t.trait}
            </span>
            <span
              style={{
                width: 30,
                flexShrink: 0,
                fontWeight: 800,
                color: known ? "var(--amber)" : "var(--text-dim)"
              }}
            >
              {known ? t.score : "—"}
            </span>
            <span
              style={{
                color: "var(--text-dim)",
                lineHeight: 1.3,
                minWidth: 0
              }}
            >
              {known ? t.evidence : "not enough signal yet"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
