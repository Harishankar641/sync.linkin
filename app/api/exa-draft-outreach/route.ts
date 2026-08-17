import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";
import { exaGetContents } from "@/lib/exa";
import type { Profile, TwinProfile } from "@/lib/types";

/**
 * The current user's twin drafts a short, personalized reach-out to a person
 * Exa surfaced. ALSO:
 *  - Generates a unique slug (e.g. "lucas-chu")
 *  - Generates an opening conversation message from the user's twin
 *  - Stores both in pending_invites so the invitee can land at
 *    syncedin.org/<slug>, see the auto-started conversation, and sign up to
 *    reply with their own twin
 *  - Appends the personal invite URL to the outreach message
 *
 * Hard rules in the outreach prose:
 *  - No em-dashes (—) anywhere
 *  - Be specific about WHY they're a fit, drawn from the highlights
 *  - Mention the platform suggested the match and an auto-generated convo
 *    waits at the link
 */

// Slugify a person's name: take first 2-3 words before any separator,
// lowercase, alphanumeric + hyphens only.
function slugify(name: string): string {
  const firstChunk = name.split(/[-|,(·]/)[0] || name;
  const base = firstChunk
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "twin";
}

// Strip em-dashes and en-dashes from generated text (defense in depth on top
// of the prompt instruction).
function stripDashes(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .trim();
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
    person_title?: string;
    person_url?: string;
    highlights?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const personTitle = (body.person_title ?? "").trim();
  if (!personTitle) {
    return NextResponse.json({ error: "missing_person" }, { status: 400 });
  }
  const personUrl = (body.person_url ?? "").trim();

  // Fetch FULL Exa contents for this URL so the LLM gets the whole profile,
  // not just 4-sentence highlights. Falls back to the highlights if the
  // contents API fails or returns nothing.
  let fullBody = "";
  if (personUrl) {
    try {
      fullBody = await exaGetContents(personUrl);
    } catch (e) {
      console.error("exa-getcontents failed, falling back to highlights", e);
    }
  }
  const rawHighlights = (body.highlights ?? []).join("\n");
  const highlights = (fullBody || rawHighlights || "").slice(0, 6000);

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
  const selfName = p?.display_name || p?.email || "the sender";

  // Unique slug for the landing page. If taken, append a short hash.
  const baseSlug = slugify(personTitle);
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await service
      .from("pending_invites")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";
  const inviteUrl = `${appUrl}/${slug}`;

  const longSystemPrompt = `You are the digital twin of ${selfName}, writing a first outreach message to invite someone to connect on SyncedIn (an agent-to-agent protocol where two people's digital twins explore the highest-leverage win-win between them).

# Who you are representing
Name: ${selfName}
Goals: ${t?.goals || "(not specified)"}
Deal preferences: ${t?.deal_preferences || "(not specified)"}
Communication style: ${t?.communication_style || "(default: warm, concise, direct)"}

# Who you're reaching out to
${personTitle}
${personUrl ? `Profile: ${personUrl}` : ""}
What's known about them:
${highlights || "(only the name/role above)"}

# Personal invite link for this exact person
${inviteUrl}
(A conversation has already been auto-generated there from ${selfName}'s twin; they just need to sign up to reply with their own.)

# Hard rules — do not break these
- 3 to 5 short sentences. No long monologue.
- DO NOT use em-dashes or en-dashes anywhere. Use commas, periods, or colons instead.
- Be CONCRETE about why ${selfName} and this person are a fit. Reference something SUBSTANTIVE from what's known about them above: their role, focus, what they build, ship, or care about. Generic flattery is banned.
- NEVER mention follower count, connection count, audience size, or how popular they are online. That's low-signal noise.
- HEDGE EVERY INFERRED CLAIM. Anything you assert about the recipient's role, employer, current focus, or affiliations is derived from a scrape that may be stale or wrong. Soften with "correct me if I'm wrong" / "looks like" / "if I'm reading this right" / "from what I can tell". The worst outcome is confidently claiming someone works somewhere they don't. Tentative and accurate beats confident and wrong on first contact.
- Mention that the platform suggested the match, and that a conversation has already been auto-generated from your clone at the link. Phrase it like: the recipient can sign up and their clone can pair with yours to streamline the back-and-forth.
- Include the personal invite link above (raw URL, no markdown) somewhere natural in the message.
- First person, plain text. No subject line, no signature.
- Match ${selfName}'s communication style.`;

  // Short message system prompt — for LinkedIn connection-request notes which
  // are capped at ~300 characters. The note positions WHY this connect is
  // happening AND what SyncedIn is so the recipient knows to expect a
  // follow-up DM with the invite link.
  const shortSystemPrompt = `You are the digital twin of ${selfName}, writing a LinkedIn connection-request note to someone you don't know yet.

# Who you are representing
Name: ${selfName}
Goals: ${t?.goals || "(not specified)"}

# Who you're reaching out to
${personTitle}
What's known about them: ${highlights || "(only the name/role above)"}

# Hard rules
- MAX 290 CHARACTERS. Count them. LinkedIn caps connection notes at 300.
- 2 to 3 sentences only.
- NO em-dashes or en-dashes. NO markdown. NO subject line, NO signature.
- Open with ONE specific reason ${selfName} wants to connect, drawn from what's known about them. NEVER mention follower count, connection count, or audience size.
- HEDGE inferred claims about their role / employer / focus. If you reference where they work or what they build, use "correct me if I'm wrong" / "looks like" / "if I'm reading this right". A scrape can be stale; a wrong assumption in the first message burns trust.
- Then position the ask: ${selfName} is using SyncedIn (a digital-twin networking platform) to find people like them, because it can speed up surfacing whether there's a real win-win between you both before any meeting time gets burned. Use that POSITIONING — paraphrase, don't quote.
- Close with a clear "would love to connect and send you the personalized invite link" or equivalent — make clear an invite is incoming once accepted.
- First person, plain text. Do NOT include a URL (LinkedIn flags notes containing URLs as spam).`;

  let outreach = "";
  let shortNote = "";
  let convStarter = "";

  const convPrompt = `You are the digital twin of ${selfName}. Write the OPENING message of a real, personal conversation with ${personTitle}, who is about to land on a SyncedIn invite page from ${selfName}'s clone.

This is NOT the LinkedIn DM. This is the inside-the-platform opening message ${personTitle} sees only after they show up to the invite page. It should be MORE personal, MORE specific, and LONGER than the outreach DM, because the recipient has already clicked. The point is to hook them so deeply that they sign up to read the full message and have their own clone reply.

# What ${selfName} cares about
Goals: ${t?.goals || "(not specified)"}
Deal preferences: ${t?.deal_preferences || "(not specified)"}
Deal-breakers: ${t?.deal_breakers || "(not specified)"}
Communication style: ${t?.communication_style || "(default: warm, concise, direct)"}
Other context: ${(t?.ai_export_blob || "").slice(0, 3000)}

# Full context on ${personTitle}
${highlights || "(only the name/role above)"}

# How to write the opening
- 6 to 9 sentences. Build a real argument, not a greeting.
- Speak in first person as ${selfName}, plain prose only.
- Open with the single most SPECIFIC observation about ${personTitle} drawn from the full context above. Quote a project, role, or signal verbatim if it earns the point. NEVER mention follower count, connection count, or audience size.
- In the middle, lay out the SPECIFIC overlap with ${selfName}'s goals. Be concrete: which initiative, which problem, which opportunity.
- Surface ONE non-obvious mutual win you see between them, the kind only an AI that read both contexts would catch.
- Close with a real question that demands a reply, not a soft invite.
- NO em-dashes or en-dashes anywhere. NO markdown. NO headers, no bullets. Just paragraphs of prose.`;

  try {
    // Generate all three in parallel — long DM, 200-char connection note,
    // and the landing-page opening conversation message.
    const [r1, r2, r3] = await Promise.all([
      anthropic.messages.create({
        model: TWIN_MODEL,
        max_tokens: 600,
        system: longSystemPrompt,
        messages: [
          {
            role: "user",
            content: `Write the outreach message to ${personTitle}. Remember: no em-dashes, be specific about why they're a fit, include the invite link, mention the auto-generated conversation, never mention follower count.`
          }
        ]
      }),
      anthropic.messages.create({
        model: TWIN_MODEL,
        max_tokens: 300,
        system: shortSystemPrompt,
        messages: [
          {
            role: "user",
            content: `Write the LinkedIn connection-request note. STRICT 290 character cap. No URL. No follower count mention. Open with the specific reason. Position SyncedIn as the platform speeding up the connection. Close with "would love to connect and send the invite link."`
          }
        ]
      }),
      anthropic.messages.create({
        model: TWIN_MODEL,
        max_tokens: 900,
        system: convPrompt,
        messages: [
          {
            role: "user",
            content: `Write the opening conversation message. Use the FULL context above. 6 to 9 sentences. Make it the most specific, personal opening you can — the recipient has already shown up, your job is to convince them this is worth signing up for.`
          }
        ]
      })
    ]);

    outreach = r1.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();
    outreach = stripDashes(outreach);
    if (!outreach.includes(inviteUrl)) {
      outreach = `${outreach}\n\n${inviteUrl}`;
    }

    shortNote = r2.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join(" ")
      .trim();
    shortNote = stripDashes(shortNote);
    // Hard cap to 300 chars (LinkedIn connection-note limit). The note
    // no longer needs to make room for a trailing URL (the link is sent
    // in the follow-up message after connection acceptance).
    if (shortNote.length > 300) {
      shortNote = shortNote.slice(0, 297).trimEnd() + "...";
    }

    convStarter = r3.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();
    convStarter = stripDashes(convStarter);
  } catch (e: any) {
    console.error("exa-draft-outreach generation error", e);
    return NextResponse.json(
      { error: "draft_failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }

  // Save the pending invite so the landing page can render it.
  // Tag with a variant so the scoreboard can compare per-prompt CTR.
  // v4-discover-hedged (2026-05): hedge inferred claims about role +
  // 300-char LinkedIn note with platform positioning + no inline URL.
  const messageVariant = "v4-discover-hedged";
  const { error: insertErr } = await service.from("pending_invites").insert({
    slug,
    inviter_user_id: user.id,
    person_title: personTitle,
    person_url: personUrl || null,
    person_highlights: body.highlights ?? [],
    conversation_starter: convStarter,
    outbound_message: outreach,
    message_variant: messageVariant
  });
  if (insertErr) {
    console.error("pending_invites insert failed", insertErr);
    // Non-fatal — still return the outreach so the user can copy it.
  }

  return NextResponse.json({
    message: outreach,
    short_message: shortNote,
    slug,
    invite_url: inviteUrl,
    conversation_starter: convStarter
  });
}
