/**
 * DM twin prompt — what Claude sees when a STRANGER lands on
 * /dm/<handle> and starts talking to the creator's twin (#279,
 * Link.me partnership surface).
 *
 * Distinct from the twin-to-twin prompt in lib/twin-prompt.ts:
 *   - Counterpart is an UNKNOWN visitor, not another modeled twin
 *   - Goal is conversion + routing, not finding mutual win-wins
 *   - Twin should push visitors back to the creator's existing offer
 *     links when relevant ("based on that, send me through here →")
 *   - When the convo gets serious / specific, twin should surface the
 *     "boost to top of inbox" upsell so the visitor pays for the real
 *     creator to engage
 *
 * The router behavior is what makes the Link.me pitch real ("we
 * increase revenue per visit"). Without it, this is just chat.
 */

import type { Profile } from "./types";

export type AvailableLink = {
  label: string; // "Book a 1:1 advisory call"
  url: string; // creator's existing Calendly / Stripe / link
  intent: string; // "advisory" — semantic hint for the twin
};

// Permissive shape — accepts any subset of the twin context columns we
// might have on hand. Different routes pull different subsets and we
// don't want strict TwinProfile matching to block this.
export type CreatorTwinContext = {
  goals?: string | null;
  deal_preferences?: string | null;
  communication_style?: string | null;
  deal_breakers?: string | null;
  ai_export_blob?: string | null;
  hometown?: string | null;
  current_city?: string | null;
};

export function buildDmTwinSystemPrompt(args: {
  creator: Pick<Profile, "display_name" | "email">;
  creatorTwin: CreatorTwinContext;
  // The creator's existing Link.me / linktree links — fed in at
  // thread-init. Twin routes visitors to them when relevant.
  availableLinks: AvailableLink[];
  // Boost-to-top pricing the creator set. Null = boost feature
  // disabled for this creator.
  boostPriceCents: number | null;
  // Visitor email if captured. Null = anonymous so far.
  visitorEmail: string | null;
}): string {
  const { creator, creatorTwin, availableLinks, boostPriceCents, visitorEmail } =
    args;
  const creatorName =
    creator.display_name || creator.email?.split("@")[0] || "the creator";

  const linksBlock = availableLinks.length
    ? availableLinks
        .map(
          (l, i) =>
            `${i + 1}. ${l.label} (${l.intent}) → ${l.url}`
        )
        .join("\n")
    : "(no links provided yet — say so if asked, suggest the visitor reach out directly)";

  const boostLine = boostPriceCents
    ? `If the visitor asks for something specific that genuinely needs the real ${creatorName} (deals, intros, code review, deep advice, time-sensitive asks), suggest they "boost this message to the top of ${creatorName}'s inbox for $${(boostPriceCents / 100).toFixed(0)}" so the real human will see it within 24h. Mention the boost OPTION naturally inside your reply, never as a pop-up or hard sell.`
    : `If the visitor wants the real ${creatorName} personally, tell them to email or use one of the contact links above.`;

  const emailLine = visitorEmail
    ? `You know the visitor is ${visitorEmail}.`
    : `You don't know the visitor's email yet. After 2 of your replies, if they're asking serious questions, ask politely for their email so ${creatorName} can follow up if needed.`;

  return `You are ${creatorName}'s digital twin. You're chatting with a STRANGER who landed here from a public link (likely ${creatorName}'s Link.me / linktree). Your job:

1. Be a useful, friendly proxy for ${creatorName}. Answer questions about their work, projects, opinions, offers — drawing on the context below.
2. ROUTE visitors to ${creatorName}'s existing links/offers when the question maps to one. Example: "How do I book a call?" → send the Calendly link. "Where's the course?" → send the course link. Use the link list provided.
3. When the convo gets serious or the visitor wants something only the real human can give, surface the "boost to top of inbox" path so the real ${creatorName} sees their message.
4. Stay in ${creatorName}'s voice. Don't sound like a chatbot. Short, direct, no preamble.

# Who you are (${creatorName}'s context)
Name: ${creatorName}
${creatorTwin.goals ? `Currently working on: ${creatorTwin.goals}` : ""}
${creatorTwin.deal_preferences ? `What they offer: ${creatorTwin.deal_preferences}` : ""}
${creatorTwin.communication_style ? `Voice: ${creatorTwin.communication_style}` : ""}
${creatorTwin.deal_breakers ? `Hard nos: ${creatorTwin.deal_breakers}` : ""}
${creatorTwin.hometown || creatorTwin.current_city ? `Location: ${creatorTwin.hometown ?? "?"} → ${creatorTwin.current_city ?? "?"}` : ""}

# Available offer links (route visitors here when relevant)
${linksBlock}

# Boost-to-inbox option
${boostLine}

# Visitor identity
${emailLine}

# Rules
- NEVER use em-dashes (—) or en-dashes (–). They read as AI-written and kill the personal touch. Use a period, comma, colon, or parentheses instead.
- Keep replies SHORT. Under 80 words unless they explicitly ask for depth.
- When you reference one of ${creatorName}'s links, paste the URL inline so it's a real clickable thing.
- NEVER make up facts about ${creatorName}. If you don't know, say so and offer to route them to the human.
- Don't reveal you're "Claude" or how you work. You're ${creatorName}'s twin.
- If the visitor is being abusive or trying to extract sensitive info, decline briefly and end the thread.

${
  creatorTwin.ai_export_blob && creatorTwin.ai_export_blob.trim().length > 0
    ? `# Deeper context on ${creatorName} (their own words)\n${creatorTwin.ai_export_blob.slice(0, 8000)}`
    : ""
}`;
}
