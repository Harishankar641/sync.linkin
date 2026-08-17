"use client";

/**
 * Hypernetwork hero — "what if you could talk to the entire world at
 * once." Redesign May 2026:
 *
 *   - Fixed bug: meridians were all drawn at identical rotation
 *     (rotate(0 ...)) so they stacked on the same vertical line
 *     instead of fanning around the globe. That made the wireframe
 *     read as random scribble. Each meridian now actually rotates.
 *
 *   - Three concentric orbits with deliberate hierarchy:
 *       INNER ring  → 6 "high-affinity" peers (large, bright, named
 *                      initials, thick arc connections that fire often)
 *       MIDDLE ring → 14 "warm" peers (medium dots, occasional pulse)
 *       OUTER ring  → 32 "ambient" peers (small, dim, sparse pulses)
 *
 *   - Connections are CURVED quadratic-bezier arcs instead of straight
 *     lines. Arcs feel like signal flowing across a sphere, not a
 *     spiderweb being torn apart from the middle.
 *
 *   - Radar sweep — a faint conic wedge rotates around the globe every
 *     ~14s. Reads as "your twin scanning the network."
 *
 *   - Center node has a soft halo + double ring + "YOU" label rendered
 *     INSIDE the core, not floating below. The label was getting lost.
 *
 * Pure CSS animations + inline SVG. No canvas, no JS frame loop, no
 * libs. Respects prefers-reduced-motion.
 */

const CENTER_X = 250;
const CENTER_Y = 250;
const INNER_R = 90;
const MIDDLE_R = 150;
const OUTER_R = 210;

type Node = {
  x: number;
  y: number;
  r: number;
  opacity: number;
  delay: string;
  label?: string;
};

// Inner ring — 6 close peers, evenly spaced + each gets a 2-letter
// label so the orbit reads as REAL people, not abstract dots.
const INNER_LABELS = ["MK", "JR", "SY", "EM", "VG", "BN"];
const INNER_NODES: Node[] = INNER_LABELS.map((label, i) => {
  const angle = (i / INNER_LABELS.length) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CENTER_X + Math.cos(angle) * INNER_R,
    y: CENTER_Y + Math.sin(angle) * INNER_R,
    r: 7,
    opacity: 1,
    delay: (i * 0.6).toFixed(2),
    label
  };
});

// Middle ring — 14 warm peers, randomized phase so they don't twinkle
// in lockstep.
const MIDDLE_NODES: Node[] = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + 0.18;
  // Slight radial jitter so it doesn't look like a perfect circle.
  const jitter = ((i * 7919) % 100) / 100 - 0.5;
  const r = MIDDLE_R + jitter * 12;
  return {
    x: CENTER_X + Math.cos(angle) * r,
    y: CENTER_Y + Math.sin(angle) * r * 0.96, // slight squash for 3D
    r: 4,
    opacity: 0.78,
    delay: ((i * 0.41) % 5).toFixed(2)
  };
});

// Outer ring — 32 ambient peers via Fibonacci spiral projected to 2D so
// the distribution looks organic, not gridded.
const OUTER_NODES: Node[] = Array.from({ length: 32 }, (_, i) => {
  const theta = i * 2.3998; // golden angle
  const r = OUTER_R - ((i * 13) % 18); // varied radii for depth
  return {
    x: CENTER_X + Math.cos(theta) * r,
    y: CENTER_Y + Math.sin(theta) * r * 0.92,
    r: 2.4,
    opacity: 0.35,
    delay: ((i * 0.27) % 7).toFixed(2)
  };
});

// Inner connections — 6 always-on curved arcs from center to each inner
// peer, with phase-staggered "pulse" animations.
const INNER_LINKS = INNER_NODES.map((n, i) => ({
  target: n,
  delay: (i * 0.9).toFixed(2),
  duration: (4 + (i % 3)).toFixed(2)
}));

// Middle connections — 8 deterministic picks from the middle ring,
// fire less often so the canvas doesn't get too busy.
const MIDDLE_LINKS = Array.from({ length: 8 }, (_, i) => ({
  target: MIDDLE_NODES[(i * 7 + 2) % MIDDLE_NODES.length],
  delay: ((i * 0.73) % 6).toFixed(2),
  duration: (5 + ((i * 0.6) % 3)).toFixed(2)
}));

