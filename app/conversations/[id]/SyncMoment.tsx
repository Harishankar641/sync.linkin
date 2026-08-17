"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "../../Avatar";
import { ConfettiBurst } from "../../ConfettiBurst";
import { track } from "@/lib/track";

/**
 * SyncMoment — fires once, the instant both participants have accepted a
 * deal (see the bothAccepted effect in ChatUI.tsx). This is deliberately
 * separate from the always-present "deal sealed" pill / SchedulePanel
 * already in ChatUI: those are calm, persistent UI for getting the meeting
 * booked. This is the one-time emotional beat — the payoff for the whole
 * twin-to-twin negotiation — and the moment we ask the user to make the
 * product visible to someone else.
 *
 * Three jobs, top to bottom:
 *   1. Make the AI's reasoning legible (why *your* twin said yes, why
 *      *their* twin said yes) instead of just "deal sealed."
 *   2. One-tap publish to the existing public /wins proof-of-outcome
 *      system (reuses /api/wins/publish — no new backend needed) and hand
 *      back a shareable permalink with its own preview card.
 *   3. One-tap invite, asked at the moment of highest excitement instead
 *      of buried in settings.
 */
export function SyncMoment({
  conversationId,
  selfName,
  otherName,
  otherAvatarUrl,
  otherUserId,
  mySummary,
  otherSummary,
  excitementScore,
  onClose
}: {
  conversationId: string;
  selfName: string;
  otherName: string;
  otherAvatarUrl?: string | null;
  otherUserId: string;
  /** Why your OWN twin said yes — summaryResult.summary. */
  mySummary: string | null;
  /** Your twin's read on the counterpart — summaryResult.counterpart_summary. */
  otherSummary: string | null;
  excitementScore: number | null;
  onClose: () => void;
}) {
  const [publishState, setPublishState] = useState<
    "idle" | "choosing" | "busy" | "done" | "fail"
  >("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function publish(anonymize: boolean) {
    setPublishState("busy");
    setPublishError(null);
    try {
      const res = await fetch("/api/wins/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, anonymize })
      });
      const j = await res.json().catch(() => ({}) as any);
      if (!res.ok) {
        setPublishError(j?.detail || "Couldn't publish, try again.");
        setPublishState("fail");
        return;
      }
      track("win_published", { anonymize, source: "sync_moment" });
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      setShareUrl(j?.id ? `${origin}/win/${j.id}` : `${origin}/wins`);
      setPublishState("done");
    } catch {
      setPublishError("Couldn't publish, try again.");
      setPublishState("fail");
    }
  }

  async function share() {
    if (!shareUrl) return;
    track("win_share_clicked", { source: "sync_moment" });
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "Synced on SyncedIn",
          text: `${selfName} × ${otherName} just synced.`,
          url: shareUrl
        });
        return;
      } catch {
        /* user cancelled the native sheet — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setPublishError(null);
    } catch {
      /* clipboard blocked — the link is already visible + selectable below */
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Deal sealed"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(4,5,10,0.86)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes sync-moment-rise {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sync-moment-card {
          animation: sync-moment-rise 0.38s cubic-bezier(0.2, 0.7, 0.3, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .sync-moment-card { animation: none !important; }
        }
      `}</style>
      <div
        className="retro-panel retro-shadow sync-moment-card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          maxHeight: "88vh",
          overflowY: "auto",
          padding: 26,
          background: "var(--panel-solid)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <ConfettiBurst />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "transparent",
            border: "none",
            color: "var(--text-dim)",
            fontSize: 18,
            cursor: "pointer",
            lineHeight: 1
          }}
        >
          ✕
        </button>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--green)"
            }}
          >
            Deal sealed
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 14
            }}
          >
            <Avatar id={otherUserId} name={otherName} avatarUrl={otherAvatarUrl} size={56} />
          </div>
          <h2
            className="retro-h1"
            style={{
              fontSize: 24,
              fontWeight: 900,
              marginTop: 12,
              letterSpacing: "-0.02em"
            }}
          >
            You're synced with {otherName.split(/\s+/)[0]}
          </h2>
          {typeof excitementScore === "number" && excitementScore > 0 && (
            <div
              style={{
                display: "inline-block",
                marginTop: 8,
                padding: "4px 12px",
                borderRadius: 999,
                border: "1px solid var(--green)",
                color: "var(--green)",
                fontSize: 12,
                fontWeight: 800
              }}
            >
              {excitementScore}/100 sync score
            </div>
          )}
        </div>

        {(mySummary || otherSummary) && (
          <div
            style={{
              marginTop: 20,
              display: "grid",
              gap: 10
            }}
          >
            {mySummary && (
              <div
                className="retro-panel"
                style={{ padding: 12, background: "var(--panel-2)" }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--amber-bright)"
                  }}
                >
                  why your twin said yes
                </div>
                <p style={{ marginTop: 5, fontSize: 13.5, lineHeight: 1.5 }}>
                  {mySummary}
                </p>
              </div>
            )}
            {otherSummary && (
              <div
                className="retro-panel"
                style={{ padding: 12, background: "var(--panel-2)" }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--amber-bright)"
                  }}
                >
                  who {otherName.split(/\s+/)[0]} is, per your twin
                </div>
                <p style={{ marginTop: 5, fontSize: 13.5, lineHeight: 1.5 }}>
                  {otherSummary}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Publish / share. minHeight reserves space across all five
            publishState variants (idle/choosing/busy/fail/done) — each
            renders a different-height block, and without a reserved
            footprint every state change pushed the invite link + close
            button below into a visible jump mid-interaction. */}
        <div style={{ marginTop: 22, minHeight: 92 }}>
          {publishState === "idle" && (
            <button
              type="button"
              onClick={() => setPublishState("choosing")}
              className="retro-btn retro-btn-primary"
              style={{ width: "100%", padding: "11px 16px", fontWeight: 800 }}
            >
              ▤ Publish this as a win
            </button>
          )}
          {publishState === "choosing" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => publish(false)}
                className="retro-btn"
                style={{ flex: 1, padding: "10px 12px", fontSize: 13 }}
              >
                publish with names
              </button>
              <button
                type="button"
                onClick={() => publish(true)}
                className="retro-btn"
                style={{ flex: 1, padding: "10px 12px", fontSize: 13 }}
              >
                publish anonymously
              </button>
            </div>
          )}
          {publishState === "busy" && (
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                color: "var(--text-dim)",
                padding: "10px 0"
              }}
            >
              publishing…
            </div>
          )}
          {publishState === "fail" && (
            <div style={{ textAlign: "center" }}>
              <div
                style={{ fontSize: 12.5, color: "var(--red)", marginBottom: 8 }}
              >
                {publishError}
              </div>
              <button
                type="button"
                onClick={() => setPublishState("choosing")}
                className="retro-btn"
                style={{ padding: "8px 14px", fontSize: 13 }}
              >
                try again
              </button>
            </div>
          )}
          {publishState === "done" && shareUrl && (
            <div>
              <div
                className="retro-panel"
                style={{
                  padding: "8px 10px",
                  fontSize: 12,
                  color: "var(--text-dim)",
                  wordBreak: "break-all"
                }}
              >
                {shareUrl}
              </div>
              <button
                type="button"
                onClick={share}
                className="retro-btn retro-btn-primary"
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "11px 16px",
                  fontWeight: 800
                }}
              >
                ↗ Share your win
              </button>
            </div>
          )}
        </div>

        {/* Invite loop — asked at peak excitement, not in settings. */}
        <Link
          href="/invite"
          onClick={() => track("invite_from_sync_moment_clicked")}
          style={{
            display: "block",
            textAlign: "center",
            marginTop: 14,
            fontSize: 12.5,
            color: "var(--amber-bright)",
            textDecoration: "none",
            fontWeight: 700
          }}
        >
          Know someone who'd want a sync like this? Invite them →
        </Link>

        <button
          type="button"
          onClick={onClose}
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            marginTop: 14,
            background: "transparent",
            border: "none",
            color: "var(--text-dim)",
            fontSize: 12,
            cursor: "pointer"
          }}
        >
          continue to scheduling
        </button>
      </div>
    </div>
  );
}
