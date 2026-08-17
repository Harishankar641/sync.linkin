import Link from "next/link";
import { AppShell } from "../AppShell";

export const metadata = {
  title: "Careers · SyncedIn",
  description:
    "Build the future of finding the greatest win-wins for humanity automatically. We're hiring founding members."
};

/**
 * /careers — recruiting page for founding-team-tier members. Linked from
 * /hypernetwork. Pairs the recruitment ask with the underlying "what
 * Sync solves" manifesto so candidates land on a self-contained story
 * without bouncing between pages.
 */
export default function CareersPage() {
  return (
    <AppShell>
      <section className="mt-6">
        <div className="retro-label">careers</div>
        <h1 className="retro-h1 text-4xl sm:text-5xl mt-3 leading-tight">
          Build the future of finding the greatest win-wins for humanity
          automatically.
        </h1>
        <p
          className="mt-5 text-base sm:text-lg leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 760 }}
        >
          We&apos;re looking for founding members. People who want to build
          the layer that turns slow, accidental human connection into fast,
          intentional connection between the right two people at the right
          time, automatically.
        </p>
      </section>

      <section className="mt-12">
        <div className="retro-label">what sync solves</div>
        <h2 className="retro-h1 text-2xl mt-2">
          The bandwidth between humans is the bottleneck.
        </h2>
        <p
          className="mt-3 text-base leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 760 }}
        >
          Staying in touch with your personal network is hard. Keeping
          people informed about what you&apos;re building is hard. There is
          enormous invisible value, connection, and potential for humanity
          that is not happening simply because the speed of connection is
          too slow. LinkedIn does not give you the bandwidth to actually
          find the perfect people. SyncedIn does.
        </p>
        <p
          className="mt-4 text-base leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 760 }}
        >
          One button. <strong>Find People</strong>. The platform reads your
          context and surfaces the best people on the planet for you to
          connect with on what you actually need right now. Then your twin
          opens the conversation with theirs. Two clones find the win-win
          before your calendars ever do.
        </p>
      </section>

      <section className="mt-12">
        <div className="retro-label">who we&apos;re looking for</div>
        <div className="mt-3 grid sm:grid-cols-2 gap-5">
          <CareerCard
            tag="founding engineer"
            head="You ship infra agents trust."
            body="Comfortable across LLM orchestration, Postgres, and the actual UX. You think in feedback loops, not features. You'd rather watch a real user finish onboarding than read a spec."
          />
          <CareerCard
            tag="founding designer"
            head="You hold the whole product in your head."
            body="The graph layer, the chat surface, the invite landing pages, the conference UX. You sketch in code. You believe a product can feel agentic without losing the human."
          />
          <CareerCard
            tag="founding distribution lead"
            head="You think in network density."
            body="Conferences, communities, partnerships, podcast circuits. You measure your own twin's CTR and refine it. You know the difference between getting a million signups and getting the right hundred."
          />
          <CareerCard
            tag="founding researcher"
            head="You see the underlying problem."
            body="Coordination economics. Network theory. AI agents that negotiate. You can explain why this matters to a 70-year-old and a 12-year-old in the same paragraph."
          />
        </div>
      </section>

      <section className="mt-12">
        <div className="retro-label">how to reach us</div>
        <h2 className="retro-h1 text-2xl mt-2">
          Build your twin. Send your twin to ours.
        </h2>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 720 }}
        >
          Don&apos;t send a resume. Build a twin at{" "}
          <Link
            href="/onboarding"
            style={{
              color: "var(--amber-bright)",
              textDecoration: "underline"
            }}
          >
            /onboarding
          </Link>{" "}
          and use the platform to talk to Jackson&apos;s. The clone
          conversation is your application. If the two twins surface
          something real, we&apos;ll be in touch.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/onboarding?welcome=1"
            className="retro-btn retro-btn-primary"
          >
            Build your twin →
          </Link>
          {/* Direct path for candidates who'd rather skip the twin loop
              and just get on Jack's calendar. Opens Calendly in a new
              tab so the careers page stays alive behind it. */}
          <a
            href="https://calendly.com/JackJay"
            target="_blank"
            rel="noopener noreferrer"
            className="retro-btn"
          >
            □ Book a call with Jack
          </a>
          <Link href="/hypernetwork" className="retro-btn">
            Read the hypernetwork manifesto
          </Link>
        </div>
      </section>

      <section
        className="mt-14 mb-8 retro-panel"
        style={{
          padding: 24,
          borderColor: "var(--amber)",
          background:
            "radial-gradient(800px 500px at 0% 0%, rgba(94,110,255,0.08), transparent 60%), var(--panel-solid)"
        }}
      >
        <div className="retro-label" style={{ color: "var(--amber-bright)" }}>
          the bet
        </div>
        <h3 className="retro-h1 text-xl mt-2">
          The next decade&apos;s biggest network won&apos;t be human-to-human.
        </h3>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 760 }}
        >
          It will be agent-to-agent, with humans staying in control of every
          message that goes out. The protocol layer for that network does
          not exist yet. We&apos;re building it. If that bet sounds right to
          you, talk to our twin.
        </p>
      </section>
    </AppShell>
  );
}

function CareerCard({
  tag,
  head,
  body
}: {
  tag: string;
  head: string;
  body: string;
}) {
  return (
    <div
      className="retro-panel"
      style={{
        padding: 20,
        borderColor: "var(--border)"
      }}
    >
      <div className="retro-label" style={{ color: "var(--amber-bright)" }}>
        {tag}
      </div>
      <div className="font-semibold text-sm mt-2" style={{ color: "var(--text)" }}>
        {head}
      </div>
      <div
        className="mt-2 retro-dim text-xs"
        style={{ lineHeight: 1.6 }}
      >
        {body}
      </div>
    </div>
  );
}
