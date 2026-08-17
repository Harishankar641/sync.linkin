import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AppShell } from "../AppShell";
import { startSampleConversation } from "../dashboard/actions";

const SAMPLE_TWINS = [
  {
    key: "jordan",
    code: "JDEMO TWIN",
    name: "Jordan Brooks",
    role: "Angel + advisor",
    goal: "Write 10–15 angel checks per year into AI-native products I would personally use. Provide GTM and founder coaching to 5–8 active founders.",
    you: "I’m building an AI product for career discovery. We have an early prototype and are validating demand with students and early-career professionals.",
    twin: "Interesting. Why-now is the strongest question for me. What have you learned from the first users that makes you believe this becomes a habit rather than another job-search tool?",
    followup: "If the signal is strong, I would want to understand your distribution loop, founder-market fit, and what you would do with a $50K–$100K angel check."
  },
  {
    key: "maya",
    code: "MDEMO TWIN",
    name: "Maya Patel",
    role: "Technical co-founder seeking",
    goal: "Find a non-technical co-founder with healthcare, legal or enterprise distribution expertise to build an applied-AI company.",
    you: "I have a data and AI background and want to build a product rather than stay only in implementation work.",
    twin: "That could be complementary. I would want to know what domain you understand deeply, what you can ship yourself today, and whether you are ready to commit full-time.",
    followup: "For the right partner I care more about ownership, speed and customer access than another impressive credential."
  },
  {
    key: "devon",
    code: "DDEMO TWIN",
    name: "Devon Ramirez",
    role: "B2B Partnerships",
    goal: "Source 15+ integration and channel partnerships for a developer platform and drive $2M+ in partner-sourced ARR by Q4.",
    you: "We have an API product and want distribution through companies that already serve developers.",
    twin: "That is the kind of partnership I can evaluate quickly. How many active developer customers do you have, and what does the integration partner actually gain?",
    followup: "If the economics work, I would propose a 60-day pilot with a measurable activation target and a clear path to revenue share."
  },
  {
    key: "riley",
    code: "RDEMO TWIN",
    name: "Riley Kim",
    role: "Engineering Recruiter",
    goal: "Place 8–12 senior engineers and engineering leaders per quarter at Series A–C AI startups while building a vetted senior AI engineering network.",
    you: "I’m looking for data, software and QA roles where Python, SQL, analytics and AI projects are relevant.",
    twin: "I can help if the role and company stage line up. What role are you targeting, what compensation band, and which three skills are non-negotiable?",
    followup: "Send me the strongest version of your resume and target role. I would rather make one precise introduction than ten generic ones."
  },
  {
    key: "sam",
    code: "SDEMO TWIN",
    name: "Sam Chen",
    role: "Seed VC",
    goal: "Source and lead seed rounds in AI infrastructure, dev tools and agent frameworks with $500K–$2M lead checks.",
    you: "We are building an AI infrastructure product and are looking for an investor who can help with technical distribution as well as capital.",
    twin: "Show me the technical wedge, evidence that users pull the product rather than merely try it, and why this team can win the distribution problem.",
    followup: "If those answers are strong, I would want to see the architecture, retention and the next 12 months of capital allocation before discussing a lead."
  }
] as const;

