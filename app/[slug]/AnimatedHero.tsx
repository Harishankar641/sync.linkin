"use client";

/**
 * Animated landing hero for /[slug] invite pages.
 *
 * Why client-side: the static OG image (rendered by Next's
 * ImageResponse) handles the link-preview moment. Once the recipient
 * clicks through, they land HERE — and this is where motion pays off.
 * CSS keyframes for: gradient shimmer (14s), infinity drift (12s) +
 * stroke pulse (4s), floating particles (7–10s staggered), typing
 * indicator dots (1.2s). No JS animation libraries — pure CSS so it
 * runs smooth on phones and adds zero runtime cost.
 */

import { useEffect, useState } from "react";

export function AnimatedHero({
  wordmark = "SyncedIn",
  headline,
  body,
  recipientInitials,
  recipientAvatarUrl,
  inviterFirstName,
  inviterAvatarUrl
}: {
  wordmark?: string;
  headline: string;
  body: string;
  recipientInitials: string;
  recipientAvatarUrl: string | null;
  inviterFirstName: string;
  inviterAvatarUrl: string | null;
}) {
  // Only run the heavier particle animations once we're past hydration,
  // so SSR markup matches exactly and we don't pay layout cost on first
  // paint. They fade in within the first second of viewing.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 150);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      className="synced-hero"
      role="img"
      aria-label={`${wordmark} · ${headline}`}
    >
      <style>{`
        .synced-hero {
          position: relative;
          width: 100%;
          aspect-ratio: 1200 / 630;
          border-radius: 18px;
          overflow: hidden;
          background: linear-gradient(135deg, #0a0c24 0%, #1c2050 55%, #3a1a6b 100%);
          background-size: 200% 200%;
          animation: synced-hero-shimmer 14s ease-in-out infinite alternate;
          box-shadow: 0 18px 50px -20px rgba(58,77,255,0.45);
          isolation: isolate;
        }
        .synced-hero-infinity {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          animation: synced-hero-drift 12s ease-in-out infinite;
        }
        .synced-hero-infinity path {
          animation: synced-hero-pulse 4s ease-in-out infinite;
        }
        .synced-hero-particle {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #a06bff;
          filter: blur(0.5px);
          pointer-events: none;
          opacity: 0;
        }
        .synced-hero.mounted .synced-hero-particle {
          opacity: 1;
        }
        .synced-hero-content {
          position: absolute;
          inset: 0;
          padding: 5% 7%;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          z-index: 2;
        }
        .synced-hero-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .synced-hero-wordmark {
          font-size: clamp(20px, 2.6vw, 36px);
          font-weight: 700;
          letter-spacing: -0.01em;
          color: #ffffff;
        }
        .synced-hero-headline {
          font-size: clamp(26px, 4.4vw, 60px);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.015em;
          color: #ffffff;
          margin: 0 0 0.6vw;
        }
        .synced-hero-body {
          font-size: clamp(14px, 2vw, 28px);
          line-height: 1.35;
          color: #cfd5ff;
          margin: 0;
          max-width: 90%;
        }
        .synced-hero-avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: clamp(48px, 7vw, 96px);
          height: clamp(48px, 7vw, 96px);
          border-radius: 50%;
          border: 0.4vw solid #ffffff;
          background: linear-gradient(135deg, #1f8bff, #6b2dc9);
          color: #ffffff;
          font-weight: 800;
          font-size: clamp(18px, 2.4vw, 36px);
          flex-shrink: 0;
          box-shadow: 0 0.8vw 2vw rgba(58,77,255,0.5);
          overflow: hidden;
        }
        .synced-hero-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .synced-hero-typing {
          position: absolute;
          bottom: 5%;
          right: 5%;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: clamp(6px, 0.7vw, 10px) clamp(10px, 1.2vw, 18px);
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          color: #ffffff;
          font-size: clamp(11px, 1.4vw, 18px);
          z-index: 2;
        }
        .synced-hero-typing .dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #ffffff;
          animation: synced-hero-dot 1.2s infinite ease-in-out;
        }
        .synced-hero-typing .dot:nth-child(2) { animation-delay: 0.18s; }
        .synced-hero-typing .dot:nth-child(3) { animation-delay: 0.36s; }
        @keyframes synced-hero-shimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        @keyframes synced-hero-drift {
          0%   { transform: translate(0px, 0px) scale(1); }
          50%  { transform: translate(40px, -20px) scale(1.05); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes synced-hero-pulse {
          0%, 100% { opacity: 0.55; stroke-width: 38; }
          50%      { opacity: 0.95; stroke-width: 46; }
        }
        @keyframes synced-hero-float {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(-180px) translateX(40px); opacity: 0; }
        }
        @keyframes synced-hero-float-2 {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(-220px) translateX(-30px); opacity: 0; }
        }
        @keyframes synced-hero-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30%           { opacity: 1;   transform: translateY(-3px); }
        }
        /* Respect users who've opted out of motion. */
        @media (prefers-reduced-motion: reduce) {
          .synced-hero,
          .synced-hero-infinity,
          .synced-hero-infinity path,
          .synced-hero-particle,
          .synced-hero-typing .dot {
            animation: none !important;
          }
        }
      `}</style>

      <svg
        className="synced-hero-infinity"
        viewBox="0 0 1200 630"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="syncedHeroStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5e8fff" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#a06bff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#5e8fff" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <path
          d="M 250 340 Q 410 180 600 340 Q 790 500 950 340 Q 790 180 600 340 Q 410 500 250 340 Z"
          fill="none"
          stroke="url(#syncedHeroStroke)"
          strokeLinejoin="round"
        />
      </svg>

      <span
        className={`synced-hero-particle${mounted ? "" : ""}`}
        style={{
          left: "18%",
          bottom: "12%",
          animation: "synced-hero-float 7s 0s infinite linear"
        }}
      />
      <span
        className="synced-hero-particle"
        style={{
          left: "34%",
          bottom: "8%",
          animation: "synced-hero-float-2 9s 1.4s infinite linear"
        }}
      />
      <span
        className="synced-hero-particle"
        style={{
          left: "52%",
          bottom: "14%",
          animation: "synced-hero-float 8s 2.7s infinite linear"
        }}
      />
      <span
        className="synced-hero-particle"
        style={{
          left: "68%",
          bottom: "6%",
          animation: "synced-hero-float-2 10s 0.6s infinite linear"
        }}
      />
      <span
        className="synced-hero-particle"
        style={{
          left: "84%",
          bottom: "11%",
          animation: "synced-hero-float 7.5s 3.2s infinite linear"
        }}
      />

      <div className="synced-hero-content">
        <div className="synced-hero-row">
          <div className="synced-hero-wordmark">{wordmark}</div>
          <div className="synced-hero-avatar">
            {recipientAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={recipientAvatarUrl} alt="" />
            ) : (
              recipientInitials
            )}
          </div>
        </div>
        <div>
          <h1 className="synced-hero-headline">{headline}</h1>
          <p className="synced-hero-body">{body}</p>
        </div>
      </div>

      <div
        className="synced-hero-typing"
        aria-label={`${inviterFirstName}'s twin is typing`}
      >
        {inviterFirstName}&apos;s twin&nbsp;
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}
