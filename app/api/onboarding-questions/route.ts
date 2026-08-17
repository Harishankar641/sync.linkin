import { NextResponse } from "next/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";

/**
 * Goal-aware onboarding question generator.
 *
 * Jack: "when someone puts their goals in, maybe we should custom
 * generate the questions we ask based on that specific goal." Instead
 * of one static "what's your number 1 goal?" follow-up, this route
 * takes the user's goal text + (optionally) an intent tile they
 * clicked on the landing (cofounder / investors / advisors / idea)
 * and returns 3-5 tailored follow-up questions Claude designed to
 * sharpen their twin's matchability fast.
 *
 * Input  → POST { goal: string, intent?: "cofounder"|"investors"|"advisors"|"idea"|"" }
 * Output → { questions: Array<{ id, prompt, placeholder?, kind }> }
 *
 * Schema-safe: if anthropic call fails for any reason, returns a
 * static fallback set so onboarding never blocks on a network blip.
 */

export const dynamic = "force-dynamic";

type Question = {
  id: string;
  prompt: string;
  placeholder?: string;
  kind: "short" | "long";
};

const FALLBACK: Record<string, Question[]> = {
  cofounder: [
    {
      id: "stage",
      prompt: "Where are you in the build?",
      placeholder: "pre-idea, prototype, paying users, raised…",
      kind: "short"
    },
    {
      id: "missing_skill",
      prompt: "What skill set are you missing — what would your cofounder bring?",
      placeholder: "deep technical lead, GTM, design, ops…",
      kind: "long"
    },
    {
      id: "equity",
      prompt: "What's the equity split you'd be open to?",
      placeholder: "50/50 only, 40/60 with founder advantage, negotiable…",
      kind: "short"
    },
    {
      id: "year_one",
      prompt: "What does Year 1 look like if it works?",
      placeholder: "What does success in 12 months mean — revenue, users, traction?",
      kind: "long"
    }
  ],
  investors: [
    {
      id: "stage",
      prompt: "What round are you raising / planning to raise?",
      placeholder: "pre-seed, seed, A, secondary…",
      kind: "short"
    },
    {
      id: "amount",
      prompt: "Target raise size + valuation?",
      placeholder: "$500k at $5M cap, $2M at $12M post, undecided…",
      kind: "short"
    },
    {
      id: "ideal_check",
      prompt: "What's your ideal-investor profile? (operator background, geography, sector focus)",
      kind: "long"
    },
    {
      id: "traction",
      prompt: "What traction or signal will the investor need to see to write the check?",
      kind: "long"
    }
  ],
  advisors: [
    {
      id: "domain",
      prompt: "What domain do you need senior pattern-matching on?",
      placeholder: "B2B SaaS pricing, marketplace seeding, late-stage hiring…",
      kind: "long"
    },
    {
      id: "comp",
      prompt: "What can you offer? (equity %, cash, both, just time)",
      placeholder: "0.25–0.5% over 2 yrs, cash retainer, etc.",
      kind: "short"
    },
    {
      id: "frequency",
      prompt: "Expected cadence?",
      placeholder: "monthly call, on-demand text, formal board seat…",
      kind: "short"
    }
  ],
  idea: [
    {
      id: "the_idea",
      prompt: "What's the idea in one sentence?",
      kind: "long"
    },
    {
      id: "builder_profile",
      prompt: "What does the right builder look like to take this with you?",
      placeholder: "technical lead, GTM operator, designer-founder…",
      kind: "long"
    },
    {
      id: "your_part",
      prompt: "What do you bring? (capital, IP, customer relationships, just the idea)",
      kind: "long"
    }
  ],
  "": [
    {
      id: "specific_outcome",
      prompt:
        "What specific outcome are you hoping to find someone for?",
      kind: "long"
    },
    {
      id: "who",
      prompt:
        "Describe the person you're hoping your twin matches you with.",
      kind: "long"
    },
    {
      id: "constraint",
      prompt:
        "What's the dealbreaker — what makes someone NOT the right fit?",
      placeholder: "wrong stage, wrong city, wrong industry…",
      kind: "short"
    }
  ]
};

export async function POST(req: Request) {
  let body: { goal?: string; intent?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const goal = (body.goal ?? "").slice(0, 1200).trim();
  const intent = (body.intent ?? "").trim() as keyof typeof FALLBACK;

  // No goal? Return the intent-based fallback immediately (cheap path).
  if (!goal) {
    return NextResponse.json({
      questions: FALLBACK[intent] ?? FALLBACK[""],
      from: "fallback_no_goal"
    });
  }

  // Goal present — ask Claude to generate tailored questions.
  const intentHint = intent
    ? `\nLanding intent (what they clicked on the homepage): "${intent}"\n`
    : "";

  const systemPrompt = `You are an onboarding interviewer designing follow-up questions to sharpen a person's "twin" profile so it can match them with the RIGHT counterpart on a networking platform.

You receive the user's freeform goal statement and (optionally) an intent label they picked. Return 3 to 5 follow-up questions that, ANSWERED, would let an AI agent representing this person quickly determine fit with any potential counterpart.

GUIDELINES:
- Questions must be SPECIFIC to their stated goal, not generic ("what are your strengths?" is bad).
- Avoid yes/no questions. Each question should pull out a concrete data point: a number, a timeline, a name, a constraint.
- One question MUST pin the OUTCOME: what does a win concretely look like in 30 to 60 days (a number, an artifact, a signed thing)? Matches get scored against this answer, so push for measurable.
- One question MUST pull out what they OFFER the ideal counterpart (the give side: time, capital, skill, audience, access). Matches are exchanges, not requests.
- One question should surface timeline and urgency: when does this stop mattering, what happens if it takes 6 months?
- Mix one-line "short" answers with paragraph "long" answers. Bias toward short for facts (stage, amount, geography) and long for things requiring judgment (ideal counterpart, dealbreaker, success picture).
- Surface dealbreakers — at least one question should flush out what would make a match WRONG.
- Tone: conversational, direct, no buzzwords ("synergies", "leverage", "growth hacking" → no).
- NEVER use em-dashes in prompts or placeholders. Use commas, periods, or parentheses.

OUTPUT: A single JSON object exactly matching this schema:
{
  "questions": [
    { "id": "string-snake-case", "prompt": "string", "placeholder": "string (optional)", "kind": "short" | "long" }
  ]
}
No prose, no markdown fences. Output just the JSON.`;

  const userPrompt = `User goal: "${goal}"${intentHint}\nGenerate the JSON now.`;

  try {
    const completion = await anthropic.messages.create({
      model: TWIN_MODEL,
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    });
    const text = (completion.content as any[])
      .map((b: any) => (b.type === "text" ? b.text : ""))
      .join("");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no_json");
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (
      !Array.isArray(parsed?.questions) ||
      parsed.questions.length < 2 ||
      parsed.questions.length > 8
    ) {
      throw new Error("bad_shape");
    }
    // Lightly normalize
    const questions: Question[] = (parsed.questions as any[]).map((q, i) => ({
      id: String(q.id || `q-${i}`).slice(0, 40),
      prompt: String(q.prompt || "").slice(0, 280),
      placeholder: q.placeholder ? String(q.placeholder).slice(0, 200) : undefined,
      kind: q.kind === "short" ? "short" : "long"
    }));
    return NextResponse.json({ questions, from: "claude" });
  } catch (e: any) {
    return NextResponse.json({
      questions: FALLBACK[intent] ?? FALLBACK[""],
      from: "fallback_after_error",
      error: e?.message ?? String(e)
    });
  }
}
