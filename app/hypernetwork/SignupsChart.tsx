/**
 * Cumulative signups over time as an inline SVG line chart.
 * Server-rendered so it always shows fresh numbers, no external chart lib.
 */
export function SignupsChart({
  points
}: {
  points: { date: string; cumulative: number }[];
}) {
  if (points.length === 0) {
    return (
      <div
        className="retro-panel p-8 text-center text-sm"
        style={{ color: "var(--text-dim)" }}
      >
        No signups yet. The line starts the moment the first human shows up.
      </div>
    );
  }

  // Chart geometry
  const W = 900;
  const H = 280;
  const PAD_L = 50;
  const PAD_R = 20;
  const PAD_T = 24;
  const PAD_B = 36;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const maxY = Math.max(...points.map((p) => p.cumulative), 1);
  // Round max up to a nice tick value.
  const niceMax =
    maxY < 10
      ? 10
      : maxY < 100
      ? Math.ceil(maxY / 10) * 10
      : maxY < 1000
      ? Math.ceil(maxY / 100) * 100
      : Math.ceil(maxY / 1000) * 1000;

  const xFor = (i: number) =>
    PAD_L +
    (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yFor = (v: number) => PAD_T + innerH - (v / niceMax) * innerH;

  // Build the area path under the line and the line itself.
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.cumulative)}`)
    .join(" ");
  const areaPath = `${linePath} L ${xFor(points.length - 1)} ${
    PAD_T + innerH
  } L ${xFor(0)} ${PAD_T + innerH} Z`;

  // Y-axis tick values (5 lines)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(niceMax * t));

  // X-axis labels: first, middle, last
  const firstLabel = points[0].date.slice(5);
  const lastLabel = points[points.length - 1].date.slice(5);
  const midIdx = Math.floor(points.length / 2);
  const midLabel = points[midIdx]?.date.slice(5);

  return (
    <div className="retro-panel retro-shadow p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="retro-label">cumulative signups</div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              marginTop: 4
            }}
          >
            {points[points.length - 1].cumulative.toLocaleString()}
          </div>
        </div>
        <div className="text-xs" style={{ color: "var(--text-dim)" }}>
          {points.length} day{points.length === 1 ? "" : "s"} tracked
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ marginTop: 14, display: "block" }}
      >
        <defs>
          <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a4dff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3a4dff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines + Y axis labels */}
        {ticks.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={i}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray={i === 0 ? "0" : "3 4"}
              />
              <text
                x={PAD_L - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--text-dim)"
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* Filled area under the line */}
        <path d={areaPath} fill="url(#chartArea)" />

        {/* The line itself */}
        <path
          d={linePath}
          fill="none"
          stroke="#3a4dff"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* End-point dot */}
        <circle
          cx={xFor(points.length - 1)}
          cy={yFor(points[points.length - 1].cumulative)}
          r="5"
          fill="#3a4dff"
          stroke="#ffffff"
          strokeWidth="2"
        />

        {/* X-axis labels */}
        <text
          x={xFor(0)}
          y={H - 10}
          textAnchor="start"
          fontSize="11"
          fill="var(--text-dim)"
        >
          {firstLabel}
        </text>
        {points.length > 2 && midLabel && (
          <text
            x={xFor(midIdx)}
            y={H - 10}
            textAnchor="middle"
            fontSize="11"
            fill="var(--text-dim)"
          >
            {midLabel}
          </text>
        )}
        <text
          x={xFor(points.length - 1)}
          y={H - 10}
          textAnchor="end"
          fontSize="11"
          fill="var(--text-dim)"
        >
          {lastLabel}
        </text>
      </svg>
    </div>
  );
}