// Outer connections — 6 ambient sparse arcs.
const OUTER_LINKS = Array.from({ length: 6 }, (_, i) => ({
  target: OUTER_NODES[(i * 11 + 1) % OUTER_NODES.length],
  delay: ((i * 1.1) % 8).toFixed(2),
  duration: (7 + ((i * 0.5) % 3)).toFixed(2)
}));

function arcPath(x: number, y: number): string {
  // Quadratic bezier with control point offset perpendicular to the
  // chord so the line CURVES instead of being straight. Direction of
  // curve alternates by the target's angle so adjacent arcs lean
  // different ways — gives a "data flowing over a sphere" feel.
  const dx = x - CENTER_X;
  const dy = y - CENTER_Y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return `M ${CENTER_X} ${CENTER_Y} L ${x} ${y}`;
  // Perpendicular unit vector.
  const px = -dy / len;
  const py = dx / len;
  // Bend amount scales with distance — outer arcs curve more.
  const bend = Math.min(60, len * 0.22);
  // Pick side by angle so neighbors don't all curve the same way.
  const side = Math.sin(Math.atan2(dy, dx) * 3) > 0 ? 1 : -1;
  const midX = CENTER_X + dx * 0.5 + px * bend * side;
  const midY = CENTER_Y + dy * 0.5 + py * bend * side;
  return `M ${CENTER_X} ${CENTER_Y} Q ${midX} ${midY} ${x} ${y}`;
}

