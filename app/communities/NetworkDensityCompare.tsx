/**
 * Side-by-side "speed of human bandwidth" vs "speed of light" visual
 * for community/conference pages. Left side: scattered isolated dots
 * (the world today — members trickle through one DM at a time). Right:
 * a fully-connected polygon with real member avatars on each node,
 * every node wired to every other node (twins talking 24/7).
 *
 * Renders on EVERY visitor's view of the community page (not gated to
 * members) — Jack's call: external visitors need to see this to
 * understand why joining matters.
 *
 * Pure SVG, no client JS. The right-side avatars come from the same
 * `members` list the page already fetches; we cap at 16 nodes so the
 * polygon stays readable, but the underlying count is shown in the
 * caption.
 */
type Member = {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

const MAX_NODES = 16;

function initialsOf(m: Member): string {
  const src = (m.display_name || m.email || "?").trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function NetworkDensityCompare({
  members,
  totalCount,
  kindLabel
}: {
  members: Member[];
  totalCount: number;
  kindLabel: string;
}) {
  // Right-side: position avatars around a circle. If we have fewer than
  // MAX_NODES real members, pad with empty placeholders so the polygon
  // still looks dense (visitors get the "this is what it COULD look
  // like" feel).
  const RIGHT_BOX = 460;
  const cx = RIGHT_BOX / 2;
  const cy = RIGHT_BOX / 2;
  const ringR = RIGHT_BOX / 2 - 50;
  const nodeR = 22;

  const realNodes = members.slice(0, MAX_NODES);
  // Always render at least 10 nodes for the visual; the placeholders
  // beyond `realNodes.length` are slightly dimmer so it reads as
  // "ghosts of the people not yet in."
  const totalNodesShown = Math.max(realNodes.length, 10);
  const allNodes: Array<{ member: Member | null; angle: number }> = [];
  for (let i = 0; i < totalNodesShown; i++) {
    const angle = (i / totalNodesShown) * Math.PI * 2 - Math.PI / 2;
    allNodes.push({
      member: realNodes[i] ?? null,
      angle
    });
  }

  const nodePositions = allNodes.map((n) => ({
    ...n,
    x: cx + Math.cos(n.angle) * ringR,
    y: cy + Math.sin(n.angle) * ringR
  }));

  // Generate every edge between every pair → fully-connected graph.
  const edges: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    len: number;
  }> = [];
  for (let i = 0; i < nodePositions.length; i++) {
    for (let j = i + 1; j < nodePositions.length; j++) {
      const x1 = nodePositions[i].x;
      const y1 = nodePositions[i].y;
      const x2 = nodePositions[j].x;
      const y2 = nodePositions[j].y;
      edges.push({ x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1) });
    }
  }

  // Left-side: scatter 14 dim grey dots inside a 460×460 box.
  // Deterministic positions (golden-angle sun pattern) so they never
  // visually move between renders / a/b swaps.
  const LEFT_BOX = 460;
  const leftDots: Array<{ x: number; y: number }> = [];
  const lDotCount = 14;
  const lcx = LEFT_BOX / 2;
  const lcy = LEFT_BOX / 2;
  for (let i = 0; i < lDotCount; i++) {
    // Sunflower (Fibonacci) packing — spreads dots evenly without
    // looking gridded.
    const theta = i * 2.3998;
    const r = Math.sqrt(i + 1) * 38;
    leftDots.push({ x: lcx + Math.cos(theta) * r, y: lcy + Math.sin(theta) * r });
  }

  return (
    <section className="mt-10">
      <div
        style={{
          padding: 24,
          borderRadius: 18,
          border: "1px solid var(--border)",
          background: "var(--panel-solid)"
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "minmax(0, 1fr)"
          }}
          className="ndc-grid"
        >
          <style>{`
            @media (min-width: 720px) {
              .ndc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            }
            .ndc-side {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 14px;
            }
            .ndc-label {
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              text-align: center;
            }
            .ndc-svg { width: 100%; height: auto; display: block; }
            .ndc-caption {
              font-size: 13px;
              line-height: 1.5;
              color: var(--text-dim);
              text-align: center;
              max-width: 320px;
            }
            /* Right side: edges draw themselves in, then nodes fade up —
               the network visibly "wiring itself together" at the speed
               of light. Left side: dots drift faintly (isolated, restless,
               never connecting). Pure CSS, no JS. */
            @keyframes ndc-draw { to { stroke-dashoffset: 0; } }
            @keyframes ndc-fade { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
            @keyframes ndc-bloom { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
            @keyframes ndc-drift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(0,-5px); } }
            .ndc-edge { animation: ndc-draw 0.8s ease forwards; }
            .ndc-node { opacity: 0; transform-box: fill-box; transform-origin: center; animation: ndc-fade 0.5s ease forwards; }
            .ndc-bloom-c { transform-box: fill-box; transform-origin: center; animation: ndc-bloom 4.5s ease-in-out infinite; }
            .ndc-dot { transform-box: fill-box; transform-origin: center; animation: ndc-drift 6s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) {
              .ndc-edge { stroke-dashoffset: 0 !important; animation: none !important; }
              .ndc-node { opacity: 1 !important; transform: none !important; animation: none !important; }
              .ndc-bloom-c, .ndc-dot { animation: none !important; }
            }
          `}</style>

          {/* LEFT — today / human bandwidth */}
          <div className="ndc-side">
            <div className="ndc-label" style={{ color: "var(--text-dim)" }}>
              Today · speed of human bandwidth
            </div>
            <svg
              className="ndc-svg"
              viewBox={`0 0 ${LEFT_BOX} ${LEFT_BOX}`}
              role="img"
              aria-label="Members scattered, mostly disconnected"
            >
              {leftDots.map((d, i) => (
                <g
                  key={i}
                  className="ndc-dot"
                  style={{ animationDelay: `${i * 0.18}s` }}
                >
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={18}
                    fill="var(--panel-2)"
                    stroke="var(--border-bright)"
                    strokeWidth={1.5}
                  />
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={4}
                    fill="var(--text-dim)"
                  />
                </g>
              ))}
            </svg>
            <p className="ndc-caption">
              Members trickle through one DM, one event, one intro at a time.
              Most of the high-leverage pairs in your {kindLabel} never connect.
            </p>
          </div>

          {/* RIGHT — on SyncedIn / speed of light */}
          <div className="ndc-side">
            <div className="ndc-label" style={{ color: "#1f8bff" }}>
              On SyncedIn · speed of light
            </div>
            <svg
              className="ndc-svg"
              viewBox={`0 0 ${RIGHT_BOX} ${RIGHT_BOX}`}
              role="img"
              aria-label={`Fully-connected network of ${nodePositions.length} members`}
            >
              <defs>
                <radialGradient id="ndc-glow" cx="50%" cy="50%" r="50%">
                  <stop
                    offset="0%"
                    stopColor="rgba(31, 139, 255, 0.16)"
                  />
                  <stop
                    offset="100%"
                    stopColor="rgba(31, 139, 255, 0)"
                  />
                </radialGradient>
              </defs>
              {/* Soft ambient bloom behind the polygon */}
              <circle
                className="ndc-bloom-c"
                cx={cx}
                cy={cy}
                r={ringR + 40}
                fill="url(#ndc-glow)"
              />
              {/* Every edge — draws itself in (stroke-dashoffset → 0),
                  staggered so the network wires together left-to-right. */}
              {edges.map((e, i) => (
                <line
                  key={i}
                  className="ndc-edge"
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  stroke="#1f8bff"
                  strokeOpacity={0.45}
                  strokeWidth={1}
                  style={{
                    strokeDasharray: e.len,
                    strokeDashoffset: e.len,
                    animationDelay: `${(i % 28) * 0.022}s`
                  }}
                />
              ))}
              {/* Nodes (member avatars + circles) */}
              {nodePositions.map((n, i) => {
                const m = n.member;
                const isReal = !!m;
                return (
                  <g
                    key={i}
                    className="ndc-node"
                    style={{ animationDelay: `${0.5 + i * 0.05}s` }}
                  >
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={nodeR}
                      fill="#fff"
                      stroke="#1f8bff"
                      strokeWidth={2.5}
                      opacity={isReal ? 1 : 0.5}
                    />
                    {m && m.avatar_url ? (
                      // Clip the avatar image into the circle via a
                      // per-node clipPath so the photo stays bounded.
                      <>
                        <defs>
                          <clipPath id={`ndc-clip-${i}`}>
                            <circle
                              cx={n.x}
                              cy={n.y}
                              r={nodeR - 3}
                            />
                          </clipPath>
                        </defs>
                        <image
                          href={m.avatar_url}
                          x={n.x - (nodeR - 3)}
                          y={n.y - (nodeR - 3)}
                          width={(nodeR - 3) * 2}
                          height={(nodeR - 3) * 2}
                          clipPath={`url(#ndc-clip-${i})`}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </>
                    ) : m ? (
                      // Initials fallback for members without a photo.
                      <text
                        x={n.x}
                        y={n.y + 4}
                        textAnchor="middle"
                        fontSize={12}
                        fontWeight={800}
                        fill="#1f8bff"
                      >
                        {initialsOf(m)}
                      </text>
                    ) : (
                      // Empty seat — small filled dot like a placeholder
                      // user icon.
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={6}
                        fill="#1f8bff"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
            <p className="ndc-caption">
              Twins talk in parallel 24/7. The {kindLabel}&apos;s network
              density compounds with every new member
              {totalCount > MAX_NODES
                ? ` — ${totalCount} signed up so far, ${(
                    (totalCount * (totalCount - 1)) /
                    2
                  ).toLocaleString()} possible pairings.`
                : "."}
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.01em"
          }}
        >
          Density compounds,{" "}
          <span
            style={{
              background:
                "linear-gradient(90deg, #1f8bff 0%, #6b2dc9 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text"
            }}
          >
            forever.
          </span>
        </div>
      </div>
    </section>
  );
}
