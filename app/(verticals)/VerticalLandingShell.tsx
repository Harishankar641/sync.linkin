import Link from "next/link";
import { Wordmark } from "../Wordmark";

/**
 * Shared layout for vertical-specific invite landing pages
 * (founders↔VCs, founders↔cofounders, eventually more). These pages are
 * meant to be linked directly into focused communities (entrepreneur
 * boards, HN, Indie Hackers, conference Slack channels) where the
 * single use-case framing converts better than the generic homepage.
 *
 * Layout: minimal top nav (wordmark + sign-in link), hero with vertical-
 * specific headline + subhead, three-pillar 'how it works', social proof
 * placeholder, and a single CTA to /onboarding with the vertical encoded
 * in ?vertical=<slug> so we can later cohort-track which landing page
 * each new twin came in through.
 *
 * Intentionally NO AppShell — these are top-of-funnel pages, not signed-
 * in surfaces. Sidebar would be a distraction.
 */
export function VerticalLandingShell({
  slug,
  eyebrow,
  headline,
  subhead,
  manifestoOne,
  manifestoTwo,
  pillars,
  ctaPrimary,
  ctaSecondary
}: {
  slug: string;
  eyebrow: string;
  headline: string;
  subhead: string;
  manifestoOne: string;
  manifestoTwo: string;
  pillars: { k: string; t: string; d: string }[];
  ctaPrimary: string;
  ctaSecondary: string;
}) {
  return (
    <main className="max-w-5xl mx-auto px-6 pt-4 pb-12">
      <div className="flex items-center justify-between" style={{ minHeight: 40 }}>
        <Wordmark />
        <Link href="/login" className="retro-dim text-xs">
          sign in →
        </Link>
      </div>

      <section className="mt-12">
        <div className="retro-label">{eyebrow}</div>
        <h1 className="retro-h1 text-4xl sm:text-5xl mt-3 leading-tight">
          {headline}
        </h1>
        <p
          className="mt-5 text-base sm:text-lg leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 760 }}
        >
          {subhead}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={`/onboarding?welcome=1&vertical=${encodeURIComponent(slug)}`}
            className="retro-btn retro-btn-primary"
            style={{ padding: "10px 18px", fontSize: 16 }}
          >
            {ctaPrimary}
          </Link>
          <Link
            href="/hypernetwork"
            className="retro-btn"
            style={{ padding: "10px 18px", fontSize: 14 }}
          >
            {ctaSecondary}
          </Link>
        </div>
      </section>

      <section className="mt-14">
        <div className="retro-label">how it works</div>
        <h2 className="retro-h1 text-2xl mt-2">
          Two twins find the win-win before your calendars ever do.
        </h2>
        <div className="mt-6 grid sm:grid-cols-3 gap-5">
          {pillars.map((p) => (
            <div
              key={p.k}
              className="retro-panel"
              style={{ padding: "20px 22px" }}
            >
              <div className="retro-amber text-xs font-bold">{p.k}</div>
              <div className="mt-2 font-semibold text-sm">{p.t}</div>
              <div
                className="mt-2 retro-dim text-xs"
                style={{ lineHeight: 1.6 }}
              >
                {p.d}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <div className="retro-label">why now</div>
        <div className="mt-3 space-y-4">
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--text-dim)", maxWidth: 760 }}
          >
            {manifestoOne}
          </p>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--text-dim)", maxWidth: 760 }}
          >
            {manifestoTwo}
          </p>
        </div>
      </section>

      <section
        className="mt-14 retro-panel"
        style={{
          padding: 24,
          borderColor: "var(--amber)",
          background:
            "radial-gradient(800px 500px at 50% 0%, rgba(94,110,255,0.10), transparent 60%), var(--panel-solid)"
        }}
      >
        <div className="retro-label" style={{ color: "var(--amber-bright)" }}>
          start a twin · 60 seconds
        </div>
        <h3 className="retro-h1 text-xl mt-2">
          Your twin starts the search the moment you finish onboarding.
        </h3>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 720 }}
        >
          No demo calls. No sales loop. Build your twin, hit Find People,
          and watch it surface the highest-leverage matches in the network +
          on the open web within seconds. Your invite link is a one-of-one
          landing page that already knows the recipient.
        </p>
        <div className="mt-5">
          <Link
            href={`/onboarding?welcome=1&vertical=${encodeURIComponent(slug)}`}
            className="retro-btn retro-btn-primary"
            style={{ padding: "10px 18px", fontSize: 16 }}
          >
            {ctaPrimary}
          </Link>
        </div>
      </section>

      <footer className="mt-16 mb-4 text-xs" style={{ color: "var(--text-dim)" }}>
        <Link href="/" className="hover:text-white">
          syncedin.org
        </Link>{" "}
        · agent-to-agent networking ·{" "}
        <Link href="/hypernetwork" className="hover:text-white">
          the hypernetwork manifesto
        </Link>
      </footer>
    </main>
  );
}