export function WorldRadarAnimation() {
  return (
    <div className="wra-shell">
      <style>{`
        .wra-shell {
          position: relative;
          width: 100%;
          max-width: 460px;
          aspect-ratio: 1 / 1;
          margin: 0 auto;
        }
        .wra-svg {
          width: 100%;
          height: 100%;
          display: block;
          overflow: visible;
        }
        /* Slow orbital rotation on the wireframe + nodes so the globe
           feels alive without spinning fast enough to be distracting. */
        .wra-globe {
          transform-origin: 250px 250px;
          animation: wra-spin 60s linear infinite;
        }
        @keyframes wra-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        /* Radar sweep — a conic wedge rotates around the center every
           14s, fading the wedge it touches so it reads as a scan. */
        .wra-sweep {
          transform-origin: 250px 250px;
          animation: wra-spin 14s linear infinite;
        }
        @keyframes wra-pulse-center {
          0%, 100% {
            r: 14;
            filter: drop-shadow(0 0 10px rgba(31, 139, 255, 0.7));
          }
          50% {
            r: 17;
            filter: drop-shadow(0 0 22px rgba(31, 139, 255, 1));
          }
        }
        @keyframes wra-halo-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 0.7; transform: scale(1.08); }
        }
        @keyframes wra-node-twinkle {
          0%, 70%, 100% {
            fill-opacity: var(--base-opacity);
            transform: scale(1);
          }
          78%, 82% {
            fill-opacity: 1;
            filter: drop-shadow(0 0 6px #1f8bff);
            transform: scale(1.35);
          }
        }
        @keyframes wra-link-fire {
          0%   { stroke-opacity: 0;    stroke-dasharray: 0 600; }
          18%  { stroke-opacity: 0.95; stroke-dasharray: 220 600; }
          70%  { stroke-opacity: 0.35; stroke-dasharray: 600 0; }
          100% { stroke-opacity: 0;    stroke-dasharray: 600 0; }
        }
        .wra-meridian,
        .wra-parallel {
          fill: none;
          stroke: rgba(31, 139, 255, 0.16);
          stroke-width: 0.8;
        }
        .wra-equator {
          fill: none;
          stroke: rgba(31, 139, 255, 0.32);
          stroke-width: 1.1;
        }
        .wra-outline {
          fill: none;
          stroke: rgba(31, 139, 255, 0.55);
          stroke-width: 1.5;
        }
        .wra-inner-ring {
          fill: none;
          stroke: rgba(107, 45, 201, 0.32);
          stroke-width: 1;
          stroke-dasharray: 3 5;
        }
        .wra-node {
          animation: wra-node-twinkle 4.6s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        .wra-link {
          fill: none;
          stroke-linecap: round;
          stroke-opacity: 0;
          animation-name: wra-link-fire;
          animation-iteration-count: infinite;
          animation-timing-function: ease-out;
          filter: drop-shadow(0 0 3px rgba(31, 139, 255, 0.55));
        }
        .wra-link-inner  { stroke: #1f8bff; stroke-width: 1.8; }
        .wra-link-middle { stroke: rgba(31, 139, 255, 0.7); stroke-width: 1.2; }
        .wra-link-outer  { stroke: rgba(107, 45, 201, 0.55); stroke-width: 0.8; }
        .wra-center {
          fill: url(#wra-core-grad);
          animation: wra-pulse-center 2.8s ease-in-out infinite;
        }
        .wra-center-ring  { fill: none; stroke: rgba(31, 139, 255, 0.55); stroke-width: 1.4; }
        .wra-center-ring2 { fill: none; stroke: rgba(31, 139, 255, 0.28); stroke-width: 1; stroke-dasharray: 2 3; }
        .wra-center-halo {
          fill: url(#wra-halo-grad);
          transform-origin: 250px 250px;
          animation: wra-halo-pulse 3.6s ease-in-out infinite;
        }
        .wra-you-label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.4px;
          fill: #fff;
          text-anchor: middle;
          pointer-events: none;
          user-select: none;
        }
        .wra-peer-label {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.4px;
          fill: rgba(255, 255, 255, 0.85);
          text-anchor: middle;
          pointer-events: none;
          user-select: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .wra-globe, .wra-sweep, .wra-node, .wra-link, .wra-center, .wra-center-halo {
            animation: none;
          }
        }
      `}</style>
      <svg
        className="wra-svg"
        viewBox="0 0 500 500"
        role="img"
        aria-label="Your twin reaching every node in the network simultaneously"
      >
        <defs>
          <radialGradient id="wra-glow-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(31, 139, 255, 0.18)" />
            <stop offset="55%" stopColor="rgba(31, 139, 255, 0.05)" />
            <stop offset="100%" stopColor="rgba(31, 139, 255, 0)" />
          </radialGradient>
          <radialGradient id="wra-halo-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(31, 139, 255, 0.55)" />
            <stop offset="40%" stopColor="rgba(31, 139, 255, 0.18)" />
            <stop offset="100%" stopColor="rgba(31, 139, 255, 0)" />
          </radialGradient>
          <radialGradient id="wra-core-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#7cc3ff" />
            <stop offset="100%" stopColor="#1f8bff" />
          </radialGradient>
          {/* Conic sweep wedge — radial gradient masquerading as a
              conic by being elongated, with one edge bright and the
              rest invisible. The rotating group transforms it around
              the center. */}
          <linearGradient id="wra-sweep-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(31, 139, 255, 0.32)" />
            <stop offset="60%" stopColor="rgba(31, 139, 255, 0.08)" />
            <stop offset="100%" stopColor="rgba(31, 139, 255, 0)" />
          </linearGradient>
        </defs>

        {/* Ambient bloom behind the globe */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={OUTER_R + 70}
          fill="url(#wra-glow-grad)"
        />

        {/* Radar sweep wedge — rotates once every 14s */}
        <g className="wra-sweep">
          <path
            d={`M ${CENTER_X} ${CENTER_Y} L ${
              CENTER_X + OUTER_R + 40
            } ${CENTER_Y - 80} A ${OUTER_R + 40} ${OUTER_R + 40} 0 0 1 ${
              CENTER_X + OUTER_R + 40
            } ${CENTER_Y + 80} Z`}
            fill="url(#wra-sweep-grad)"
            opacity="0.55"
          />
        </g>

        {/* GLOBE WIREFRAME — rotates slowly */}
        <g className="wra-globe">
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={OUTER_R}
            className="wra-outline"
          />

          {/* Latitude rings */}
          {[-0.66, -0.33, 0, 0.33, 0.66].map((latFrac, i) => {
            const lat = (latFrac * Math.PI) / 2;
            const offsetY = OUTER_R * Math.sin(lat) * 0.55;
            const isEquator = latFrac === 0;
            return (
              <ellipse
                key={`lat-${i}`}
                cx={CENTER_X}
                cy={CENTER_Y + offsetY}
                rx={OUTER_R * Math.cos(lat)}
                ry={OUTER_R * Math.cos(lat) * 0.18}
                className={isEquator ? "wra-equator" : "wra-parallel"}
              />
            );
          })}

          {/* Meridians — FIXED rotation transform (was hard-coded to 0). */}
          {[0, 30, 60, 90, 120, 150].map((deg, i) => (
            <ellipse
              key={`lon-${i}`}
              cx={CENTER_X}
              cy={CENTER_Y}
              rx={OUTER_R * 0.32}
              ry={OUTER_R}
              className="wra-meridian"
              transform={`rotate(${deg} ${CENTER_X} ${CENTER_Y})`}
            />
          ))}

          {/* Inner-orbit dashed ring — visual cue that the high-affinity
              peers occupy a special tier. */}
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={INNER_R}
            className="wra-inner-ring"
          />
        </g>

        {/* CONNECTION ARCS — three tiers, ordered back-to-front so
            inner arcs draw above middle/outer. */}
        <g>
          {OUTER_LINKS.map((l, i) => (
            <path
              key={`olink-${i}`}
              d={arcPath(l.target.x, l.target.y)}
              className="wra-link wra-link-outer"
              style={{
                animationDelay: `${l.delay}s`,
                animationDuration: `${l.duration}s`
              }}
            />
          ))}
          {MIDDLE_LINKS.map((l, i) => (
            <path
              key={`mlink-${i}`}
              d={arcPath(l.target.x, l.target.y)}
              className="wra-link wra-link-middle"
              style={{
                animationDelay: `${l.delay}s`,
                animationDuration: `${l.duration}s`
              }}
            />
          ))}
          {INNER_LINKS.map((l, i) => (
            <path
              key={`ilink-${i}`}
              d={arcPath(l.target.x, l.target.y)}
              className="wra-link wra-link-inner"
              style={{
                animationDelay: `${l.delay}s`,
                animationDuration: `${l.duration}s`
              }}
            />
          ))}
        </g>

        {/* NODES — outer / middle / inner, back-to-front */}
        <g>
          {OUTER_NODES.map((n, i) => (
            <circle
              key={`on-${i}`}
              cx={n.x}
              cy={n.y}
              r={n.r}
              className="wra-node"
              fill="#1f8bff"
              style={
                {
                  "--base-opacity": n.opacity.toFixed(2),
                  fillOpacity: n.opacity,
                  animationDelay: `${n.delay}s`
                } as React.CSSProperties
              }
            />
          ))}
          {MIDDLE_NODES.map((n, i) => (
            <circle
              key={`mn-${i}`}
              cx={n.x}
              cy={n.y}
              r={n.r}
              className="wra-node"
              fill="#1f8bff"
              style={
                {
                  "--base-opacity": n.opacity.toFixed(2),
                  fillOpacity: n.opacity,
                  animationDelay: `${n.delay}s`
                } as React.CSSProperties
              }
            />
          ))}
          {INNER_NODES.map((n, i) => (
            <g key={`in-${i}`}>
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r + 4}
                fill="rgba(31, 139, 255, 0.15)"
              />
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                className="wra-node"
                fill="url(#wra-core-grad)"
                style={
                  {
                    "--base-opacity": n.opacity.toFixed(2),
                    fillOpacity: 1,
                    animationDelay: `${n.delay}s`
                  } as React.CSSProperties
                }
              />
              {n.label && (
                <text
                  x={n.x}
                  y={n.y + 3}
                  className="wra-peer-label"
                >
                  {n.label}
                </text>
              )}
            </g>
          ))}
        </g>

        {/* CENTER — halo + double ring + glowing core with YOU label inside */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={48}
          className="wra-center-halo"
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={32}
          className="wra-center-ring2"
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={24}
          className="wra-center-ring"
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={14}
          className="wra-center"
        />
        <text
          x={CENTER_X}
          y={CENTER_Y + 4}
          className="wra-you-label"
        >
          YOU
        </text>
      </svg>
    </div>
  );
}
