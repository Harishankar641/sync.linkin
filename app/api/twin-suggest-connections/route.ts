import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";
import { exaPeopleSearch, type ExaPerson } from "@/lib/exa";
import type { Profile, TwinProfile } from "@/lib/types";

/**
 * Twin-powered connection suggestions.
 *
 * Pipeline:
 *  1. Read the user's twin context (goals, deal preferences, etc.).
 *  2. Ask Claude to propose 3-4 search queries describing the kinds of people
 *     this user should connect with right now.
 *  3. Run each query through Exa in parallel.
 *  4. Merge + dedupe results and return grouped by query, so the UI can show
 *     "[rationale] → [matched people]".
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Optional custom intent — e.g. "founders in fintech", "investors who back
  // AI music platforms", "biotech CEOs with humanitarian focus". If present,
  // the twin's plan must respond to it directly while still using the user's
  // own context as the lens.
  let body: { intent?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* no body is fine — open-ended planning */
  }
  const intent = (body.intent ?? "").trim().slice(0, 280);

  const service = createServiceClient();
  const [{ data: profile }, { data: twin }] = await Promise.all([
    service.from("profiles").select("*").eq("id", user.id).single(),
    service
      .from("twin_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);
  const p = profile as Profile;
  const t = twin as TwinProfile | null;
  const selfName = p?.display_name || p?.email || "the user";

  if (!t?.goals) {
    return NextResponse.json(
      { error: "twin_incomplete", detail: "Fill in goals first." },
      { status: 400 }
    );
  }

  // Step 1: Claude proposes the search queries.
  const intentBlock = intent
    ? `\n\n# PRIMARY DIRECTIVE FROM ${selfName.toUpperCase()}\n${selfName} wants you to find people that match this specific intent: "${intent}". Every suggestion MUST serve this intent. Use ${selfName}'s context above only as the lens that sharpens the search, not as a constraint that overrides the intent.`
    : "";

  const planPrompt = `You are ${selfName}'s digital twin.

Your job is to determine WHO can help ${selfName} achieve their current objective.

# USER CONTEXT

Name:
${selfName}

Long-term goals:
${t.goals}

Deal preferences:
${t.deal_preferences || "(not specified)"}

Deal-breakers:
${t.deal_breakers || "(not specified)"}

Portfolio, skills, projects, experience and other context:
${(t.ai_export_blob || "").slice(0, 6000)}

${intent
  ? `
# PRIMARY USER INTENT

The user explicitly asked:

"${intent}"

THIS INTENT IS THE PRIMARY DIRECTIVE.

You MUST preserve the important entities, roles, technologies,
companies, industries and constraints contained in the user's intent.

Do NOT replace the user's intent with a different networking goal.

You may use the user's profile, portfolio, skills, projects and
experience to make the searches more precise, but the user's
explicit intent must remain the center of every search.

For example, if the user says:

"AI engineers building RAG systems at Microsoft"

the searches should remain focused on:

- AI engineers
- RAG
- Microsoft

Good searches include:

"AI engineers building RAG systems at Microsoft"
"Microsoft AI engineers RAG LLM systems"
"Microsoft engineers production RAG applications"
"Microsoft RAG engineers Azure AI Search"

Bad searches would be unrelated searches such as:

"software engineer referral network India"
"AI founders"
"data analysts"
"general AI engineers"

unless those are explicitly requested by the user.
`
  : `
# NO EXPLICIT INTENT

The user did not provide a specific search intent.

Use the user's goals, portfolio, skills, projects and experience
to determine the most valuable people for the user to meet.
`}

# SEARCH STRATEGY

Generate 3 or 4 searches.

Each search must identify a concrete person archetype and remain
faithful to the user's current objective.

For career objectives, consider:
- hiring managers
- recruiters
- senior professionals
- technical leaders
- relevant domain experts

For technical learning objectives, consider:
- engineers
- researchers
- technical leaders
- founders building the relevant technology

For collaboration objectives, consider:
- builders
- founders
- product leaders
- technical experts

Do not blindly search for people with the same job title.
Find people who can realistically help achieve the objective.

# OUTPUT

Return ONLY valid JSON with this exact shape:

{
  "suggestions": [
    {
      "rationale": "<10-20 word first-person explanation>",
      "search_query": "<4-12 word concrete search query>"
    }
  ]
}

Rules:
- Generate exactly 3 or 4 suggestions.
- Keep every search tightly related to the user's explicit intent.
- Do not invent a different objective.
- Do not add unrelated industries or roles.
- Use concrete role + technology + company/domain signals.
- The rationale must be written from ${selfName}'s point of view.
`;

  type Plan = { rationale: string; search_query: string };
  let plan: Plan[] = [];
  try {
    const r = await anthropic.messages.create({
      model: TWIN_MODEL,
      max_tokens: 700,
      system: planPrompt,
      messages: [
        { role: "user", content: "Return the JSON plan now." }
      ]
    });
    const text = r.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      const parsed = JSON.parse(text.slice(start, end + 1));
      plan = (parsed.suggestions as Plan[]) ?? [];
    }
  } catch (e: any) {
    console.error("twin-suggest plan error", e);
    return NextResponse.json(
      { error: "plan_failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }

  if (!plan.length) {
    return NextResponse.json({ suggestions: [] });
  }

  // Step 2: run all Exa searches in parallel.
  const searches = await Promise.all(
    plan.map(async (s) => {
      try {
        const people = await exaPeopleSearch(s.search_query, 6);
        return { ...s, people };
      } catch (e) {
        console.error("twin-suggest exa search failed for", s.search_query, e);
        return { ...s, people: [] as ExaPerson[] };
      }
    })
  );

  return NextResponse.json({ suggestions: searches });
}
