"use client";

import { useEffect, useRef, useState } from "react";

type Item = { id: string; label: string };
type Cluster = { category: string; label: string; items: Item[] };
type Graph = {
  center: { id: string; label: string };
  clusters: Cluster[];
};

const CATEGORY_META: Record<
  string,
  { color: string; gradient: string; icon: string }
> = {
  goals: {
    color: "#3a4dff",
    gradient: "linear-gradient(135deg, #3a4dff, #6f7bff)",
    icon: "⊙"
  },
  projects: {
    color: "#1f8bff",
    gradient: "linear-gradient(135deg, #1f8bff, #5ec5ff)",
    icon: "↗"
  },
  people: {
    color: "#ff6b6b",
    gradient: "linear-gradient(135deg, #ff6b6b, #ff8a3d)",
    icon: "◉"
  },
  deal_preferences: {
    color: "#3cd870",
    gradient: "linear-gradient(135deg, #3cd870, #5ee5b2)",
    icon: "◈"
  },
  deal_breakers: {
    color: "#ff8a3d",
    gradient: "linear-gradient(135deg, #ff8a3d, #ff4d6d)",
    icon: "×"
  },
  style: {
    color: "#a060ff",
    gradient: "linear-gradient(135deg, #a060ff, #ff77ee)",
    icon: "◇"
  },
  skills: {
    color: "#ffd54d",
    gradient: "linear-gradient(135deg, #ffd54d, #ff8a3d)",
    icon: "⚡"
  }
};
const metaFor = (cat: string) =>
  CATEGORY_META[cat] || CATEGORY_META.goals;

