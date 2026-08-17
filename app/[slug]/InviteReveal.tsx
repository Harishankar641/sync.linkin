"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "../Avatar";
import { DotsLoader } from "../DotsLoader";

/**
 * Animated invite reveal:
 *  1. Inviter's avatar fades in
 *  2. Teaser message types out character-by-character
 *  3. At the truncation point, cycling dots appear briefly
 *  4. Lock panel and the two CTA buttons pop in with a pulsing glow
 *
 * Mobile-friendly: avatar + label stack vertically below sm; CTAs full-width
 * stacked on phones, side-by-side on tablet+.
 */
export function InviteReveal({
  slug,
  inviterId,
  inviterName,
  inviterAvatarUrl,
  teaser,
  remainingSentences
}: {
  slug: string;
  inviterId: string;
  inviterName: string;
  inviterAvatarUrl: string | null;
  teaser: string;
  remainingSentences: number;
}) {
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<
    "typing" | "dotting" | "revealed"
  >("typing");

  // Typewriter effect for the teaser.
  useEffect(() => {
    let i = 0;
    const totalDuration = Math.min(Math.max(teaser.length * 22, 800), 6500);
    const stepMs = Math.max(12, Math.floor(totalDuration / teaser.length));
    const id = setInterval(() => {
      i += 1;
      setTyped(teaser.slice(0, i));
      if (i >= teaser.length) {
        clearInterval(id);
        setPhase("dotting");
        setTimeout(() => setPhase("revealed"), 1100);
      }
    }, stepMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teaser]);

  return (
    <section className="mt-8">
      <div className="retro-label">opening message</div>

      <div
        className="mt-3 retro-panel retro-shadow p-5"
        style={{
          borderColor: "var(--amber)",
          position: "relative"
        }}
      >
        {/* Inviter header: avatar + name */}
        <div className="flex items-center gap-3">
          <Avatar
            id={inviterId}
            name={inviterName}
            avatarUrl={inviterAvatarUrl}
            size={44}
            ringColor="var(--amber)"
          />
          <div
            className="text-xs"
            style={{
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--text-dim)"
            }}
          >
            {inviterName}&apos;s clone
          </div>
        </div>

        {/* Typed message body */}
        <p
          className="text-base leading-relaxed mt-4"
          style={{
            color: "var(--text)",
            whiteSpace: "pre-wrap",
            minHeight: "1.6em"
          }}
        >
          {typed}
          {phase === "typing" && (
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 2,
                height: "1em",
                marginLeft: 2,
                background: "var(--amber)",
                verticalAlign: "text-bottom",
                animation: "syncedin-cursor 0.85s steps(1) infinite"
              }}
            />
          )}
          {/* Trailing dots — present during the brief "dotting" phase
              AND after reveal if the message is truncated, so the user
              sees an ongoing-conversation cue at the end of the cut
              opener instead of a hard stop mid-sentence. */}
          {(phase === "dotting" ||
            (phase === "revealed" && remainingSentences > 0)) && (
            <span
              style={{
                marginLeft: 6,
                color: "var(--text-dim)",
                fontFamily:
                  '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
                verticalAlign: "baseline"
              }}
            >
              <DotsLoader />
            </span>
          )}
        </p>

        {/* Lock + CTA — slides in once typing completes */}
        {remainingSentences > 0 && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: "1px dashed var(--border-bright)",
              opacity: phase === "revealed" ? 1 : 0,
              transform: phase === "revealed"
                ? "translateY(0)"
                : "translateY(10px)",
              transition: "opacity 0.45s ease, transform 0.45s ease",
              pointerEvents: phase === "revealed" ? "auto" : "none"
            }}
          >
            <div
              className="retro-label"
              style={{ color: "var(--amber-bright)" }}
            >
              locked · sign up to read the rest
            </div>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--text-dim)" }}
            >
              There are {remainingSentences} more sentences in this message.
              Sign up and your twin can read all of it AND continue the
              conversation with {inviterName}&apos;s clone, looking for the
              highest win-win between you.
            </p>

            {/* CTA row — stack on mobile, side-by-side on tablet+ */}
            <div
              className="mt-4 flex flex-col sm:flex-row gap-2"
              style={{ position: "relative" }}
            >
              {/* Pulsing glow halo behind the primary CTA */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: -10,
                  borderRadius: 18,
                  pointerEvents: "none",
                  background:
                    "radial-gradient(circle at 25% 50%, rgba(77,140,255,0.35), transparent 55%)",
                  filter: "blur(6px)",
                  animation: "syncedin-cta-pulse 2.6s ease-in-out infinite"
                }}
              />
              <Link
                href={`/login?invite=${slug}`}
                className="retro-btn retro-btn-primary text-center"
                style={{ position: "relative" }}
              >
                + sign up &amp; auto-reply
              </Link>
              <Link
                href={`/login?invite=${slug}`}
                className="retro-btn text-center"
                style={{ position: "relative" }}
              >
                I already have an account
              </Link>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes syncedin-cursor {
          50% { opacity: 0; }
        }
        @keyframes syncedin-cta-pulse {
          0%, 100% {
            opacity: 0.55;
            transform: scale(0.98);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
        }
      `}</style>
    </section>
  );
}
