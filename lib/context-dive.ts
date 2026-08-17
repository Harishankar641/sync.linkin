/**
 * Context-to-context "dive" — Jack's architecture shift.
 *
 *   Old model: the visible message stack IS the coordination layer.
 *     Each twin-to-twin turn is part search-for-context, part
 *     presentation. Messages get long because they're doing two jobs.
 *
 *   New model: run a ONE-SHOT background analysis on both twins' full
 *     contexts FIRST, producing the underlying alignment (shared
 *     themes, complementary asks/offers, friction, recommended
 *     destination, witty angle). THEN the surface conversation
 *     becomes a 4–6 message witty showcase of what the dive already
 *     discovered — chemistry + alignment, not coordination.
 *
 * Shared between:
 *   - /api/conversations/[id]/context-dive (real twin-to-twin chats)
 *   - /api/demo-conversation (pre-auth /[slug] invite landings)
 *
 * Both call this helper, cache the result on their respective tables,
 * and pass it into a SHORT witty message generator instead of running
 * the old turn-by-turn search.
 */

import { anthropic, TWIN_MODEL } from "@/lib/anthropic";

export type ContextDive = {
  headline: string;
  shared_themes: string[];
  complementary_asks: Array<{
    ask_from: string;
    offer_from: string;
    why: string;
  }>;
  frictions: string[];
  hidden_synergies: string[];
  recommended_destination: string;
  // The "voice" angle the surface conversation should lean into —
  // wry / earnest / dry / playful / hyped — based on both sides' comm
  // styles. Feeds the witty-showcase prompt.
  witty_angle?: string;
  generated_at?: string;
};

export type DiveInput = {
  name_a: string;
  context_a: string; // free-form block: goals, deal prefs, comm style, blob, achievements
  name_b: string;
  context_b: string;
};

/**
 * Run the dive. Returns the structured analysis JSON. Throws on
 * generation/parse failure; callers should wrap in try/catch + degrade
 * to a no-dive path if needed.
 */
export async function runContextDive(input: DiveInput): Promise<ContextDive> {
  const { name_a, context_a, name_b, context_b } = input;
  const systemPrompt = `You're the COORDINATION LAYER between two people's digital twins. You see BOTH sides' full contexts and produce the underlying alignment — what they share, what they could trade, where they would clash, what concrete next step makes sense, and the conversational angle that would actually be FUN for these two to share.

This analysis is the SUBSTRATE under the visible twin-to-twin chat. The surface conversation will be 4–6 SHORT witty messages that SHOWCASE this alignment, not search for it. Your job is to find the real win-win + the right voice.

Return ONLY JSON, no commentary:

{
  "headline": "<=12 words. A single-sentence read on what these two could actually do together. Specific, pointed.",
  "shared_themes": ["<=18 words each. 2–5 substantive overlaps."],
  "complementary_asks": [
    {
      "ask_from": "${name_a}",
      "offer_from": "${name_b}",
      "why": "<=22 words. Why this pairing is concrete + worth doing."
    }
  ],
  "frictions": ["<=22 words each. Real friction — different stages, opposite comm styles, dealbreakers."],
  "hidden_synergies": ["<=22 words each. Non-obvious connections visible only because you see BOTH contexts."],
  "recommended_destination": "<=26 words. The single concrete next step — who does what, on what channel, in what timeframe.",
  "witty_angle": "<=18 words. The shared voice angle the chat between them should lean into. e.g. 'dry pragmatists ribbing each other about their respective grind' or 'two earnest builders nerding out about the same niche.' Specific to these two people."
}

Hard rules:
- No fluff. Every line must reference a specific detail from the context blocks.
- If a section has nothing real, return an empty array. Don't manufacture entries.
- Use ${name_a} and ${name_b} as names exactly.
- recommended_destination must be ACTIONABLE — meeting + topic + channel + timeframe. Not "discuss further."`;

  const userContent = `### ${name_a}\n${context_a}\n\n### ${name_b}\n${context_b}`;

  const response = await anthropic.messages.create({
    model: TWIN_MODEL,
    max_tokens: 2500,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }]
  });
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Dive returned no JSON.");
  }
  const parsed = JSON.parse(text.slice(start, end + 1)) as ContextDive;
  if (
    !parsed ||
    typeof parsed.headline !== "string" ||
    !Array.isArray(parsed.shared_themes) ||
    typeof parsed.recommended_destination !== "string"
  ) {
    throw new Error("Dive JSON missing required fields.");
  }
  parsed.generated_at = new Date().toISOString();
  return parsed;
}

