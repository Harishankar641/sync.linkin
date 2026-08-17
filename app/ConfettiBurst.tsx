"use client";

/**
 * ConfettiBurst — one-shot celebratory burst. Same visual language as the
 * confetti already shipped in app/ai-knows-me/AiKnowsMeFunnel.tsx, pulled
 * out here so any future "something good just happened" moment (SyncMoment,
 * wins, etc.) can reuse it instead of re-implementing it inline.
 *
 * Renders 22 pieces flying outward from center with randomized angle,
 * distance, rotation, and stagger. Math.random is safe here because this
 * only ever mounts client-side, after a state change (never during SSR).
 */

const CONFETTI_COLORS = ["#6d6df8", "#9aa0ff", "#d83bff", "#5ee5b2", "#ffd166"];

export function ConfettiBurst() {
  const pieces = Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 120 + Math.random() * 160;
    return {
      cx: `${Math.cos(angle) * dist}px`,
      cy: `${Math.sin(angle) * dist * 0.8 - 40}px`,
      cr: `${Math.round(Math.random() * 540 - 270)}deg`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: `${Math.random() * 0.15}s`
    };
  });

  return (
    <>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-burst-piece"
          style={
            {
              background: p.color,
              animationDelay: p.delay,
              "--cx": p.cx,
              "--cy": p.cy,
              "--cr": p.cr
            } as React.CSSProperties
          }
        />
      ))}
      <style>{`
        @keyframes confetti-burst-fly {
          0% {
            transform: translate(-50%, -50%) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + var(--cx)), calc(-50% + var(--cy))) rotate(var(--cr));
            opacity: 0;
          }
        }
        .confetti-burst-piece {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 8px;
          height: 8px;
          border-radius: 2px;
          animation: confetti-burst-fly 2.1s cubic-bezier(0.2, 0.7, 0.4, 1) both;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .confetti-burst-piece { animation: none !important; display: none; }
        }
      `}</style>
    </>
  );
}
