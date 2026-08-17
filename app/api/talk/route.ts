import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { createServiceClient } from "@/lib/supabase/server";
import { buildTalkSystemPrompt, TALK_TOOLS } from "@/lib/talk-prompt";

/**
 * POST /api/talk
 *
 * Streaming chat endpoint for the /talk landing variant. Streams a
 * single Claude response (Haiku for speed) with tool-use support, then
 * resolves any tool calls server-side and returns the synthesized
 * answer + UI hints (suggested signup URL, matched users) the client
 * renders inline.
 *
 * Body: { messages: Array<{ role: "user" | "assistant", content: string }> }
 * Returns: { reply: string, tool_results: { ... }, signup_url?: string }
 *
 * Non-streaming v1 — proves the architecture works end-to-end. Once
 * stable we swap for true SSE streaming so the user sees tokens land
 * as they generate.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const messages = (body?.messages ?? []) as IncomingMessage[];
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages array required" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Pull platform context: total count + top 20 users for the prompt.
  let totalCount = 0;
  let topUsers: Array<{
    display_name: string;
    bio: string | null;
    city: string | null;
    notable_achievement?: string | null;
    handle: string | null;
  }> = [];
  try {
    const { count } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .neq("is_test_persona", true);
    totalCount = count ?? 0;
  } catch {
    /* unknown — leave 0 */
  }
  try {
    const { data } = await service
      .from("profiles")
      .select("display_name, bio, city, handle, last_active_at, avatar_url, portfolio_about")
      .neq("is_test_persona", true)
      .not("display_name", "is", null)
      .order("last_active_at", { ascending: false, nullsFirst: false })
      .limit(20);
    topUsers = ((data ?? []) as any[]).map((r) => ({
      display_name: r.display_name,
      bio:
        (r.bio as string | null) ??
        ((r.portfolio_about as string | null)?.split("\n")[0] ?? null),
      city: r.city ?? null,
      handle: r.handle ?? null
    }));
  } catch {
    /* empty topUsers is fine — prompt handles it */
  }

  const systemPrompt = buildTalkSystemPrompt({ topUsers, totalCount });

  // Multi-turn tool-use loop: call Claude, resolve any tool calls,
  // feed results back, repeat until we get a final text response or
  // hit the iteration cap.
  const TURN_CAP = 5;
  let conversation: any[] = messages.map((m) => ({
    role: m.role,
    content: m.content
  }));
  let collectedToolResults: Record<string, unknown> = {};
  // Full ordered trace of every tool call — the right rail subscribes
  // to this so the visitor sees Sync's work, including dud searches.
  const toolUseTrace: Array<{
    name: string;
    input: Record<string, unknown>;
    result: unknown;
  }> = [];
  let signupUrl: string | undefined;
  let finalText = "";

  for (let i = 0; i < TURN_CAP; i++) {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: systemPrompt,
      tools: TALK_TOOLS as any,
      messages: conversation
    });

    // Collect any text content into finalText (accumulates across the
    // loop in case Claude interleaves text + tool_use blocks).
    const textBlocks = resp.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");
    if (textBlocks.trim()) finalText = textBlocks;

    const toolUseBlocks = resp.content.filter(
      (c: any) => c.type === "tool_use"
    ) as any[];
    if (toolUseBlocks.length === 0) {
      // Pure text response — we're done.
      break;
    }

    // Echo assistant's tool-use turn into the conversation so Claude
    // sees its own prior step when we feed results back.
    conversation.push({ role: "assistant", content: resp.content });

    const toolResultBlocks: any[] = [];
    for (const tu of toolUseBlocks) {
      const result = await runTool(service, tu.name, tu.input);
      collectedToolResults[tu.name] = result;
      toolUseTrace.push({
        name: tu.name,
        input: tu.input,
        result
      });
      if (
        tu.name === "start_signup" &&
        (result as any)?.signup_url
      ) {
        signupUrl = (result as any).signup_url;
      }
      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(result).slice(0, 4000)
      });
    }
    conversation.push({ role: "user", content: toolResultBlocks });
  }

  return NextResponse.json({
    reply: finalText.trim() || "(no reply)",
    tool_results: collectedToolResults,
    tool_use_trace: toolUseTrace,
    signup_url: signupUrl
  });
}

