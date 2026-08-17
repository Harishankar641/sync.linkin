import Link from "next/link";

/**
 * Premium-unlock progress card. Per Jack's referral economy: invite 3
 * users who SIGN UP AND COMPLETE THEIR TWIN, and we auto-promote you
 * to Premium for free. Card lives on the dashboard, renders the
 * progress ring + a copy-CTA pointing at /invite.
 *
 * Server component — receives the computed counts from the dashboard
 * page so it stays inline without an extra round-trip.
 */
export function PremiumProgressCard({
  completedReferrals,
  premium = false
}: {
  /** Number of users who claimed an invite YOU sent AND finished their
   *  twin (twin_profiles.goals is non-null). Computed server-side in
   *  app/dashboard/page.tsx. */
  completedReferrals: number;
  /** Whether the user is already Premium. */
  premium?: boolean;
}) {
  const goal = 3;
  const progress = Math.min(completedReferrals / goal, 1);
  const remaining = Math.max(0, goal - completedReferrals);
  const unlocked = premium || completedReferrals >= goal;

  return (
    <section
      style={{
        padding: "18px 20px",
        borderRadius: 16,
        border: "1px solid var(--border)",
        background:
          "radial-gradient(440px 200px at 100% 0%, rgba(31, 139, 255, 0.10), transparent 70%), var(--panel-solid)"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap"
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#1f8bff"
            }}
          >
            {unlocked ? "premium unlocked" : "premium · referral unlock"}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              marginTop: 4,
              letterSpacing: "-0.005em"
            }}
          >
            {unlocked
              ? "You're on Premium — bigger context, file uploads, advanced generators."
              : `${completedReferrals} of ${goal} referrals — invite ${remaining} more to unlock Premium free.`}
          </div>
          <p
            style={{
              marginTop: 6,
              fontSize: 12.5,
              color: "var(--text-dim)",
              lineHeight: 1.5,
              maxWidth: 520
            }}
          >
            {unlocked
              ? "Thanks for growing the network. Premium stays free as long as your referrals stay onboarded."
              : "Counts when someone signs up via your invite AND finishes their twin. Premium unlocks bigger memory, file context (pitch decks, portfolios, lists of businesses), and advanced personal-intelligence generators."}
          </p>
        </div>
        <div
          style={{
            position: "relative",
            width: 88,
            height: 88,
            flexShrink: 0
          }}
          aria-label={`${completedReferrals} of ${goal} referrals`}
        >
          <svg viewBox="0 0 88 88" width={88} height={88}>
            <circle
              cx={44}
              cy={44}
              r={36}
              fill="none"
              stroke="var(--border)"
              strokeWidth={6}
            />
            <circle
              cx={44}
              cy={44}
              r={36}
              fill="none"
              stroke="#1f8bff"
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={`${(2 * Math.PI * 36 * progress).toFixed(2)} ${(2 * Math.PI * 36).toFixed(2)}`}
              transform="rotate(-90 44 44)"
              style={{ transition: "stroke-dasharray 0.4s ease" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontVariantNumeric: "tabular-nums"
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
              {completedReferrals}
            </span>
            <span
              style={{
                fontSize: 9,
                color: "var(--text-dim)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginTop: 2
              }}
            >
              of {goal}
            </span>
          </div>
        </div>
      </div>
      {!unlocked && (
        <div style={{ marginTop: 14 }}>
          <Link
            href="/invite"
            className="retro-btn retro-btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none"
            }}
          >
            + invite {remaining} more →
          </Link>
        </div>
      )}
    </section>
  );
}