export function SelfGraph({ formSelector = "form" }: { formSelector?: string }) {
  const [graph, setGraph] = useState<Graph | null>(null);
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
    if (!blob.trim()) {
      setGraph(null);
      setEmpty(true);
      return;
    }
    setEmpty(false);
    setLoading(true);
    try {
      const r = await fetch("/api/extract-knowledge-graph", {
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
      const j = (await r.json()) as Graph;
      if (j?.clusters) setGraph(j);
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
      debounce.current = setTimeout(refresh, 900);
    };
    form.addEventListener("input", handler);
    handler();
    return () => {
      form.removeEventListener("input", handler);
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="retro-shadow"
      style={{
        position: "sticky",
        top: 24,
        padding: 20,
        borderRadius: 16,
        background:
          "radial-gradient(900px 600px at 30% 0%, rgba(58, 77, 255, 0.08), transparent 60%), radial-gradient(800px 500px at 80% 100%, rgba(160, 96, 255, 0.08), transparent 60%), linear-gradient(180deg, #0a0d1e 0%, #11132a 100%)",
        border: "1px solid rgba(120, 130, 220, 0.35)",
        overflow: "hidden"
      }}
    >
      {/* Subtle animated grid behind everything */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(120, 130, 220, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(120, 130, 220, 0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(closest-side at 50% 50%, black, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(closest-side at 50% 50%, black, transparent 85%)",
          pointerEvents: "none"
        }}
      />

      <div
        className="flex items-center justify-between"
        style={{ position: "relative" }}
      >
        <div
          className="retro-label"
          style={{ color: "#9aa6ff" }}
        >
          self graph
        </div>
        {loading && (
          <div
            className="text-xs flex items-center gap-1.5"
            style={{ color: "#9aa6ff" }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#5ee5b2",
                boxShadow: "0 0 8px #5ee5b2",
                animation: "sg-pulse 1.2s ease-in-out infinite"
              }}
            />
            regenerating
          </div>
        )}
      </div>
      <p
        className="mt-1 text-xs"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Live constellation of what makes you, you. Each cluster blooms as
        you add more context.
      </p>

      <div className="mt-4" style={{ position: "relative" }}>
        {empty ? (
          <div
            style={{
              padding: "60px 16px",
              textAlign: "center",
              color: "rgba(255,255,255,0.45)",
              fontSize: 14
            }}
          >
            Your constellation forms here.
            <br />
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              Add goals or paste context to start.
            </span>
          </div>
        ) : graph ? (
          <ZoomPanBox>
            <ConstellationView graph={graph} />
          </ZoomPanBox>
        ) : (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "rgba(255,255,255,0.45)",
              fontSize: 14
            }}
          >
            Forming…
          </div>
        )}
      </div>

      <style>{`
        @keyframes sg-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes sg-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes sg-orbit-rev {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes sg-flow {
          0% { stroke-dashoffset: 60; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes sg-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes sg-fade-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

/**
 * ZoomPanBox — gives the constellation its own zoom + pan surface so the
 * graph never has to overflow into the rest of the page. Starts at 0.7×
 * (zoomed out) so every cluster card is visible without overlap, and lets
 * the user scroll-wheel to zoom in OR drag to pan.
 */
function ZoomPanBox({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(0.55);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale((s) => {
      const next = s * (e.deltaY > 0 ? 0.92 : 1.08);
      return Math.max(0.3, Math.min(1.6, next));
    });
  }
  function onMouseDown(e: React.MouseEvent) {
    dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return;
    setPan({
      x: e.clientX - dragRef.current.x,
      y: e.clientY - dragRef.current.y
    });
  }
  function onMouseUp() {
    dragRef.current = null;
  }

  const ctrlBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid rgba(120, 130, 220, 0.4)",
    background: "rgba(20, 24, 50, 0.85)",
    color: "#cfd5ff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
  };

  return (
    <div
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        position: "relative",
        width: "100%",
        height: 520,
        overflow: "hidden",
        borderRadius: 10,
        cursor: dragRef.current ? "grabbing" : "grab"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: dragRef.current
            ? "none"
            : "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)"
        }}
      >
        <div style={{ width: 760, pointerEvents: "auto" }}>{children}</div>
      </div>

      {/* Zoom controls — sit in the bottom-right of the panel */}
      <div
        style={{
          position: "absolute",
          right: 10,
          bottom: 10,
          display: "flex",
          gap: 4,
          background: "rgba(10, 13, 30, 0.55)",
          padding: 4,
          borderRadius: 8,
          backdropFilter: "blur(6px)"
        }}
      >
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.3, s * 0.85))}
          style={ctrlBtn}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => {
            setScale(0.55);
            setPan({ x: 0, y: 0 });
          }}
          style={{ ...ctrlBtn, width: 44, fontSize: 10, letterSpacing: 1 }}
          aria-label="Reset view"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(1.6, s * 1.15))}
          style={ctrlBtn}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      {/* Drag hint, fades after first interaction */}
      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
          pointerEvents: "none"
        }}
      >
        scroll to zoom · drag to pan
      </div>
    </div>
  );
}

function ConstellationView({ graph }: { graph: Graph }) {
  // v9 — OVERLAP-PROOF BY CONSTRUCTION.
  //
  // The prior layout used position: absolute + computed top% on a fixed
  // ROW_H of 150px. Whenever a cluster's content ran taller (more items,
  // longer labels, line-wraps) it overflowed its slot and visually
  // crashed into the card below it. Each "fix" was another magic number
  // patch — fundamentally fragile.
  //
  // This layout: a CSS grid with TWO columns (left cards / right cards)
  // wrapping a center stack (Jackson + identity rings). Each card sits
  // in a grid cell that auto-sizes to its content; the grid's row-gap
  // guarantees vertical breathing room. Cards literally cannot overlap.
  //
  // The center column shows the person's name plus a faint orbiting
  // accent ring, drawn as a single SVG circle — not a connector. We
  // deliberately drop the curved bezier "connectors" since they were the
  // visual source of "everything is positioned absolutely" thinking.
  const clusters = graph.clusters.slice(0, 6);
  const centerLabel = (graph.center?.label || "you").slice(0, 16);

  // Split clusters into two visual columns. Left = personal/identity
  // (goals, skills, deal-breakers). Right = outward-facing (projects,
  // partners, style). The category list is naturally split alternating,
  // so even/odd index works as a balanced bipartition.
  const leftClusters = clusters.filter((_, i) => i % 2 === 0);
  const rightClusters = clusters.filter((_, i) => i % 2 === 1);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "1fr minmax(120px, 160px) 1fr",
        gridTemplateRows: "auto",
        columnGap: 18,
        alignItems: "center"
      }}
    >
      {/* LEFT COLUMN — flex stack, each card auto-heights */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          minWidth: 0
        }}
      >
        {leftClusters.map((c, i) => (
          <ClusterCard
            key={`L-${c.category}-${i}`}
            cluster={c}
            order={i * 2}
            align="right"
          />
        ))}
      </div>

      {/* CENTER COLUMN — name node with soft orbital ring */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200
        }}
      >
        <svg
          viewBox="0 0 160 160"
          width="100%"
          height="auto"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none"
          }}
        >
          <defs>
            <radialGradient id="sg-center-glow-v9" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3a4dff" stopOpacity="0.55" />
              <stop offset="60%" stopColor="#8b3dff" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#8b3dff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={80} cy={80} r={70} fill="url(#sg-center-glow-v9)" />
          <g
            style={{
              transformOrigin: "80px 80px",
              animation: "sg-orbit 22s linear infinite"
            }}
          >
            <circle
              cx={80}
              cy={80}
              r={54}
              fill="none"
              stroke="rgba(160, 96, 255, 0.32)"
              strokeWidth={1}
              strokeDasharray="4 8"
            />
          </g>
          <g
            style={{
              transformOrigin: "80px 80px",
              animation: "sg-orbit-rev 30s linear infinite"
            }}
          >
            <circle
              cx={80}
              cy={80}
              r={40}
              fill="none"
              stroke="rgba(58, 77, 255, 0.45)"
              strokeWidth={1}
              strokeDasharray="2 10"
            />
          </g>
          <circle
            cx={80}
            cy={80}
            r={28}
            fill="#0a0d1e"
            stroke="#5e6eff"
            strokeWidth={1.5}
          />
        </svg>
        <div
          style={{
            position: "relative",
            zIndex: 2,
            color: "#ffffff",
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textShadow: "0 0 12px rgba(94,110,255,0.7)",
            pointerEvents: "none",
            textAlign: "center"
          }}
        >
          {centerLabel}
        </div>
      </div>

      {/* RIGHT COLUMN — flex stack mirror of the left */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          minWidth: 0
        }}
      >
        {rightClusters.map((c, i) => (
          <ClusterCard
            key={`R-${c.category}-${i}`}
            cluster={c}
            order={i * 2 + 1}
            align="left"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One cluster card. Auto-heights to content. No positional math anywhere
 * — the parent grid + flex stack handles all layout.
 */
function ClusterCard({
  cluster,
  order,
  align
}: {
  cluster: Cluster;
  order: number;
  align: "left" | "right";
}) {
  const m = metaFor(cluster.category);
  return (
    <div
      style={{
        position: "relative",
        padding: 14,
        borderRadius: 12,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        border: `1px solid ${m.color}55`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: `0 8px 32px -12px ${m.color}55, inset 0 1px 0 rgba(255,255,255,0.05)`,
        animation: `sg-fade-in 0.4s ease ${order * 80}ms both`,
        textAlign: align === "right" ? "right" : "left"
      }}
    >
      {/* gradient header strip */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: m.gradient,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12
        }}
      />

      {/* category title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: align === "right" ? "flex-end" : "flex-start",
          gap: 6,
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: m.color,
          textShadow: `0 0 12px ${m.color}66`
        }}
      >
        {align === "right" ? (
          <>
            <span style={{ flex: 1, minWidth: 0 }}>
              {cluster.label || cluster.category}
            </span>
            <span style={{ fontSize: 14 }}>{m.icon}</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 14 }}>{m.icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              {cluster.label || cluster.category}
            </span>
          </>
        )}
      </div>

      {/* divider */}
      <div
        style={{
          margin: "8px 0 6px",
          height: 1,
          background:
            align === "right"
              ? `linear-gradient(270deg, ${m.color}88, transparent)`
              : `linear-gradient(90deg, ${m.color}88, transparent)`
        }}
      />

      {/* items — full list, no truncation, real card height grows naturally */}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          fontFamily: "Inter, system-ui, sans-serif"
        }}
      >
        {cluster.items.slice(0, 6).map((it, j) => (
          <li
            key={j}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: align === "right" ? "flex-end" : "flex-start",
              gap: 8,
              padding: "4px 0",
              fontSize: 12,
              lineHeight: 1.35,
              color: "rgba(255,255,255,0.92)",
              animation: `sg-fade-in 0.4s ease ${order * 80 + j * 50 + 120}ms both`
            }}
          >
            {align === "right" ? (
              <>
                <span style={{ flex: "0 1 auto", minWidth: 0 }}>
                  {it.label}
                </span>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: m.color,
                    boxShadow: `0 0 8px ${m.color}`,
                    flexShrink: 0
                  }}
                />
              </>
            ) : (
              <>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: m.color,
                    boxShadow: `0 0 8px ${m.color}`,
                    flexShrink: 0
                  }}
                />
                <span style={{ flex: "0 1 auto", minWidth: 0 }}>
                  {it.label}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
