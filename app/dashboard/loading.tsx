/**
 * Light skeleton for /dashboard (Command Center) route transitions.
 * Jack: the cool animated LoadingScreen is reserved for the save-twin →
 * chat handoff only — everywhere else should feel instant. Skeleton +
 * link prefetch keeps the Command Center snappy.
 */
export default function DashboardLoading() {
  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @keyframes dl-pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 0.85; } }
        .dl-bar { background: var(--panel-2); border-radius: 12px; animation: dl-pulse 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .dl-bar { animation: none; } }
      `}</style>
      <div className="dl-bar" style={{ height: 14, width: 140, marginBottom: 10 }} />
      <div className="dl-bar" style={{ height: 34, width: 280, marginBottom: 22 }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dl-bar" style={{ height: 116 }} />
        ))}
      </div>
      <div className="dl-bar" style={{ height: 120, marginTop: 14 }} />
    </div>
  );
}
