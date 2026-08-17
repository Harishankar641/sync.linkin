import { NextResponse } from "next/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";

/**
 * No-auth portfolio teaser generator for the /generate-free-portfolio
 * funnel. A visitor pastes their "personal intelligence" (ChatGPT/Claude
 * memory, bio, anything) and we instantly generate a portfolio teaser —
 * headline + about + a few highlights — so they SEE the value before
 * signing up. No DB write; the full portfolio builds during onboarding
 * once they claim it.
 *
 * POST { name, dump } → { headline, about, highlights[] }
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { name?: string; dump?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = (body.name ?? "").toString().trim().slice(0, 80);
  const dump = (body.dump ?? "").toString().trim().slice(0, 8000);
  if (dump.length < 20) {
    return NextResponse.json({
      error: "thin",
      detail: "Paste a bit more about yourself to generate your portfolio."
    });
  }

  const system = `You generate a punchy professional PORTFOLIO teaser from a person's pasted notes. Return ONLY this JSON, no markdown:
{
  "headline": "<one vivid line that captures who they are, ≤12 words>",
  "about": "<2-3 sentences, second person ('You ...'), concrete and specific to what they pasted — no fluff>",
  "highlights": ["<3 to 4 short punchy credibility bullets pulled from the text: builds, wins, roles, numbers>"],
  "people": [{ "name": "<a person explicitly NAMED in the text>", "why": "<8 words max on why they matter to this person>" }]
}
Rules: Specific, grounded in the text. Never invent facts. "people" may ONLY contain real humans explicitly named in the pasted text (max 5, empty array if none, exclude the subject themselves and company names). NEVER use em-dashes (—); use periods or commas. Return ONLY the JSON.`;

  try {
    const r = await anthropic.messages.create({
      model: TWIN_MODEL,
      max_tokens: 900,
      system,
      messages: [
        {
          role: "user",
          content: `Name: ${name || "(unknown)"}\n\nWhat they pasted:\n${dump}\n\nReturn the JSON.`
        }
      ]
    });
    const text = r.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return NextResponse.json({ error: "generation_failed" }, { status: 500 });
    }
    const parsed = JSON.parse(text.slice(start, end + 1));
    return NextResponse.json({
      headline: String(parsed.headline ?? "").slice(0, 160),
      about: String(parsed.about ?? "").slice(0, 600),
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.slice(0, 4).map((h: any) => String(h).slice(0, 160))
        : [],
      people: Array.isArray(parsed.people)
        ? parsed.people
            .slice(0, 5)
            .map((p: any) => ({
              name: String(p?.name ?? "").slice(0, 60),
              why: String(p?.why ?? "").slice(0, 80)
            }))
            .filter((p: { name: string }) => p.name.length > 1)
        : []
    });
  } catch (e: any) {
    console.error("portfolio-preview error", e);
    return NextResponse.json(
      { error: "generation_failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
