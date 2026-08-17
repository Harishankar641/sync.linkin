"use client";

/**
 * OrbitingPlatformUsers — animated SVG-ish orbit of real platform
 * user avatars circling around a central silhouette.
 *
 * Jack: "spinning circles around that self that starts loading and
 * interweaving with those circles. Those circles are actually real
 * other people on the platform. Maybe we could showcase the
 * backgrounds of some of the coolest people."
 *
 * Three concentric rings, each rotates at a different speed.
 * Hovering an avatar reveals the user's name + one-line
 * accomplishment (Jacob Cole — raised $10M; Ken — 200M visits/mo).
 *
 * Used on:
 *  - / (landing) below the hero
 *  - /talk header (smaller)
 *  - Onboarding (post-handle-paste reveal)
 *
 * Server-fetched user list comes in as a prop. If empty, the
 * component renders a placeholder ring with the SyncedIn logo dots
 * so the visual still lands.
 */
import { useEffect, useRef, useState } from "react";

export type OrbitUser = {
  id: string;
  name: string;
  avatar_url: string | null;
  achievement?: string | null;
  handle?: string | null;
};

export function OrbitingPlatformUsers({
  users,
  size = 360,
  totalCount,
  caption = "Already syncing"
}: {
  /** Real platform users — at minimum name + avatar URL. Up to 15
   *  render across 3 concentric rings (5 each). */
  users: OrbitUser[];
  /** Pixel diameter of the OUTER ring. Default 360. */
  size?: number;
  /** Total active twins on the platform (drives the central caption). */
  totalCount?: number;
  /** Top-of-component label. */
  caption?: string;
}) {
  // Top 5/5/5 split across inner/middle/outer rings. Inner uses the
  // SyncedIn logo dots if there's no first user — keeps the central
  // composition balanced even before real data loads.
  const inner = users.slice(0, 5);
  const middle = users.slice(5, 10);
  const outer = users.slice(10, 15);

  const [hovered, setHovered] = useState<OrbitUser | null>(null);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        margin: "0 auto",
        maxWidth: "92vw",
        // Keep aspect square on resize.
        aspectRatio: "1 / 1"
      }}
    >
      {/* Three concentric rings. Each <Ring> spins at its own speed
          and houses N avatars equally spaced around it. The rotation
          counter-spins each AVATAR to keep faces upright (rather than
          tumbling as the ring turns). */}
      <Ring
        users={outer.length ? outer : inner}
        diameter={size}
        avatarSize={Math.round(size * 0.13)}
        durationSec={42}
        direction="normal"
        opacity={0.95}
        onHover={setHovered}
      />
      <Ring
        users={middle.length ? middle : inner.slice().reverse()}
        diameter={size * 0.7}
        avatarSize={Math.round(size * 0.12)}
        durationSec={32}
        direction="reverse"
        opacity={0.92}
        onHover={setHovered}
      />
      <Ring
        users={inner}
        diameter={size * 0.42}
        avatarSize={Math.round(size * 0.11)}
        durationSec={22}
        direction="normal"
        opacity={0.9}
        onHover={setHovered}
      />

      {/* Center — silhouette + the visitor's "you go here" cue. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none"
        }}
      >
        <div
          style={{
            width: Math.round(size * 0.18),
            height: Math.round(size * 0.18),
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, #1f8bff 0%, #6b2dc9 50%, #d83bff 100%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: Math.round(size * 0.05),
            fontWeight: 800,
            letterSpacing: "-0.02em",
            boxShadow:
              "0 0 0 6px rgba(31, 139, 255, 0.10), 0 0 32px rgba(216, 59, 255, 0.35)"
          }}
        >
          you
        </div>
        {typeof totalCount === "number" && totalCount > 0 && (
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-dim)"
            }}
          >
            {totalCount}+ {caption}
          </div>
        )}
      </div>

      {/* Hover card — surfaces the achievement copy for the
          currently-hovered avatar. Positioned at top-center over the
          ring so it doesn't move with rotation. */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            top: -8,
            left: "50%",
            transform: "translate(-50%, -100%)",
            background: "var(--panel-solid)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "8px 12px",
            minWidth: 200,
            maxWidth: 280,
            boxShadow: "0 12px 32px -10px rgba(0,0,0,0.35)",
            zIndex: 10,
            pointerEvents: "none"
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: "var(--text)"
            }}
          >
            {hovered.name}
          </div>
          {hovered.achievement && (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                lineHeight: 1.4,
                color: "var(--text-dim)"
              }}
            >
              {hovered.achievement}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Ring({
  users,
  diameter,
  avatarSize,
  durationSec,
  direction,
  opacity,
  onHover
}: {
  users: OrbitUser[];
  diameter: number;
  avatarSize: number;
  durationSec: number;
  direction: "normal" | "reverse";
  opacity: number;
  onHover: (u: OrbitUser | null) => void;
}) {
  const radius = diameter / 2 - avatarSize / 2 - 4;
  // Stable per-ring keyframe name so multiple rings don't clobber
  // each other's @keyframes.
  const keyId = useStableId();
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: diameter,
        height: diameter,
        marginTop: -diameter / 2,
        marginLeft: -diameter / 2,
        opacity
      }}
    >
      {/* Faint guide ring — subtle hint of the orbit path. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "1px dashed rgba(120,130,160,0.18)"
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          animation: `orbit-${keyId} ${durationSec}s linear infinite ${direction}`
        }}
      >
        {users.map((u, i) => {
          const angle = (i / Math.max(1, users.length)) * Math.PI * 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return (
            <a
              key={u.id}
              href={u.handle ? `/u/${u.handle}` : undefined}
              onMouseEnter={() => onHover(u)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(u)}
              onBlur={() => onHover(null)}
              title={
                u.achievement ? `${u.name} — ${u.achievement}` : u.name
              }
              aria-label={
                u.achievement ? `${u.name}: ${u.achievement}` : u.name
              }
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: avatarSize,
                height: avatarSize,
                marginTop: -avatarSize / 2 + y,
                marginLeft: -avatarSize / 2 + x,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid rgba(31, 139, 255, 0.35)",
                background: "var(--panel-solid)",
                boxShadow:
                  "0 4px 12px -4px rgba(0,0,0,0.25), 0 0 0 2px rgba(255,255,255,0.08)",
                animation: `counter-orbit-${keyId} ${durationSec}s linear infinite ${
                  direction === "normal" ? "reverse" : "normal"
                }`,
                cursor: u.handle ? "pointer" : "default",
                textDecoration: "none",
                color: "inherit",
                display: "block"
              }}
            >
              {u.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={u.avatar_url}
                  alt={u.name}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block"
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: avatarSize * 0.4,
                    fontWeight: 700,
                    color: "var(--text)"
                  }}
                >
                  {u.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </a>
          );
        })}
      </div>
      <style>{`
        @keyframes orbit-${keyId} {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes counter-orbit-${keyId} {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="orbit-${keyId}"], [style*="counter-orbit-${keyId}"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// Stable per-instance ID for scoped @keyframes names. Falls back to
// a random hex string if useId isn't available (e.g. SSR in very old
// React, which this codebase doesn't actually have but defensive).
function useStableId(): string {
  const ref = useRef<string | null>(null);
  if (!ref.current) {
    ref.current = Math.random().toString(36).slice(2, 8);
  }
  // Touch useEffect so hot-reload doesn't fight us.
  useEffect(() => {
    /* no-op */
  }, []);
  return ref.current;
}
