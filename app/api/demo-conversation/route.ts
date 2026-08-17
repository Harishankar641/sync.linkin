import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";
import {
  runContextDive,
  buildWittyShowcasePrompt,
  type ContextDive
} from "@/lib/context-dive";

/**
 * Demo conversation generator — drives the pre-auth invite landing page.
 *
 * Two modes:
 *   1. STREAMING (default, ?stream=1 or Accept: text/event-stream):
 *      Emits each complete message as an SSE event as soon as it's
 *      generated. UI shows bubbles progressively instead of waiting
 *      for the whole 6-turn block.
 *      Events:
 *        data: {"type":"meta","inviterName":"…","recipientName":"…"}\n\n
 *        data: {"type":"message","sender":"inviter","text":"…"}\n\n
 *        data: {"type":"message","sender":"recipient","text":"…"}\n\n
 *        data: {"type":"done"}\n\n
 *
 *   2. JSON (back-compat): returns the full {messages:[…]} payload
 *      after the entire generation completes. Kept for any caller
 *      that doesn't want the stream.
 *
 * The streaming path uses Claude's native message-stream API and
 * watches the accumulating text for complete `{"sender":...,"text":...}`
 * objects, emitting each as soon as the closing brace + comma (or end-
 * of-array) lands. The model is prompted to emit ONE message per line
 * inside the JSON array so the parsing stays simple.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const wantsStream =
    url.searchParams.get("stream") === "1" ||
    req.headers.get("accept")?.includes("text/event-stream");

  let body: {
    slug?: string;
    extra_context?: string;
    edits?: Array<{ index: number; text: string }>;
    // When the recipient edits a line, the client truncates the transcript
    // to that line and sends it here as the verbatim, ground-truth prefix.
    // We then generate ONLY the twins' reaction to it instead of wiping and
    // rebuilding the whole conversation.
    continue_from?: Array<{ sender: string; text: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const slug = (body.slug ?? "").toLowerCase().trim();
  if (!slug) {
    return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  }
  const extraContext = (body.extra_context ?? "").toString().slice(0, 8000);
  const edits = Array.isArray(body.edits) ? body.edits.slice(0, 12) : [];
  const continueFrom = Array.isArray(body.continue_from)
    ? body.continue_from
        .slice(0, 14)
        .map((m) => ({
          sender: (m?.sender === "recipient" ? "recipient" : "inviter") as
            | "inviter"
            | "recipient",
          text: (m?.text ?? "").toString()
        }))
        .filter((m) => m.text.trim().length > 0)
    : [];

  const service = createServiceClient();
  const { data: invite } = await service
    .from("pending_invites")
    .select(
      "slug, inviter_user_id, person_title, person_highlights, conversation_starter"
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!invite) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [{ data: inviterProfile }, { data: inviterTwin }] = await Promise.all([
    service
      .from("profiles")
      .select("display_name, email, avatar_url")
      .eq("id", invite.inviter_user_id)
      .maybeSingle(),
    service
      .from("twin_profiles")
      .select(
        "goals, deal_preferences, communication_style, deal_breakers, ai_export_blob"
      )
      .eq("user_id", invite.inviter_user_id)
      .maybeSingle()
  ]);

  const inviterName =
    (inviterProfile as any)?.display_name ||
    (inviterProfile as any)?.email ||
    "the sender";
  const recipientName =
    ((invite as any).person_title || "").split(/[-|,(·]/)[0]?.trim() ||
    "the recipient";

  const inviterTwinBlock = `
${inviterName}'s goals: ${(inviterTwin as any)?.goals || "(not specified)"}
${inviterName}'s deal preferences: ${
    (inviterTwin as any)?.deal_preferences || "(not specified)"
  }
${inviterName}'s comm style: ${
    (inviterTwin as any)?.communication_style || "(not specified)"
  }
${inviterName}'s deal breakers: ${
    (inviterTwin as any)?.deal_breakers || "(not specified)"
  }
${inviterName}'s context blob (excerpts):
${((inviterTwin as any)?.ai_export_blob || "").slice(0, 1500)}
  `.trim();

  const highlights = Array.isArray((invite as any).person_highlights)
    ? ((invite as any).person_highlights as string[])
    : [];
  const recipientGuessBlock = `
Public footprint we have for ${recipientName} (from their LinkedIn / Twitter / web):
${highlights.join("\n\n").slice(0, 2500)}
${
  extraContext
    ? `\n\nAdditional context ${recipientName} just added themselves (treat as the most-recent truth, override the scrape where they conflict):\n${extraContext}`
    : ""
}
  `.trim();

  const editsBlock =
    edits.length > 0
      ? `\n\nThe user already manually edited these specific lines in the prior draft — preserve the SPIRIT of each edit when regenerating. Edits (0-indexed message position → new text):\n${edits
          .map((e) => `  [${e.index}] "${(e.text || "").slice(0, 240)}"`)
          .join("\n")}`
      : "";

  // === DIVE-FIRST ARCHITECTURE (Jack: "the context dive happens first
  // and then the conversation can not be as long as the search for
  // potential — instead, a surfacing of the chat that would have
  // happened to get to the best endpoint. More witty, more funny,
  // showcasing the alignment.") ===
  //
  // Step 1: run the dive (or load the cached one from pending_invites).
  //         Produces JSON alignment + recommended_destination + the
  //         right voice for these two.
  // Step 2: feed the dive into a SHORT WITTY showcase prompt — 5
  //         messages, snappy, leans into the dive's voice angle,
  //         lands the recommended_destination on message 5.
  let dive: ContextDive | null = (invite as any).context_dive ?? null;
  if (!dive || extraContext || edits.length > 0) {
    // Re-dive whenever the recipient added new context or edited a
    // line — the alignment should reflect their corrections. Cached
    // dive only used for cold-load.
    try {
      const contextA = `Goals: ${(inviterTwin as any)?.goals || "(not specified)"}
Deal preferences: ${(inviterTwin as any)?.deal_preferences || "(not specified)"}
Communication style: ${(inviterTwin as any)?.communication_style || "(not specified)"}
Deal breakers: ${(inviterTwin as any)?.deal_breakers || "(not specified)"}
Context blob (excerpts):
${((inviterTwin as any)?.ai_export_blob || "").slice(0, 4000)}`;
      const contextB = `Public footprint:
${highlights.join("\n\n").slice(0, 6000)}${
        extraContext
          ? `\n\nNew context they just added (treat as latest truth):\n${extraContext}`
          : ""
      }`;
      dive = await runContextDive({
        name_a: inviterName,
        context_a: contextA,
        name_b: recipientName,
        context_b: contextB
      });
      // Cache the dive on the invite row (fire-and-forget). Schema-
      // missing case degrades silently — the conversation still works.
      void service
        .from("pending_invites")
        .update({ context_dive: dive })
        .eq("slug", slug)
        .then(
          () => undefined,
          () => undefined
        );
    } catch (e) {
      console.warn(
        "[demo-conversation] dive failed; falling back to no-dive prompt",
        e
      );
      dive = null;
    }
  }

  // === WITTY SHOWCASE PROMPT — short, snappy, lands the proposal ===
  // If the dive succeeded, use the showcase prompt that assumes
  // coordination already happened. If it failed (no anthropic, schema
  // issue, etc.), fall back to a brief discovery-style prompt that
  // still caps at 6 messages instead of running forever.
  let systemPrompt: string;
  let userContent: string;
  if (dive) {
    const { system, userIntro } = buildWittyShowcasePrompt(
      inviterName,
      recipientName,
      dive
    );
    systemPrompt = system;
    userContent = `${userIntro}${editsBlock}`;
  } else {
    // Fallback (no dive available) — still SHORT now (was: run until
    // proposal lands, no cap). 5 messages max, witty, lands proposal
    // on the last message.
    systemPrompt = `You're generating a SHORT WITTY conversation between two people's digital twins. EXACTLY 5 messages alternating senders. Message 1 = "${inviterName}'s twin" (sender: "inviter"). Message 2 = "${recipientName}'s twin" (sender: "recipient"). Each message 1–3 sentences. NO em-dashes, NO emojis, NO markdown. Skip discovery beats — start IN the alignment. Message 5 must land a concrete win-win and END with the literal "PROPOSAL: …" marker (who does what, when, what channel).

Output ONLY JSON:
{
"messages": [
{"sender": "inviter", "text": "..."},
{"sender": "recipient", "text": "..."},
{"sender": "inviter", "text": "..."},
{"sender": "recipient", "text": "..."},
{"sender": "inviter", "text": "..."}
]
}`;
    userContent = `${inviterTwinBlock}\n\n---\n\n${recipientGuessBlock}${editsBlock}\n\nWrite the 5-message JSON now.`;
  }

  // ============ CONTINUATION MODE ============
  // The recipient edited a line. The client truncated the transcript to
  // that line and sent it as continue_from. Treat that prefix as ground
  // truth and generate ONLY the next few messages reacting to the edited
  // last line — never rewrite or repeat the prefix. This overrides the
  // system/user prompt built above so editing behaves like the real
  // messages feature (edit a line → the twins pick up from your version).
  if (continueFrom.length > 0) {
    const nameFor = (s: "inviter" | "recipient") =>
      s === "inviter" ? inviterName : recipientName;
    const transcript = continueFrom
      .map((m) => `${nameFor(m.sender)}'s twin: ${m.text}`)
      .join("\n");
    const lastSender = continueFrom[continueFrom.length - 1].sender;
    const nextSender: "inviter" | "recipient" =
      lastSender === "inviter" ? "recipient" : "inviter";
    systemPrompt = `You are continuing an in-progress conversation between two people's digital twins: ${inviterName}'s twin (sender "inviter") and ${recipientName}'s twin (sender "recipient"). The transcript the user provides is GROUND TRUTH that ${recipientName} just edited. Do NOT rewrite, repeat, summarize, or contradict any line in it. Generate ONLY the next 3 to 4 messages that naturally respond to the LAST line, alternating senders and STARTING with "${nextSender}". Each message 1 to 3 sentences. NO em-dashes, NO emojis, NO markdown. The final message must land a concrete win-win and END with the literal "PROPOSAL: ..." marker (who does what, when, what channel).

Output ONLY JSON:
{"messages":[{"sender":"${nextSender}","text":"..."}]}`;
    userContent = `${inviterTwinBlock}\n\n---\n\n${recipientGuessBlock}\n\nConversation so far (verbatim — continue AFTER the last line, never repeat it):\n${transcript}\n\nWrite the continuation JSON now, starting with sender "${nextSender}".`;
  }

  // ============ STREAMING PATH ============
  if (wantsStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(payload: object) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        }

        try {
          // Send meta event first so the UI can render name/header before
          // any bubbles arrive.
          send({ type: "meta", inviterName, recipientName });

          // Use the Anthropic SDK streaming API. We accumulate raw text
          // and watch for completed message objects in the stream.
          const stream = anthropic.messages.stream({
            model: TWIN_MODEL,
            // Dive-first architecture: surface conversation is now a
            // SHORT 5-message witty showcase, not a turn-by-turn search.
            // 1500 tokens is plenty for 5 1–3 sentence messages + JSON
            // scaffolding.
            max_tokens: 1500,
            system: systemPrompt,
            messages: [{ role: "user", content: userContent }]
          });

          let acc = "";
          // Regex finds one complete {"sender":"...","text":"..."} object.
          // We anchor on the closing `}` so we only emit once a message
          // is fully written by the model.
          const objRegex =
            /\{\s*"sender"\s*:\s*"(inviter|recipient)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
          let lastEmittedEnd = 0;

          stream.on("text", (delta: string) => {
            acc += delta;
            objRegex.lastIndex = lastEmittedEnd;
            let m: RegExpExecArray | null;
            while ((m = objRegex.exec(acc))) {
              const sender = m[1] as "inviter" | "recipient";
              // Unescape the JSON-string content so emoji / quotes /
              // newlines come through correctly.
              let text: string;
              try {
                text = JSON.parse(`"${m[2]}"`);
              } catch {
                text = m[2];
              }
              text = text.trim();
              if (text.length > 0) {
                send({ type: "message", sender, text });
              }
              lastEmittedEnd = m.index + m[0].length;
            }
          });

          await stream.finalMessage();
          send({ type: "done" });
          controller.close();
        } catch (e: any) {
          send({
            type: "error",
            detail: e?.message ?? String(e)
          });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        // X-Accel-Buffering disables nginx buffering on Vercel's edge
        // so events arrive in real time instead of being held until the
        // entire response is ready.
        "x-accel-buffering": "no"
      }
    });
  }

  // ============ NON-STREAMING PATH (back-compat) ============
  let parsed: { messages?: Array<{ sender: string; text: string }> } = {};
  try {
    const response = await anthropic.messages.create({
      model: TWIN_MODEL,
      // Matches the streaming path — 5-message witty showcase fits
      // comfortably in 1500 tokens.
      max_tokens: 1500,
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
    if (start !== -1 && end !== -1) {
      parsed = JSON.parse(text.slice(start, end + 1));
    }
  } catch (e: any) {
    console.error("[demo-conversation] gen error", e);
    return NextResponse.json(
      { error: "generation_failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }

  // Dive-first surface conversation: hard cap at 6 messages (target
  // is 5; +1 buffer for model drift). The dive already did the
  // coordination — the surface is a witty showcase, not a search.
  const cleaned = (parsed.messages ?? [])
    .map((m) => ({
      sender:
        (m.sender || "").toLowerCase() === "recipient"
          ? ("recipient" as const)
          : ("inviter" as const),
      text: (m.text || "").toString().trim()
    }))
    .filter((m) => m.text.length > 0)
    .slice(0, 6);

  return NextResponse.json({
    messages: cleaned,
    inviterName,
    recipientName
  });
}