/**
 * Server-side tool resolver. Each tool returns a JSON object Claude
 * sees as the tool_result. Keep responses tight — Claude pays
 * attention to size and we're already token-conscious on Haiku.
 */
async function runTool(
  service: ReturnType<typeof createServiceClient>,
  name: string,
  input: Record<string, any>
): Promise<unknown> {
  if (name === "search_users") {
    const query = String(input.query || "").trim();
    // Lightweight semantic-ish search: ilike on bio + portfolio_about.
    // True embedding search would beat this but isn't worth the latency
    // budget on the landing chat. Sanitize % to avoid SQL-pattern bleed.
    const safe = query.replace(/[%_,]/g, " ").trim().slice(0, 80);
    try {
      let matches: any[] = [];
      if (safe.length >= 2) {
        const { data } = await service
          .from("profiles")
          .select(
            "display_name, handle, avatar_url, bio, city, portfolio_about, last_active_at"
          )
          .neq("is_test_persona", true)
          .or(
            `bio.ilike.%${safe}%,portfolio_about.ilike.%${safe}%,display_name.ilike.%${safe}%,city.ilike.%${safe}%`
          )
          .order("last_active_at", { ascending: false, nullsFirst: false })
          .limit(8);
        matches = (data ?? []) as any[];
      }
      let fallback = false;
      // If the specific query missed (or was too short), fall back to
      // the most-active platform users so Sync always has something
      // to talk about instead of saying "no results". The visitor
      // sees the `fallback:true` flag in the right rail.
      if (matches.length === 0) {
        fallback = true;
        const { data } = await service
          .from("profiles")
          .select(
            "display_name, handle, avatar_url, bio, city, portfolio_about, last_active_at"
          )
          .neq("is_test_persona", true)
          .not("display_name", "is", null)
          .order("last_active_at", { ascending: false, nullsFirst: false })
          .limit(8);
        matches = (data ?? []) as any[];
      }
      return {
        fallback,
        query: safe,
        matches: matches.map((r) => ({
          name: r.display_name,
          handle: r.handle,
          city: r.city,
          one_liner:
            (r.bio as string | null)?.slice(0, 160) ??
            (r.portfolio_about as string | null)?.split("\n")[0]?.slice(0, 160) ??
            null
        }))
      };
    } catch (e: any) {
      return { error: e?.message || "search failed", matches: [], fallback: false };
    }
  }

  if (name === "scrape_handle") {
    // Defer to /api/scrape (existing endpoint) when available. For v1
    // we return a placeholder shape so the chat keeps flowing — the
    // real scrape hookup is a follow-up since it requires Apify token
    // + lookup-by-platform routing.
    const platform = String(input.platform || "");
    const handle = String(input.handle || "");
    return {
      platform,
      handle,
      note:
        "scrape_handle is wired but the live Apify call is deferred to v2 — for now, ask the visitor to summarize themselves in one sentence and proceed."
    };
  }

  if (name === "match_preview") {
    // Pull 3 random-but-active platform users for now — true match
    // scoring requires the full sync algorithm against the scraped
    // visitor profile, which we'll wire once scrape_handle is live.
    try {
      const { data } = await service
        .from("profiles")
        .select("display_name, handle, bio, city, portfolio_about")
        .neq("is_test_persona", true)
        .not("display_name", "is", null)
        .order("last_active_at", { ascending: false, nullsFirst: false })
        .limit(3);
      return {
        top_matches: ((data ?? []) as any[]).map((r) => ({
          name: r.display_name,
          handle: r.handle,
          one_liner:
            (r.bio as string | null)?.slice(0, 160) ??
            (r.portfolio_about as string | null)?.split("\n")[0]?.slice(0, 160) ??
            "On the platform — open their portfolio for the full pitch.",
          why_sync:
            "Activity-recent + similar-domain match. v2 will swap in the real sync-score model."
        }))
      };
    } catch {
      return { top_matches: [] };
    }
  }

  if (name === "start_signup") {
    const summary = String(input.prefill_summary || "");
    // Encode the summary into a URL param so /login or /onboarding
    // can pre-fill from it.
    const param = encodeURIComponent(summary.slice(0, 600));
    return {
      signup_url: `/login?from=talk&prefill=${param}`,
      message: "Signup URL ready — surface this as a button in the chat."
    };
  }

  return { error: `unknown tool: ${name}` };
}
