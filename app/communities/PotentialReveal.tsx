/**
 * PotentialReveal — the "what SyncedIn enables" animation (Jack): within
 * every group there's far more potential than what's visible. Left: people
 * in their own bubbles, each lighting only a small flashlight cone around
 * themselves (most of the room stays dark). Right: on SyncedIn, every node
 * wires to every other and the whole field lights up.
 *
 * Pure SVG + CSS keyframes (server-safe, no JS). Theme-aware, reduced-
 * motion safe.
 */
type Node = { x: number; y: number };

function ring(cx: number, cy: number, r: number, n: number, rot = 0): Node[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + rot;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

export function PotentialReveal() {
  const BOX = 460;
  const cx = BOX / 2;
  const cy = BOX / 2;
  const nodes = [
    { x: cx, y: cy },
    ...ring(cx, cy, 150, 8),
    ...ring(cx, cy, 92, 5, 0.4)
  ];
  // Every pair → fully connected (the hidden potential), drawn on the right.
  const edges: { x1: number; y1: number; x2: number; y2: number; len: number }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const { x: x1, y: y1 } = nodes[i];
      const { x: x2, y: y2 } = nodes[j];
      edges.push({ x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1) });
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <style>{`
        @keyframes pr-flash { 0%,100% { opacity: 0.18; } 50% { opacity: 0.5; } }
        @keyframes pr-draw { to { stroke-dashoffset: 0; } }
        @keyframes pr-node { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes pr-bloom { 0%,100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.05); } }
        .pr-flash { animation: pr-flash 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .pr-edge { animation: pr-draw 1.1s ease forwards; }
        .pr-node { animation: pr-node 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .pr-bloom { transform-box: fill-box; transform-origin: center; animation: pr-bloom 4.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pr-flash, .pr-node, .pr-bloom { animation: none !important; }
          .pr-edge { stroke-dashoffset: 0 !important; animation: none !important; }
        }
        .pr-grid { display: grid; grid-template-columns: minmax(0,1fr); gap: 18px; }
        @media (min-width: 720px) { .pr-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } }
        .pr-cap { font-size: 12.5px; line-height: 1.5; color: var(--text-dim); text-align: center; max-width: 320px; margin: 0 auto; }
        .pr-lbl { font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; text-align: center; }
      `}</style>

      <div className="pr-grid">
        {/* LEFT — flashlights: isolated, only a little visible */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div className="pr-lbl" style={{ color: "var(--text-dim)" }}>
            What you see in any group
          </div>
          <svg viewBox={`0 0 ${BOX} ${BOX}`} width="100%" style={{ maxWidth: 300, display: "block" }} role="img" aria-label="Isolated people, limited visibility">
            <defs>
              <radialGradient id="pr-cone" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffd966" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#ffd966" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#ffd966" stopOpacity="0" />
              </radialGradient>
            </defs>
            {nodes.map((n, i) => (
              <g key={i}>
                {/* small flashlight glow — only their own little pool of light */}
                <circle className="pr-flash" cx={n.x} cy={n.y} r={34}
                  fill="url(#pr-cone)" style={{ animationDelay: `${(i % 7) * 0.28}s` }} />
                <circle cx={n.x} cy={n.y} r={9} fill="var(--panel-2)" stroke="var(--border-bright)" strokeWidth={1.5} />
                <circle cx={n.x} cy={n.y} r={3} fill="var(--text-dim)" />
              </g>
            ))}
          </svg>
          <p className="pr-cap">
            Everyone in their own bubble, lighting up just the few faces right
            next to them. The real potential stays in the dark.
          </p>
        </div>

        {/* RIGHT — synced: fully lit, fully connected */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div className="pr-lbl" style={{ color: "#1f8bff" }}>
            On SyncedIn
          </div>
          <svg viewBox={`0 0 ${BOX} ${BOX}`} width="100%" style={{ maxWidth: 300, display: "block" }} role="img" aria-label="Fully connected, illuminated network">
            <defs>
              <radialGradient id="pr-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(31,139,255,0.22)" />
                <stop offset="100%" stopColor="rgba(31,139,255,0)" />
              </radialGradient>
            </defs>
            <circle className="pr-bloom" cx={cx} cy={cy} r={200} fill="url(#pr-glow)" />
            {edges.map((e, i) => (
              <line key={i} className="pr-edge" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke="#1f8bff" strokeOpacity={0.4} strokeWidth={1}
                style={{ strokeDasharray: e.len, strokeDashoffset: e.len, animationDelay: `${(i % 26) * 0.02}s` }} />
            ))}
            {nodes.map((n, i) => (
              <circle key={i} className="pr-node" cx={n.x} cy={n.y} r={9} fill="#fff" stroke="#1f8bff" strokeWidth={2.5}
                style={{ animationDelay: `${(i % 9) * 0.18}s` }} />
            ))}
          </svg>
          <p className="pr-cap">
            Every twin reads every other. The whole room lights up — and the
            highest-reward win-wins surface on their own.
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          textAlign: "center",
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: "var(--text)"
        }}
      >
        Networks that sync are{" "}
        <span
          style={{
            background: "linear-gradient(90deg, #1f8bff 0%, #6b2dc9 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}
        >
          more powerful than ever.
        </span>
      </div>
    </div>
  );
}
