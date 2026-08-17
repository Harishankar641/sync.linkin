import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";
import { loadBlendedAiExports } from "@/lib/ai-exports";

/**
 * Self Map — a research-grounded "map of self" derived from the user's
 * twin context. Replaces the old free-form "self graph" constellation
 * with structured psychometrics so the visual means something.
 *
 * Frameworks (all peer-reviewed, widely used):
 *   - Big Five / OCEAN (McCrae & Costa) — trait structure.
 *   - Schwartz Theory of Basic Human Values — what the person prioritizes.
 *   - Self-Determination Theory (Deci & Ryan) — autonomy / competence /
 *     relatedness drives.
 *   - McAdams narrative identity — the one-line life theme.
 *
 * Honesty rule: this is an INFERENCE from limited self-report text, not a
 * validated assessment. The model is instructed to return null for any
 * trait the context doesn't actually support (rendered as "not enough
 * signal yet") rather than hallucinating a number. Confidence scales with
 * how much real context exists.
 */

function heuristicMap(name: string, context: string) {
  const text = context.toLowerCase();
  const has = (words: string[]) => words.some((w) => text.includes(w));
  const score = (positive: string[], negative: string[] = []) => {
    const p = positive.filter((w) => text.includes(w)).length;
    const n = negative.filter((w) => text.includes(w)).length;
    if (p === 0 && n === 0) return null;
    return Math.max(20, Math.min(90, 50 + p * 9 - n * 5));
  };
  const bigFive = [
    { trait: "openness", score: score(["learn", "research", "creative", "ai", "machine learning", "new", "explore", "experiment", "build"]), evidence: "interest in learning and new ideas" },
    { trait: "conscientiousness", score: score(["plan", "deadline", "ship", "production", "organized", "process", "goal", "execute", "project"]), evidence: "goal and execution language" },
    { trait: "extraversion", score: score(["network", "community", "sales", "speaking", "meet", "partnership", "social", "people"]), evidence: "networking and interaction signals" },
    { trait: "agreeableness", score: score(["help", "collaborate", "mentor", "support", "team", "community", "care"]), evidence: "collaboration and support signals" },
    { trait: "neuroticism", score: score(["stress", "worry", "uncertain", "anxious", "overwhelmed"], ["calm", "stable", "confident"]), evidence: "emotional-state language in context" }
  ];
  const values = [
    ["Self-Direction", ["independent", "autonomy", "freedom", "build", "own"]],
    ["Achievement", ["goal", "success", "performance", "career", "ship"]],
    ["Stimulation", ["new", "experiment", "innovation", "explore", "startup"]],
    ["Benevolence", ["help", "mentor", "support", "team", "community"]],
    ["Security", ["stable", "security", "safe", "reliable"]],
    ["Power", ["lead", "leadership", "influence", "scale"]]
  ].map(([name, words]) => ({ name: name as string, score: score(words as string[]) ?? 0, note: `Signals found in your context` }))
    .filter((v) => v.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const drives = [
    { name: "Autonomy", score: score(["independent", "autonomy", "own", "freedom", "build"]), note: "choice and self-direction signals" },
    { name: "Competence", score: score(["learn", "skills", "technical", "build", "expert", "improve", "execute"]), note: "mastery and capability signals" },
    { name: "Relatedness", score: score(["network", "team", "community", "collaborate", "mentor", "people"]), note: "connection and collaboration signals" }
  ];
  const known = bigFive.filter((x) => typeof x.score === "number").length;
  const chars = context.replace(/\s+/g, " ").trim().length;
  const confidence = chars > 1200 && known >= 4 ? "rich" : chars > 350 && known >= 2 ? "forming" : "thin";
  const identity = has(["ai", "machine learning", "data", "software", "build"])
    ? `${name}, you are building capability by turning technical ideas into useful outcomes.`
    : has(["career", "job", "role", "work"])
      ? `${name}, you are shaping a practical career around clear goals and useful work.`
      : "Your Twin is forming a working picture from the context you have provided.";
  const narrative = chars > 80
    ? "This is an inference from your provided context, not a psychological diagnosis. Add more lived examples and corrections to sharpen the portrait."
    : "More context is needed before a meaningful narrative can be inferred.";
  return { name, confidence, identity, narrative, bigFive, values, drives };
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    goals?: string;
    deal_preferences?: string;
    communication_style?: string;
    deal_breakers?: string;
    ai_export_blob?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Blend the per-source AI exports (ChatGPT / Claude / etc. pastes stored
  // in the ai_exports table) with the main dump field. Without this, a
  // user who pasted rich context into the per-source panels saw an empty
  // map — "I posted my output and it's not showing here" (#9). Now the
  // map reads from EVERYTHING the user has pasted, not just the one box.
  let blendedExports: string | null = null;
  try {
    blendedExports = await loadBlendedAiExports(
      user.id,
      body.ai_export_blob ?? ""
    );
  } catch {
    blendedExports = (body.ai_export_blob ?? "").trim() || null;
  }

  let dbTwin: any = null;
  let dbProfile: any = null;
  try {
    const [{ data: ownTwin }, { data: ownProfile }] = await Promise.all([
      supabase.from("twin_profiles").select("goals, deal_preferences, communication_style, deal_breakers, ai_export_blob, hometown, current_city, achievements").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
    ]);
    dbTwin = ownTwin;
    dbProfile = ownProfile;
  } catch {
    // Body values remain the source of truth if the DB read is unavailable.
  }

  const name = (body.name ?? dbProfile?.display_name ?? "").trim() || "you";

  const context = [
    body.goals || dbTwin?.goals ? `Goals: ${body.goals || dbTwin?.goals}` : "",
    body.deal_preferences || dbTwin?.deal_preferences ? `Deal preferences: ${body.deal_preferences || dbTwin?.deal_preferences}` : "",
    body.communication_style || dbTwin?.communication_style ? `Communication style: ${body.communication_style || dbTwin?.communication_style}` : "",
    body.deal_breakers || dbTwin?.deal_breakers ? `Deal breakers: ${body.deal_breakers || dbTwin?.deal_breakers}` : "",
    dbTwin?.hometown ? `From: ${dbTwin.hometown}` : "",
    dbTwin?.current_city ? `Current city: ${dbTwin.current_city}` : "",
    dbTwin?.achievements ? `Achievements: ${dbTwin.achievements}` : "",
    blendedExports || dbTwin?.ai_export_blob ? `AI context dump:\n${(blendedExports || dbTwin?.ai_export_blob || "").slice(0, 12000)}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  // Rough signal size — drives the confidence floor so a one-line goal
  // can't read as a "rich" portrait.
  const signalChars = context.replace(/\s+/g, " ").trim().length;

  if (signalChars < 40) {
    return NextResponse.json(heuristicMap(name, context));
  }

  const system = `You are a careful psychometric profiler. You read a person's self-description and produce a STRUCTURED "map of self" grounded in established frameworks. You infer cautiously from limited self-report text — this is a sketch, not a clinical assessment.

Return ONLY this exact JSON shape, no markdown, no preface:
{
  "identity": "<a single McAdams-style narrative-identity line in second person, ≤16 words, e.g. 'You build leverage by turning scattered effort into compounding systems.' Empty string if context is too thin.>",
  "narrative": "<2 sentences naming the through-line / life theme you actually see in the text. Empty string if too thin.>",
  "bigFive": [
    { "trait": "openness", "score": <0-100 or null>, "evidence": "<≤8 words of why, or empty>" },
    { "trait": "conscientiousness", "score": <0-100 or null>, "evidence": "" },
    { "trait": "extraversion", "score": <0-100 or null>, "evidence": "" },
    { "trait": "agreeableness", "score": <0-100 or null>, "evidence": "" },
    { "trait": "neuroticism", "score": <0-100 or null>, "evidence": "" }
  ],
  "values": [
    { "name": "<one Schwartz value: Self-Direction, Achievement, Power, Stimulation, Hedonism, Security, Conformity, Tradition, Benevolence, or Universalism>", "score": <0-100>, "note": "<≤7 words>" }
  ],
  "drives": [
    { "name": "Autonomy", "score": <0-100 or null>, "note": "<≤7 words>" },
    { "name": "Competence", "score": <0-100 or null>, "note": "" },
    { "name": "Relatedness", "score": <0-100 or null>, "note": "" }
  ]
}

Hard rules:
- ALWAYS return all 5 bigFive traits and all 3 drives in the fixed order above. Use null for score when the text gives you no real signal for that trait — do NOT guess a middling 50.
- "values": return 3 to 6 Schwartz values the text actually supports, highest score first. Skip values with no evidence.
- Scores reflect what the SELF-DESCRIPTION shows, not a flattering portrait. Neuroticism can be low; that's fine.
- Never invent biographical facts. Evidence/notes must be paraphrases of what's in the text.
- Return ONLY the JSON object.`;

  try {
    const r = await anthropic.messages.create({
      model: TWIN_MODEL,
      max_tokens: 1100,
      system,
      messages: [
        {
          role: "user",
          content: `Person's name: ${name}\n\nTheir self-description:\n${context}\n\nReturn the JSON self-map.`
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
      return NextResponse.json({
        name,
        confidence: "thin",
        identity: "",
        narrative: "",
        bigFive: [],
        values: [],
        drives: []
      });
    }
    const parsed = JSON.parse(text.slice(start, end + 1));
    const returnedKnown = (parsed.bigFive ?? []).filter(
      (t: any) => typeof t?.score === "number"
    ).length;
    if (returnedKnown < 2) {
      return NextResponse.json(heuristicMap(name, context));
    }
    // Confidence: how much of the portrait the model could actually fill,
    // floored by raw signal size so a sparse profile can't read "rich".
    const fiveKnown = (parsed.bigFive ?? []).filter(
      (t: any) => typeof t?.score === "number"
    ).length;
    let confidence: "thin" | "forming" | "rich" = "thin";
    if (signalChars > 900 && fiveKnown >= 4) confidence = "rich";
    else if (signalChars > 250 && fiveKnown >= 2) confidence = "forming";
    return NextResponse.json({ name, confidence, ...parsed });
  } catch (e: any) {
    console.error("self-map model inference failed; using transparent heuristic fallback", e);
    return NextResponse.json(heuristicMap(name, context));
  }
}
