/**
 * Branded full-area loading screen. Server-safe (pure SVG + CSS keyframes,
 * no JS). Used by route loading.tsx files so the wait between actions feels
 * like the platform is *working* — an orbiting twin + cycling status lines
 * that read as intelligence, not a dead spinner. Jack: "an animated loading
 * screen that shows how intelligent and smart the platform is."
 */
export function LoadingScreen({
  lines = [
    "Mapping your context…",
    "Scanning the network…",
    "Scoring the highest-leverage matches…",
    "Lining up your next move…"
  ]
}: {
  lines?: string[];
}) {
  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: 24
      }}
    >
      <style>{`
        @keyframes cc-orbit { to { transform: rotate(360deg); } }
        @keyframes cc-pulse { 0%,100% { opacity: 0.35; r: 54; } 50% { opacity: 0.9; r: 60; } }
        @keyframes cc-core { 0%,100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.12); opacity: 1; } }
        @keyframes cc-line {
          0%, 4% { opacity: 0; transform: translateY(6px); }
          8%, 22% { opacity: 1; transform: translateY(0); }
          27%, 100% { opacity: 0; transform: translateY(-6px); }
        }
        .cc-line { animation: cc-line 9.2s infinite ease-in-out; }
        @media (prefers-reduced-motion: reduce) {
          .cc-orbit, .cc-line, .cc-core { animation: none !important; }
        }
      `}</style>

      <svg viewBox="0 0 160 160" width="150" height="150" aria-hidden>
        <defs>
          <linearGradient id="cc-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        {/* pulsing halo */}
        <circle cx="80" cy="80" r="56" fill="none" stroke="url(#cc-g)" strokeWidth="2" opacity="0.5" style={{ animation: "cc-pulse 2.4s ease-in-out infinite" }} />
        {/* orbiting dots */}
        <g style={{ transformOrigin: "80px 80px", animation: "cc-orbit 6s linear infinite" }} className="cc-orbit">
          <circle cx="80" cy="20" r="6" fill="#6366f1" />
          <circle cx="80" cy="140" r="4" fill="#8b5cf6" opacity="0.8" />
          <circle cx="140" cy="80" r="3.5" fill="#a78bfa" opacity="0.7" />
        </g>
        {/* core */}
        <circle cx="80" cy="80" r="22" fill="url(#cc-g)" style={{ transformOrigin: "80px 80px", animation: "cc-core 2.4s ease-in-out infinite" }} className="cc-core" />
      </svg>

      <div style={{ position: "relative", height: 26, width: "min(420px, 90vw)" }}>
        {lines.slice(0, 4).map((l, i) => (
          <div
            key={l}
            className="cc-line"
            style={{
              position: "absolute",
              inset: 0,
              textAlign: "center",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-dim)",
              animationDelay: `${i * 2.3}s`
            }}
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
