"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated stat tile — number ticks up from 0 to `value` when it scrolls
 * into view, with an optional sparkline beneath showing day-by-day
 * movement. Reusable across /invite, /hypernetwork, conference pages,
 * and any other surface that wants stats to feel alive instead of
 * static.
 *
 * Behavior:
 *   - IntersectionObserver watches the tile. On first intersection it
 *     animates 0 → value over ~900ms via easeOutQuart.
 *   - prefers-reduced-motion respected (jumps straight to the value).
 *   - Sparkline renders inline SVG when `daily` is non-empty. Last
 *     point gets a small dot. Y-axis auto-scales to the series max.
 *
 * The component is intentionally fully client-side so server components
 * can pass values + daily arrays without thinking about hydration.
 */
export function AnimatedStat({
  label,
  value,
  sub,
  hint,
  daily,
  accent = "#1f8bff",
  formatValue
}: {
  label: string;
  value: number;
  sub?: string;
  hint?: string;
  /** Optional time series (oldest → newest). Renders a sparkline if
   *  present and contains at least 2 points. */
  daily?: number[];
  accent?: string;
  /** Custom formatter — defaults to value.toLocaleString(). Use for
   *  percentages, currency, etc. */
  formatValue?: (n: number) => string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Respect reduced-motion: jump straight to the final value.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(value);
      setHasAnimated(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            const start = performance.now();
            const duration = 900;
            const from = 0;
            const to = value;
            const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
            // Arrow assignment — `function tick(...)` inside the block
            // fails TS strict mode against ES5 target. Same behavior.
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / duration);
              const v = from + (to - from) * easeOutQuart(t);
              setShown(v);
              if (t < 1) requestAnimationFrame(tick);
              else setShown(to);
            };
            requestAnimationFrame(tick);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, hasAnimated]);

  const formatter =
    formatValue ??
    ((n: number) => Math.round(n).toLocaleString());

  // Build sparkline path if we have ≥2 daily data points.
  let sparklinePath: string | null = null;
  let lastPoint: { x: number; y: number } | null = null;
  if (Array.isArray(daily) && daily.length >= 2) {
    const w = 100;
    const h = 28;
    const max = Math.max(...daily, 1);
    const step = w / (daily.length - 1);
    const points = daily.map((d, i) => {
      const x = i * step;
      const y = h - (d / max) * (h - 2) - 1;
      return [x, y] as const;
    });
    sparklinePath = points
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
    const last = points[points.length - 1];
    lastPoint = { x: last[0], y: last[1] };
  }

  return (
    <div
      ref={ref}
      className="retro-panel animated-stat"
      style={{
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minHeight: 124
      }}
      title={hint}
    >
      <div
        className="retro-label"
        style={{ color: "var(--text-dim)" }}
      >
        {label}
      </div>
      <div
        className="retro-h1"
        style={{
          fontSize: 32,
          lineHeight: 1,
          marginTop: 2,
          fontVariantNumeric: "tabular-nums"
        }}
      >
        {formatter(shown)}
      </div>
      {sparklinePath && (
        <svg
          viewBox="0 0 100 30"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{
            width: "100%",
            height: 28,
            marginTop: 2,
            opacity: hasAnimated ? 1 : 0,
            transition: "opacity 0.4s ease 0.4s"
          }}
        >
          <defs>
            <linearGradient
              id={`spark-fill-${label.replace(/[^a-z]/gi, "")}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={accent} stopOpacity="0.20" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Fill area beneath the line */}
          <path
            d={`${sparklinePath} L100,30 L0,30 Z`}
            fill={`url(#spark-fill-${label.replace(/[^a-z]/gi, "")})`}
          />
          <path
            d={sparklinePath}
            fill="none"
            stroke={accent}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {lastPoint && (
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={1.8}
              fill={accent}
            />
          )}
        </svg>
      )}
      {sub && (
        <div
          className="text-xs"
          style={{ color: accent, marginTop: 2 }}
        >
          {sub}
        </div>
      )}
      {hint && (
        <div
          className="text-xs"
          style={{ color: "var(--text-dim)", lineHeight: 1.4 }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
