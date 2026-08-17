/**
 * Puzzle-globe assembly animation. Sits below the closing blockquote
 * on /hypernetwork. Eight puzzle wedges fly in from the perimeter,
 * rotate, and lock into a sphere; then meridian + equator arcs fade in
 * and the assembled globe slowly rotates forever.
 *
 * Pure SVG + inline CSS keyframes — no JS, no library. Plays once on
 * page load (the rotation continues). Jack: "puzzle pieces coming
 * together... like a globe sinking of different puzzle pieces."
 */

export function PuzzleGlobeAssembly() {
  // 8 wedges around the circle. Each gets a random-ish start position
  // off-canvas plus a stagger so they don't arrive simultaneously.
  // Stored as data so the markup stays small and easy to tune.
  const wedges = [
    { angle: 0, startX: -180, startY: -80, startRot: -120, delay: 0.0 },
    { angle: 45, startX: 180, startY: -120, startRot: 140, delay: 0.18 },
    { angle: 90, startX: 200, startY: 20, startRot: -80, delay: 0.34 },
    { angle: 135, startX: 160, startY: 180, startRot: 110, delay: 0.5 },
    { angle: 180, startX: -20, startY: 220, startRot: -150, delay: 0.66 },
    { angle: 225, startX: -200, startY: 160, startRot: 95, delay: 0.82 },
    { angle: 270, startX: -220, startY: 30, startRot: -110, delay: 0.98 },
    { angle: 315, startX: -160, startY: -160, startRot: 130, delay: 1.12 }
  ];

  // The wedge path: a pie-slice (45° wedge of a 100-radius circle)
  // with a puzzle tab on one radial edge and a matching blank on the
  // other. Centered at origin (0,0), wedge spans -22.5° to +22.5°.
  // We rotate the wedge to its final angle via a transform in the SVG.
  //
  // Tab/blank geometry: small curve protruding (tab) or carved (blank)
  // mid-radial so adjacent wedges visually interlock when assembled.
  const WEDGE_PATH = [
    // Start at center
    "M 0 0",
    // Down-radial edge to perimeter (with BLANK indent halfway down)
    "L 38 -16",
    "Q 50 0 38 16",
    "L 92 38",
    // Outer arc across the wedge top
    "A 100 100 0 0 1 92 -38",
    // Back along upper-radial edge to center (with TAB outward)
    "L 38 -16",
    // Close back to origin
    "Z"
  ].join(" ");

  return (
    <div
      style={{
        marginTop: 32,
        padding: "24px 16px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="-160 -160 320 320"
        width="280"
        height="280"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Each wedge gets its own subtle gradient — warmer amber to
              cooler indigo around the rim so the globe reads as having
              depth + light source. */}
          {wedges.map((_, i) => (
            <linearGradient
              key={`g-${i}`}
              id={`pg-grad-${i}`}
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={i % 2 === 0 ? "#ffb800" : "#6b2dc9"}
                stopOpacity="0.9"
              />
              <stop
                offset="100%"
                stopColor={i % 2 === 0 ? "#ff7a00" : "#2358ff"}
                stopOpacity="0.85"
              />
            </linearGradient>
          ))}
          {/* Soft inner shadow on the assembled globe — read as
              "spherical, not flat" once pieces lock in. */}
          <radialGradient id="pg-shading" cx="35%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.18" />
          </radialGradient>
        </defs>

        {/* PIECES — rendered inside a slow-rotating group so once
            assembled the globe gently turns. */}
        <g className="pg-globe-spin">
          {wedges.map((w, i) => (
            <g
              key={i}
              className="pg-wedge"
              style={
                {
                  // Each wedge gets its own start translate / rotate via
                  // CSS custom properties consumed by the @keyframes.
                  "--pg-x": `${w.startX}px`,
                  "--pg-y": `${w.startY}px`,
                  "--pg-rot": `${w.startRot}deg`,
                  "--pg-final-rot": `${w.angle}deg`,
                  "--pg-delay": `${w.delay}s`
                } as React.CSSProperties
              }
            >
              {/* The wedge itself, rotated to its final angle so the
                  @keyframes only has to animate FROM-state → identity. */}
              <g transform={`rotate(${w.angle})`}>
                <path
                  d={WEDGE_PATH}
                  fill={`url(#pg-grad-${i})`}
                  stroke="rgba(255,255,255,0.65)"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </g>
            </g>
          ))}

          {/* Spherical shading overlay — fades in AFTER all wedges land
              so the flat circle becomes a sphere. */}
          <circle
            cx="0"
            cy="0"
            r="100"
            fill="url(#pg-shading)"
            className="pg-shade"
            pointerEvents="none"
          />

          {/* MERIDIAN + EQUATOR arcs — fade in last, signal "globe"
              reading. Equator is an ellipse (tilted disk seen from
              slight angle), meridians are vertical ellipses rotated. */}
          <g
            className="pg-grid"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="0.8"
          >
            <ellipse cx="0" cy="0" rx="100" ry="28" />
            <ellipse cx="0" cy="0" rx="28" ry="100" />
            <ellipse
              cx="0"
              cy="0"
              rx="65"
              ry="100"
              transform="rotate(35)"
            />
            <ellipse
              cx="0"
              cy="0"
              rx="65"
              ry="100"
              transform="rotate(-35)"
            />
          </g>
        </g>
      </svg>

      <p
        style={{
          marginTop: 18,
          fontSize: 13,
          color: "var(--text-dim)",
          maxWidth: 380,
          textAlign: "center",
          lineHeight: 1.55,
          fontStyle: "italic"
        }}
      >
        Every twin built. Every connection made. One piece at a time.
      </p>

      <style>{`
        @keyframes pg-wedge-in {
          0% {
            transform: translate(var(--pg-x), var(--pg-y))
              rotate(var(--pg-rot));
            opacity: 0;
          }
          60% {
            opacity: 1;
          }
          88% {
            transform: translate(0, 0) rotate(6deg) scale(1.04);
            opacity: 1;
          }
          100% {
            transform: translate(0, 0) rotate(0deg) scale(1);
            opacity: 1;
          }
        }
        .pg-wedge {
          transform-origin: 0 0;
          opacity: 0;
          animation: pg-wedge-in 1.6s cubic-bezier(0.22, 1, 0.36, 1)
            forwards;
          animation-delay: var(--pg-delay);
        }

        @keyframes pg-shade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .pg-shade {
          opacity: 0;
          animation: pg-shade-in 1.2s ease-out forwards;
          /* After the last wedge (delay 1.12s) + its 1.6s duration */
          animation-delay: 2.4s;
        }

        @keyframes pg-grid-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        .pg-grid {
          opacity: 0;
          transform-origin: 0 0;
          animation: pg-grid-in 1.4s ease-out forwards;
          animation-delay: 2.6s;
        }

        @keyframes pg-globe-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .pg-globe-spin {
          transform-origin: 0 0;
          animation: pg-globe-spin 40s linear infinite;
          /* Don't start spinning until the globe has assembled — same
             stagger as the grid fade-in. */
          animation-delay: 2.6s;
        }

        @media (prefers-reduced-motion: reduce) {
          .pg-wedge,
          .pg-shade,
          .pg-grid {
            animation-duration: 0.01s;
            animation-delay: 0s;
          }
          .pg-globe-spin {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
