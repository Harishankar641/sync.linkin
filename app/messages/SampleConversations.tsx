"use client";

import { useState } from "react";

const samples = [
  {
    name: "Jordan Brooks",
    role: "Angel + advisor",
    score: 87,
    date: "Demo",
    opening: "I'm looking for an investor who can help us validate an AI product for career discovery.",
    reply: "Interesting. Why-now is the strongest question for me. What have you learned from early users that makes this a habit rather than another job-search tool?",
    outcome: "Still negotiating",
  },
  {
    name: "Maya Patel",
    role: "Technical co-founder seeking",
    score: 91,
    date: "Demo",
    opening: "I'm looking for a product partner who can help turn my data and AI background into a focused company.",
    reply: "That could be complementary. I would want to know what you can ship today, what customer domain you understand, and whether you are ready to commit full-time.",
    outcome: "Changed",
  },
  {
    name: "Devon Ramirez",
    role: "B2B Partnerships",
    score: 82,
    date: "Demo",
    opening: "We have an API product and want distribution through companies that already serve developers.",
    reply: "How many active developer customers do you have, and what does the integration partner actually gain? If the economics work, I would propose a 60-day pilot.",
    outcome: "Accepted",
  },
  {
    name: "Riley Kim",
    role: "Engineering Recruiter",
    score: 76,
    date: "Demo",
    opening: "I'm targeting data and software roles where Python, SQL, analytics and AI projects are relevant.",
    reply: "Send me the strongest version of your resume and target role. I would rather make one precise introduction than ten generic ones.",
    outcome: "Still negotiating",
  },
  {
    name: "Sam Chen",
    role: "Seed VC",
    score: 79,
    date: "Demo",
    opening: "We are building an AI infrastructure product and want an investor who can help with technical distribution as well as capital.",
    reply: "Show me the technical wedge, evidence of pull from users, and why this team can win distribution. Then I would want to see retention and capital allocation.",
    outcome: "Still negotiating",
  },
];

export function SampleConversations() {
  const [open, setOpen] = useState<string | null>(samples[0].name);
  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Twin Lab · sample</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Messages your Twin could have</h2>
          <p className="mt-1 text-sm text-white/50">These are clearly marked demo conversations so you can see the intended Twin-to-Twin behavior before real conversations appear here.</p>
        </div>
        <a href="/twin-lab" className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/5">Open Twin Lab</a>
      </div>
      <div className="mt-4 space-y-2">
        {samples.map((s) => {
          const isOpen = open === s.name;
          return (
            <div key={s.name} className="overflow-hidden rounded-xl border border-white/10 bg-black/10">
              <button type="button" onClick={() => setOpen(isOpen ? null : s.name)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white"><span>{s.name}</span><span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-normal text-white/40">DEMO</span></div>
                  <div className="mt-0.5 text-xs text-white/45">{s.role} · {s.date}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3"><span className="text-xs font-semibold text-white/60">{s.score}% sync</span><span className="text-white/35">{isOpen ? "−" : "+"}</span></div>
              </button>
              {isOpen && (
                <div className="border-t border-white/10 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><div className="text-[10px] uppercase tracking-[0.18em] text-white/35">Your Twin</div><p className="mt-2 text-sm leading-6 text-white/75">{s.opening}</p></div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><div className="text-[10px] uppercase tracking-[0.18em] text-white/35">{s.name}'s Twin</div><p className="mt-2 text-sm leading-6 text-white/75">{s.reply}</p></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs"><span className="text-white/40">Outcome</span><span className="rounded-full border border-white/10 px-2.5 py-1 text-white/60">{s.outcome}</span></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
