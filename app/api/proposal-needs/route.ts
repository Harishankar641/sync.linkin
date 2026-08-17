import { NextResponse } from "next/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";

/**
 * Analyze a finalized invite-page proposal for missing concrete items
 * (Jack: "it shouldn't be accept and pretend the info is in it, it
 * should prompt the person to add the info needed, and there should be
 * the official button if a conclusion is in fact reached").
 *
 * Public (the invite page has no auth). Cheap single call, hard caps.
 *
 * POST { proposal, inviterName, recipientName }
 *   → { needs: [{ from: "inviter"|"recipient", item, hint }], complete }
 *
 * complete=true means nothing concrete is missing and the conclusion is
 * fully specified, so the UI shows "Make it official".
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    proposal?: string;
    inviterName?: string;
    recipientName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ needs: [], complete: true });
  }
  const proposal = (body.proposal ?? "").toString().trim().slice(0, 1200);
  const inviter = (body.inviterName ?? "the inviter").toString().slice(0, 60);
  const recipient = (body.recipientName ?? "the recipient")
    .toString()
    .slice(0, 60);
  if (proposal.length < 12) {
    return NextResponse.json({ needs: [], complete: true });
  }

  const system = `You analyze a deal proposal between ${inviter} (inviter) and ${recipient} (recipient). List ONLY concrete items the proposal explicitly requires a party to PROVIDE or SEND that are not already contained in the proposal text itself: links, decks, emails, phone numbers, files, dates, availability windows, addresses, numbers. Do not invent requirements. Max 3 items.

Return ONLY this JSON, no markdown fences:
{"needs":[{"from":"inviter" or "recipient","item":"<what is needed, 3-6 words>","hint":"<input placeholder like 'paste the link here'>"}],"complete":<true if nothing concrete is missing and the conclusion is fully specified, else false>}

If nothing is required: {"needs":[],"complete":true}. Never use em-dashes.`;

  try {
    const r = await anthropic.messages.create({
      model: TWIN_MODEL,
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: `Proposal:\n${proposal}\n\nReturn the JSON.` }]
    });
    const text = r.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return NextResponse.json({ needs: [], complete: true });
    }
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      needs?: Array<{ from?: string; item?: string; hint?: string }>;
      complete?: boolean;
    };
    const needs = Array.isArray(parsed.needs)
      ? parsed.needs
          .slice(0, 3)
          .map((n) => ({
            from: n?.from === "inviter" ? "inviter" : "recipient",
            item: String(n?.item ?? "").slice(0, 80),
            hint: String(n?.hint ?? "").slice(0, 80)
          }))
          .filter((n) => n.item.length > 1)
      : [];
    return NextResponse.json({
      needs,
      complete: needs.length === 0 ? true : !!parsed.complete && needs.length === 0
    });
  } catch {
    // Analysis hiccup: default to the official CTA so the page never
    // blocks the user.
    return NextResponse.json({ needs: [], complete: true });
  }
}
