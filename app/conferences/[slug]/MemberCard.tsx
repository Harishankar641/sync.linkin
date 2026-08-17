"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "../../Avatar";
import { SocialIconRow } from "../../SocialIconRow";

/**
 * MemberCard — the "Tip of their self iceberg" card (Jack's framework)
 * for conference + community pages. Shows about / wants-needs / offers,
 * the member's social links, and "Your Potential Collaboration":
 *   - signed-out viewers see a sign-up CTA (the win-win auto-generates
 *     once they're in)
 *   - signed-in viewers get an on-demand "reveal win-win" button that
 *     matches their twin against this member's via /api/collab-match
 */
type Socials = {
  linkedin_url: string | null;
  x_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  website_url?: string | null;
} | null;

export function MemberCard({
  id,
  name,
  avatarUrl,
  handle,
  isHost,
  about,
  wants,
  offers,
  socials,
  viewerSignedIn,
  isSelf,
  signupHref
}: {
  id: string;
  name: string;
  avatarUrl: string | null;
  handle: string | null;
  isHost: boolean;
  about: string | null;
  wants: string | null;
  offers: string | null;
  socials: Socials;
  viewerSignedIn: boolean;
  isSelf: boolean;
  signupHref: string;
}) {
  const [collab, setCollab] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/collab-match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_user_id: id })
      });
      const j = await res.json().catch(() => ({}) as any);
      setCollab(
        j?.collaboration ||
          j?.detail ||
          "Couldn't generate the win-win right now — try again."
      );
    } catch {
      setCollab("Couldn't generate the win-win right now — try again.");
    } finally {
      setLoading(false);
    }
  }

  const Row = ({ label, value }: { label: string; value: string | null }) =>
    value ? (
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-dim)"
          }}
        >
          {label}
        </div>
        <div
          style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text)" }}
        >
          {value}
        </div>
      </div>
    ) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 16,
        borderRadius: 14,
        background: "var(--panel-solid)",
        border: isHost ? "1px solid var(--amber)" : "1px solid var(--border)"
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Avatar id={id} name={name} avatarUrl={avatarUrl} size={44} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 15,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {name}
          </div>
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}
          >
            {isHost && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--amber-bright)"
                }}
              >
                host
              </span>
            )}
            {socials && <SocialIconRow urls={socials} size={13} gap={4} />}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--amber-bright)"
        }}
      >
        ▲ tip of their self iceberg
      </div>
      <Row label="About" value={about} />
      <Row label="Wants / needs" value={wants} />
      <Row label="Offers" value={offers} />
      {!about && !wants && !offers && (
        <div
          style={{ marginTop: 8, fontSize: 12, color: "var(--text-dim)", fontStyle: "italic" }}
        >
          Twin still forming — check back soon.
        </div>
      )}

      {/* Your Potential Collaboration */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid var(--border)"
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--green)"
          }}
        >
          ◇ The rest of the iceberg
        </div>
        {isSelf ? (
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-dim)" }}>
            This is you — others will see their win-win with you here.
          </div>
        ) : !viewerSignedIn ? (
          <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.5 }}>
            <Link
              href={signupHref}
              style={{ color: "var(--amber-bright)", fontWeight: 700, textDecoration: "none" }}
            >
              Sign up
            </Link>{" "}
            and your context merges with {name.split(/\s+/)[0]}&apos;s —
            auto-generating your shared potential and surfacing the
            collaborations and win-win opportunities worth exploring.
          </div>
        ) : collab ? (
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: "var(--text)" }}>
            {collab}
          </div>
        ) : (
          <button
            type="button"
            onClick={reveal}
            disabled={loading}
            className="retro-btn retro-btn-primary"
            style={{ marginTop: 8, fontSize: 12, padding: "7px 12px" }}
          >
            {loading ? "Finding the win-win…" : "✦ Reveal our win-win"}
          </button>
        )}
      </div>
    </div>
  );
}