export default async function TwinLabPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const [{ data: testPersonas }, { data: personaTwins }, { data: conversations }] = await Promise.all([
    service.from("profiles").select("id, display_name, email").eq("is_test_persona", true).order("display_name", { ascending: true }).limit(30),
    service.from("twin_profiles").select("user_id, goals").limit(100),
    supabase.from("conversations").select("id, participant_a, participant_b, created_at").or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`).order("created_at", { ascending: false }).limit(60)
  ]);

  const personaGoal = new Map((personaTwins ?? []).map((t) => [t.user_id, t.goals ?? ""] as const));
  const testIds = new Set((testPersonas ?? []).map((p) => p.id));
  const testConversations = (conversations ?? []).filter((c) => testIds.has(c.participant_a === user.id ? c.participant_b : c.participant_a));
  const personaByName = new Map((testPersonas ?? []).map((p) => [p.display_name?.split(" — ")[0] ?? "", p] as const));
  const conversationByPersona = new Map(
    testConversations.map((c) => [
      c.participant_a === user.id ? c.participant_b : c.participant_a,
      c
    ] as const)
  );

  return (
    <AppShell>
      <main className="twin-lab-page">
        <div className="twin-lab-page-head">
          <div>
            <div className="twin-lab-kicker">Twin Lab</div>
            <h1>Test your Twin before the real network.</h1>
            <p>Pre-built professional Twins auto-reply from their own goals and context. Stress-test your approach, then take the strongest version into the real network.</p>
          </div>
          <div className="twin-lab-page-actions">
            <Link href="/twin" className="twin-lab-secondary">Edit my Twin</Link>
            <Link href="/hypernetwork" className="twin-lab-primary">Discover network <span>↗</span></Link>
          </div>
        </div>

        <section id="sample-twins" className="twin-lab-category">
          <div className="twin-lab-category-head">
            <div><span className="twin-lab-category-label">Sample Twins</span><h2>Choose a professional scenario</h2></div>
            <span className="twin-lab-count">{SAMPLE_TWINS.length} pre-built scenarios</span>
          </div>
          <div className="twin-lab-grid twin-lab-grid-page">
            {SAMPLE_TWINS.map((sample) => {
              const persona = personaByName.get(sample.name);
              return (
                <article key={sample.key} className="twin-sample-card twin-sample-card-demo">
                  <div className="twin-sample-top">
                    <span className="twin-sample-avatar" aria-hidden="true">{sample.name.slice(0, 1)}</span>
                    <span className="twin-sample-status">{sample.code}</span>
                  </div>
                  <div className="twin-sample-name">{sample.name}</div>
                  <div className="twin-sample-role">{sample.role}</div>
                  <div className="twin-sample-goal">{personaGoal.get(persona?.id ?? "") || sample.goal}</div>
                  {persona && conversationByPersona.has(persona.id) ? (
                    <Link href={`/conversations/${conversationByPersona.get(persona.id)!.id}`} className="twin-live-test twin-live-test-link">
                      Open real messages <span>→</span>
                    </Link>
                  ) : (
                    <form action={startSampleConversation} className="twin-live-test-form">
                      <input type="hidden" name="sampleKey" value={sample.key} />
                      <button type="submit" className="twin-live-test">Start live message test <span>→</span></button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="twin-lab-category twin-lab-conversations">
          <div className="twin-lab-category-head">
            <div>
              <span className="twin-lab-category-label">Live test messages</span>
              <h2>These are real conversations, not demo text</h2>
              <p className="twin-lab-live-copy">Start any sample Twin above and SyncedIn creates a real conversation, sends the turn through the live model API, stores the messages in Supabase, and runs the same agreement / summary flow used by the real network. Recruiter and partner scenarios use the context already in your Twin, so the professional match can be evaluated against your actual roles and goals.</p>
            </div>
            <span className="twin-lab-count">API + model + messages</span>
          </div>
          <div className="twin-live-test-grid">
            {SAMPLE_TWINS.map((sample) => {
              const persona = personaByName.get(sample.name);
              const active = persona ? conversationByPersona.get(persona.id) : null;
              return (
                <article key={sample.key} className="twin-live-thread-card">
                  <div className="twin-live-thread-head">
                    <div>
                      <b>{sample.name}</b>
                      <span>{sample.role}</span>
                    </div>
                    <span className={active ? "twin-live-pill is-live" : "twin-live-pill"}>{active ? "LIVE" : "READY"}</span>
                  </div>
                  {active ? (
                    <Link href={`/conversations/${active.id}`} className="twin-live-open">Open real message thread <span>↗</span></Link>
                  ) : (
                    <p>Click “Start live message test” above. SyncedIn creates the sample Twin on demand if needed, then opens the real conversation and starts the production model flow.</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {testConversations.length > 0 && (
          <section className="twin-lab-category twin-lab-active">
            <div className="twin-lab-category-head">
              <div><span className="twin-lab-category-label">Your tests</span><h2>Continue your real sample conversations</h2></div>
              <span className="twin-lab-count">{testConversations.length} active</span>
            </div>
            <div className="twin-resume-list">
              {testConversations.map((c) => {
                const otherId = c.participant_a === user.id ? c.participant_b : c.participant_a;
                const persona = (testPersonas ?? []).find((p) => p.id === otherId);
                return <Link key={c.id} href={`/conversations/${c.id}`} className="twin-resume-item twin-resume-item-large"><span>resume: </span>{persona?.display_name ?? "Sample Twin"}<b>↗</b></Link>;
              })}
            </div>
          </section>
        )}

        <section className="twin-lab-flow">
          <div><span className="twin-lab-category-label">How the test works</span><h2>Dashboard → Twin Lab → Sample Twin → Conversation</h2></div>
          <div className="twin-lab-flow-steps">
            {[
              ["01", "Dashboard", "Open Twin Lab from your workspace."],
              ["02", "Choose a Twin", "Pick an investor, founder, recruiter or partner."],
              ["03", "Test", "Your Twin enters the conversation using your goals and context."],
              ["04", "Improve", "Edit your Twin, test again, then move into the real network."]
            ].map(([num, title, copy]) => <div key={num} className="twin-lab-flow-step"><span>{num}</span><b>{title}</b><p>{copy}</p></div>)}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
