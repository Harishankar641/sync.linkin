"use client";

import Link from "next/link";

/**
 * Tiny sidebar-friendly version of the Clone Sync widget. Just a
 * circular progress ring around the user's avatar + percentage +
 * "add context" button. No full figure — the body silhouette was
 * overflowing its container and overlapping sidebar nav items on
 * scroll (Jack: "STILL SAME PROBLEM WHEN GOING TO THE BOTTOM").
 *
 * Pure SVG ring, deterministic % from the same inputs the full
 * SyncMeter uses but rendered without the gradient body that was
 * breaking layout. Hard-clipped to its own card via overflow:hidden
 * + a fixed pixel height for the ring so nothing can escape upward.
 */
export function SyncBadge({
  pct,
  avatarUrl,
  initials
}: {
  pct: number;
  avatarUrl: string | null;
  initials: string;
}) {
  const safe = Math.max(0, Math.min(99, Math.round(pct)));
  const size = 88;
  const stroke = 6;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const dash = (safe / 100) * c;

  return (
    <aside
      style={{
        padding: 10,
        borderRadius: 14,
        background: "var(--panel-solid)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        overflow: "hidden"
      }}
    >
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          flexShrink: 0
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
        >
          <defs>
            <linearGradient id="sb-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1f8bff" />
              <stop offset="60%" stopColor="#6b2dc9" />
              <stop offset="100%" stopColor="#d83bff" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--panel-2)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#sb-ring)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            style={{ transition: "stroke-dasharray 0.4s ease" }}
          />
        </svg>
        {/* Avatar in the center */}
        <div
          style={{
            position: "absolute",
            top: stroke + 4,
            left: stroke + 4,
            right: stroke + 4,
            bottom: stroke + 4,
            borderRadius: "50%",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1f8bff, #6b2dc9)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 18
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 4,
          marginTop: -2
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {safe}%
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-dim)"
          }}
        >
          sync
        </span>
      </div>
      <Link
        href="/onboarding"
        className="retro-btn retro-btn-primary text-center"
        style={{
          width: "100%",
          fontSize: 11.5,
          padding: "7px 10px"
        }}
      >
        + add context
      </Link>
    </aside>
  );
}
