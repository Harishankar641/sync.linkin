/**
 * Light skeleton for /twin route transitions. Jack: the cool animated
 * LoadingScreen is reserved for the save-twin → chat handoff ONLY (shown
 * as a client overlay by OnboardingWizard); every other navigation should
 * feel instant. This near-invisible placeholder + link prefetch keeps
 * hops snappy.
 */
export default function TwinLoading() {
  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <style>{`
        @keyframes tl-pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 0.85; } }
        .tl-bar { background: var(--panel-2); border-radius: 10px; animation: tl-pulse 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .tl-bar { animation: none; } }
      `}</style>
      <div className="tl-bar" style={{ height: 16, width: 120, marginBottom: 18 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="tl-bar" style={{ height: 56, width: "70%", alignSelf: "flex-start" }} />
        <div className="tl-bar" style={{ height: 44, width: "55%", alignSelf: "flex-end" }} />
        <div className="tl-bar" style={{ height: 64, width: "75%", alignSelf: "flex-start" }} />
      </div>
    </div>
  );
}
