/**
 * NetworkDensity — animated side-by-side comparison:
 *
 *  LEFT  ("speed of walking + small talk")
 *    Scattered attendees with one or two slow, random conversations
 *    drifting between random pairs. Visualizes how slow human cold-start
 *    networking actually is in practice.
 *
 *  RIGHT ("speed of light")
 *    Same N nodes in a ring, with a dense web of twin-discovered
 *    connections drawing themselves rapidly. Many traveling sparks at
 *    once. Visualizes the parallel n² conversation the clones run.
 *
 * Tagline: "Deeper connections, faster."
 * Pure SMIL/SVG — no JS, identical on server and client.
 */
export function NetworkDensity({
  // Left-side label — defaults to a one-time event ("speed of walking").
  // Communities can override to "speed of human bandwidth" since they're
  // ongoing relationships, not a one-shot conference room.
  slowLabel = "Today · speed of walking",
  fastLabel = "On SyncedIn · speed of light",
  slowCaption = "One conversation at a time. Most of the right counterparts in the room never actually meet.",
  fastCaption = "N² parallel conversations resolve in seconds, surfacing the highest-leverage matches ahead of time.",
  tagline = (
    <>
      Deeper connections,{" "}
      <span style={{ color: "var(--amber-bright)" }}>faster</span>.
    </>
  )
}: {
  slowLabel?: string;
  fastLabel?: string;
  slowCaption?: string;
  fastCaption?: string;
  tagline?: React.ReactNode;
}) {
  const N = 14;

  // Scattered "before" positions.
  const left: Array<{ x: number; y: number }> = [
    { x: 60, y: 60 },
    { x: 140, y: 40 },
    { x: 220, y: 80 },
    { x: 280, y: 50 },
    { x: 320, y: 130 },
    { x: 80, y: 140 },
    { x: 180, y: 170 },
    { x: 250, y: 210 },
    { x: 100, y: 210 },
    { x: 320, y: 240 },
    { x: 60, y: 270 },
    { x: 160, y: 290 },
    { x: 240, y: 280 },
    { x: 300, y: 300 }
  ];
  // A handful of slow "humans bumping into each other" connections — picked
  // randomly but baked at build time so server + client match.
  const slowPairs: Array<[number, number]> = [
    [2, 6],
    [5, 11],
    [3, 7],
    [9, 12]
  ];
  const SLOW_DUR = 4; // each slow walk-and-talk takes 4s
  const SLOW_GAP = 2; // 2s pause between attempts

  // "After" positions — clean ring.
  const cx = 190;
  const cy = 180;
  const r = 130;
  const right = Array.from({ length: N }, (_, i) => {
    const t = (i / N) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r };
  });

  // Dense twin-discovered edges. We DON'T draw the full mesh (n*(n-1)/2 = 91
  // for n=14 — too noisy). We pick a curated dense subset: every node has
  // 4-5 high-leverage matches. This shows real density without illegibility.
  const edges: Array<[number, number]> = [
    [0, 5],
    [0, 7],
    [0, 9],
    [0, 11],
    [1, 6],
    [1, 8],
    [1, 10],
    [1, 12],
    [2, 7],
    [2, 9],
    [2, 11],
    [2, 13],
    [3, 6],
    [3, 8],
    [3, 10],
    [3, 12],
    [4, 7],
    [4, 9],
    [4, 11],
    [4, 13],
    [5, 8],
    [5, 10],
    [5, 12],
    [6, 9],
    [6, 11],
    [6, 13],
    [7, 10],
    [7, 12],
    [8, 11],
    [8, 13],
    [9, 12],
    [10, 13]
  ];

  // Fast draw — edges complete in ~0.4s each, staggered tightly, so the
  // whole web populates in under 4s. Then hold + restart.
  const FAST_PER = 0.4;
  const FAST_HOLD = 3.0;
  const FAST_TOTAL = edges.length * 0.12 + FAST_HOLD + 1.0;

  return (
    <div
      className="retro-panel"
      style={{
        padding: 16,
        background: "var(--panel-solid)",
        overflow: "hidden"
      }}
    >
      <div className="grid sm:grid-cols-2 gap-4 items-start">
        {/* LEFT — humans, speed of walking */}
        <div>
          <div
            className="retro-label text-center"
            style={{ color: "var(--text-dim)" }}
          >
            {slowLabel}
          </div>
          <svg
            viewBox="0 0 380 340"
            width="100%"
            height="auto"
            role="img"
            aria-label="Scattered attendees, slow occasional connections"
          >
            <defs>
              <linearGradient id="nd_slow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--text-dim)" stopOpacity="0.2" />
                <stop offset="50%" stopColor="var(--text-dim)" stopOpacity="0.65" />
                <stop offset="100%" stopColor="var(--text-dim)" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* A couple of slow connections that form briefly then fade. */}
            {slowPairs.map(([a, b], i) => {
              const A = left[a];
              const B = left[b];
              const begin = i * (SLOW_DUR + SLOW_GAP) * 0.6;
              const cycle = slowPairs.length * (SLOW_DUR + SLOW_GAP) * 0.6;
              return (
                <g key={`s${i}`}>
                  <line
                    x1={A.x}
                    y1={A.y}
                    x2={B.x}
                    y2={B.y}
                    stroke="url(#nd_slow)"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    opacity={0}
                  >
                    <animate
                      attributeName="opacity"
                      values="0;0;0.6;0.6;0"
                      keyTimes="0;0.05;0.2;0.35;0.45"
                      dur={`${cycle}s`}
                      begin={`${begin}s`}
                      repeatCount="indefinite"
                    />
                  </line>
                  <circle r={2.5} fill="var(--text-dim)" opacity={0}>
                    <animate
                      attributeName="opacity"
                      values="0;0;1;0"
                      keyTimes="0;0.1;0.3;0.4"
                      dur={`${cycle}s`}
                      begin={`${begin}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="cx"
                      values={`${A.x};${A.x};${B.x};${B.x}`}
                      keyTimes="0;0.1;0.3;1"
                      dur={`${cycle}s`}
                      begin={`${begin}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="cy"
                      values={`${A.y};${A.y};${B.y};${B.y}`}
                      keyTimes="0;0.1;0.3;1"
                      dur={`${cycle}s`}
                      begin={`${begin}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              );
            })}

            {/* Scattered attendees — each one literally walks. A 4-stop
                Brownian path with a unique offset per index, durations
                staggered so they don't all stride in sync. Body + head
                share the path so each "person" stays whole. */}
            {left.map((p, i) => {
              // Generate a deterministic 4-waypoint walk inside the canvas.
              // Use index-based math instead of Math.random so SSR + client
              // match exactly (no hydration warning).
              const dx1 = ((i * 53) % 60) - 30;
              const dy1 = ((i * 31) % 50) - 25;
              const dx2 = ((i * 71) % 70) - 35;
              const dy2 = ((i * 47) % 60) - 30;
              const dx3 = ((i * 29) % 55) - 27;
              const dy3 = ((i * 67) % 45) - 22;
              const clampX = (x: number) => Math.max(30, Math.min(350, x));
              const clampY = (y: number) => Math.max(30, Math.min(310, y));
              const xs = [
                p.x,
                clampX(p.x + dx1),
                clampX(p.x + dx2),
                clampX(p.x + dx3),
                p.x
              ];
              const ys = [
                p.y,
                clampY(p.y + dy1),
                clampY(p.y + dy2),
                clampY(p.y + dy3),
                p.y
              ];
              // 12–18 seconds per loop, staggered so the room feels alive.
              const dur = `${12 + (i % 7)}s`;
              return (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={9}
                    fill="var(--panel-2)"
                    stroke="var(--border-bright)"
                    strokeWidth={1.5}
                  >
                    <animate
                      attributeName="cx"
                      values={xs.join(";")}
                      dur={dur}
                      repeatCount="indefinite"
                      calcMode="spline"
                      keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
                    />
                    <animate
                      attributeName="cy"
                      values={ys.join(";")}
                      dur={dur}
                      repeatCount="indefinite"
                      calcMode="spline"
                      keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
                    />
                  </circle>
                  <circle
                    cx={p.x}
                    cy={p.y - 3}
                    r={3.5}
                    fill="var(--text-dim)"
                  >
                    <animate
                      attributeName="cx"
                      values={xs.join(";")}
                      dur={dur}
                      repeatCount="indefinite"
                      calcMode="spline"
                      keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
                    />
                    <animate
                      attributeName="cy"
                      values={ys.map((y) => y - 3).join(";")}
                      dur={dur}
                      repeatCount="indefinite"
                      calcMode="spline"
                      keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
                    />
                  </circle>
                </g>
              );
            })}
          </svg>
          <p
            className="retro-dim text-xs mt-3 text-center"
            style={{ lineHeight: 1.5, paddingInline: 6 }}
          >
            {slowCaption}
          </p>
        </div>

        {/* RIGHT — clones, speed of light */}
        <div>
          <div
            className="retro-label text-center"
            style={{ color: "var(--amber-bright)" }}
          >
            {fastLabel}
          </div>
          <svg
            viewBox="0 0 380 340"
            width="100%"
            height="auto"
            role="img"
            aria-label="Dense twin-discovered connections forming rapidly"
          >
            <defs>
              <linearGradient id="nd_edge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--amber)" />
                <stop offset="100%" stopColor="var(--amber-bright)" />
              </linearGradient>
              <radialGradient id="nd_glow" cx="0.5" cy="0.5" r="0.5">
                <stop
                  offset="0%"
                  stopColor="var(--amber-bright)"
                  stopOpacity="0.4"
                />
                <stop
                  offset="100%"
                  stopColor="var(--amber-bright)"
                  stopOpacity="0"
                />
              </radialGradient>
            </defs>

            {/* Pulsing halos behind every node — every member is a participant */}
            {right.map((p, i) => (
              <circle
                key={`g${i}`}
                cx={p.x}
                cy={p.y}
                r={18}
                fill="url(#nd_glow)"
              >
                <animate
                  attributeName="r"
                  values="14;22;14"
                  dur={`${2.5 + (i % 5) * 0.3}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}

            {/* Edges — draw quickly, staggered by 0.12s each, all hold, restart */}
            {edges.map(([a, b], i) => {
              const A = right[a];
              const B = right[b];
              const len = Math.hypot(B.x - A.x, B.y - A.y);
              const begin = i * 0.12;
              return (
                <line
                  key={`e${i}`}
                  x1={A.x}
                  y1={A.y}
                  x2={B.x}
                  y2={B.y}
                  stroke="url(#nd_edge)"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeDasharray={len}
                  strokeDashoffset={len}
                  opacity={0.85}
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    values={`${len};0;0;${len}`}
                    keyTimes={`0;${(FAST_PER / FAST_TOTAL).toFixed(3)};${((edges.length * 0.12 + FAST_HOLD - begin) / FAST_TOTAL).toFixed(3)};1`}
                    dur={`${FAST_TOTAL}s`}
                    begin={`${begin}s`}
                    repeatCount="indefinite"
                  />
                </line>
              );
            })}

            {/* Many traveling sparks at once — the speed-of-light feel */}
            {edges.map(([a, b], i) => {
              const A = right[a];
              const B = right[b];
              const begin = i * 0.12;
              return (
                <circle
                  key={`spk${i}`}
                  r={2}
                  fill="#ffffff"
                  opacity={0}
                >
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0;0"
                    keyTimes="0;0.05;0.95;1;1"
                    dur={`${FAST_PER}s`}
                    begin={`${begin}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="cx"
                    values={`${A.x};${B.x}`}
                    dur={`${FAST_PER}s`}
                    begin={`${begin}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="cy"
                    values={`${A.y};${B.y}`}
                    dur={`${FAST_PER}s`}
                    begin={`${begin}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              );
            })}

            {/* Nodes — all matched, so all amber */}
            {right.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={11}
                  fill="var(--panel-solid)"
                  stroke="var(--amber-bright)"
                  strokeWidth={2}
                />
                <circle cx={p.x} cy={p.y - 3} r={4} fill="var(--amber)" />
                <path
                  d={`M ${p.x - 5} ${p.y + 5} Q ${p.x} ${p.y + 1} ${p.x + 5} ${p.y + 5}`}
                  fill="none"
                  stroke="var(--amber)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              </g>
            ))}
          </svg>
          <p
            className="retro-dim text-xs mt-3 text-center"
            style={{ lineHeight: 1.5, paddingInline: 6 }}
          >
            {fastCaption}
          </p>
        </div>
      </div>

      {/* Tagline — runs full-width below both diagrams */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid var(--border)",
          textAlign: "center"
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--text)"
          }}
        >
          {tagline}
        </div>
      </div>
    </div>
  );
}
