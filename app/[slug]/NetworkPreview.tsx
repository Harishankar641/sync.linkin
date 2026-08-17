import Link from "next/link";

/**
 * "Other twins waiting for yours" — a teaser of the broader network
 * shown on the /[slug] invite landing page. Addresses the most common
 * recipient objection ("if I only talk to one person via twin, this is
 * a shallower connection"): by showing 6 other twins their twin could
 * also be running conversations with the moment they sign up, the
 * network density becomes the pitch.
 *
 * Click on any card → /login?invite=<slug>&meet=<their-handle>. The
 * recipient signs up, and post-onboarding their twin is auto-queued
 * to start a conversation with the person they clicked, so the
 * action carries through.
 *
 * Server component — receives prefetched candidates from the page.
 */
type Candidate = {
  id: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** Short one-line snippet — what they're working on, what they want.
   *  Pulled from twin_profiles.goals or scrape highlights. */
  blurb: string;
  /** Optional rough match indicator. Not a real pair-score (we don't
   *  have the recipient's twin yet) — more "looks aligned" vs not. */
  matchHint?: string;
};

export function NetworkPreview({
  slug,
  candidates,
  recipientFirst
}: {
  slug: string;
  candidates: Candidate[];
  recipientFirst: string;
}) {
  if (candidates.length === 0) return null;

  return (
    <section className="netprev">
      <style>{`
        .netprev {
          margin-top: 56px;
          padding: 28px clamp(18px, 3vw, 32px);
          border-radius: 22px;
          background:
            radial-gradient(800px 320px at 50% -10%, rgba(31, 139, 255, 0.10), transparent 70%),
            var(--panel-solid);
          border: 1px solid var(--border);
        }
        .netprev-head {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .netprev-eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #1f8bff;
          margin-bottom: 6px;
        }
        .netprev-h2 {
          font-size: clamp(20px, 2.4vw, 26px);
          font-weight: 800;
          letter-spacing: -0.01em;
          margin: 0;
          line-height: 1.2;
        }
        .netprev-sub {
          font-size: 14px;
          color: var(--text-dim);
          line-height: 1.5;
          margin: 6px 0 0;
          max-width: 560px;
        }
        .netprev-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 12px;
        }
        @media (min-width: 640px) {
          .netprev-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1000px) {
          .netprev-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .netprev-card {
          display: block;
          padding: 16px;
          border-radius: 14px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          text-decoration: none;
          color: var(--text);
          transition: transform 0.15s ease, box-shadow 0.15s ease,
            border-color 0.15s ease;
          position: relative;
          overflow: hidden;
        }
        .netprev-card::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(135deg, rgba(31, 139, 255, 0.0), rgba(107, 45, 201, 0.06));
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
        }
        .netprev-card:hover {
          transform: translateY(-2px);
          border-color: rgba(31, 139, 255, 0.45);
          box-shadow: 0 16px 40px -18px rgba(31, 139, 255, 0.30);
        }
        .netprev-card:hover::after { opacity: 1; }
        .netprev-card-top {
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          z-index: 1;
        }
        .netprev-avatar {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          background: linear-gradient(135deg, #1f8bff, #6b2dc9);
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }
        .netprev-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .netprev-name {
          font-size: 14.5px;
          font-weight: 700;
          letter-spacing: -0.005em;
          line-height: 1.2;
          margin: 0;
        }
        .netprev-match {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #1f8bff;
          margin-top: 2px;
        }
        .netprev-blurb {
          margin-top: 12px;
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-dim);
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          position: relative;
          z-index: 1;
        }
        .netprev-cta-row {
          margin-top: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11.5px;
          color: var(--text-dim);
          position: relative;
          z-index: 1;
        }
        .netprev-cta-row .start {
          color: #1f8bff;
          font-weight: 700;
        }
        .netprev-footer {
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid var(--border);
          text-align: center;
          font-size: 13px;
          color: var(--text-dim);
        }
      `}</style>

      <div className="netprev-head">
        <div>
          <div className="netprev-eyebrow">other twins already on syncedin</div>
          <h2 className="netprev-h2">
            {recipientFirst}, your twin could be running these in parallel
            too
          </h2>
          <p className="netprev-sub">
            One conversation with one person isn&apos;t the pitch — the pitch
            is your twin quietly working every relationship that matters
            to you in the background. Tap any card to start a second one.
          </p>
        </div>
      </div>

      <div className="netprev-grid">
        {candidates.map((c) => {
          // Route everyone through /login first — they need to sign up
          // before starting a real second conversation. We pass the
          // target handle as a hint so post-onboarding we can queue up
          // the intro automatically.
          const href = `/login?invite=${slug}${
            c.handle ? `&meet=${encodeURIComponent(c.handle)}` : ""
          }`;
          const initials =
            c.displayName
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p: string) => p[0]?.toUpperCase() ?? "")
              .join("") || "?";
          return (
            <Link key={c.id} href={href} className="netprev-card">
              <div className="netprev-card-top">
                <div className="netprev-avatar" aria-hidden="true">
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatarUrl} alt="" />
                  ) : (
                    initials
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 className="netprev-name">{c.displayName}</h3>
                  {c.matchHint && (
                    <div className="netprev-match">{c.matchHint}</div>
                  )}
                </div>
              </div>
              <p className="netprev-blurb">{c.blurb}</p>
              <div className="netprev-cta-row">
                <span>your twin ↔ theirs</span>
                <span className="start">start →</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="netprev-footer">
        Sign-in required to start a second conversation. Free forever for
        early users.
      </div>
    </section>
  );
}