/**
 * Build the SYSTEM PROMPT for the witty showcase conversation. The
 * surface chat assumes the dive already happened — the messages are
 * a presentation of the alignment, not coordination.
 *
 * Returns a 4–6 message twin-to-twin chat:
 *   - Snappy: each message 1–3 sentences max (NOT 2–4 like the old
 *     search-for-context flow).
 *   - Witty: each side leans into the dive's `witty_angle`.
 *   - Specific: references the actual shared theme / complementary
 *     ask the dive identified.
 *   - Lands the proposal on the final message via "PROPOSAL: …" marker.
 */
export function buildWittyShowcasePrompt(
  inviterName: string,
  recipientName: string,
  dive: ContextDive
): { system: string; userIntro: string } {
  const system = `You're generating a SHORT WITTY surface conversation between two digital twins. The COORDINATION layer already ran — you've been handed the dive output that found the underlying alignment, the recommended destination, and the right voice for these two.

Your job is NOT to search for context. The dive did that. Your job is to SHOWCASE the alignment in a way that's fun to read — chemistry, specificity, and the right voice.

Hard rules:
- EXACTLY 5 messages. Alternating senders. Message 1 = "${inviterName}'s twin" (sender: "inviter"). Message 2 = "${recipientName}'s twin" (sender: "recipient"). Continue alternating through 5 total.
- Each message: 1–3 sentences. Punchy. NO em-dashes. NO emojis. NO markdown. NO "I'm Jackson's twin..." preambles.
- The voice angle is: ${dive.witty_angle || "warm + dry + specific"}. Lean into it. Two real people who already get each other, finishing each other's sentences.
- Reference the SPECIFIC shared themes, complementary asks, or hidden synergies the dive found. Not generic chat.
- Skip the discovery beats ("nice to meet you", "tell me about your work"). The dive already knows what they do. Start IN the alignment.
- Message 5 (last) must land the recommended_destination as a clean handoff and END with the literal marker line "PROPOSAL: ${dive.recommended_destination}" so the page can highlight it.

Output format — return ONLY valid JSON, no commentary, no markdown fences:

{
"messages": [
{"sender": "inviter", "text": "..."},
{"sender": "recipient", "text": "..."},
{"sender": "inviter", "text": "..."},
{"sender": "recipient", "text": "..."},
{"sender": "inviter", "text": "..."}
]
}`;

  const userIntro = `=== DIVE OUTPUT (already computed — do NOT re-derive) ===
Headline: ${dive.headline}
Shared themes:
${(dive.shared_themes || []).map((t) => `- ${t}`).join("\n")}
Complementary asks:
${(dive.complementary_asks || [])
  .map((c) => `- ${c.ask_from} needs ↔ ${c.offer_from} brings — ${c.why}`)
  .join("\n")}
Hidden synergies:
${(dive.hidden_synergies || []).map((s) => `- ${s}`).join("\n")}
Frictions to acknowledge (lightly, if at all):
${(dive.frictions || []).map((f) => `- ${f}`).join("\n")}
Recommended destination: ${dive.recommended_destination}
Voice angle: ${dive.witty_angle || "warm, dry, specific"}

Write the 5-message JSON now. Showcase, don't search.`;

  return { system, userIntro };
}
