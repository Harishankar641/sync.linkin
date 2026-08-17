import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  TWIN_TOOLS,
  runTwinTool,
  type PendingAction
} from "@/lib/twin-tools";

/**
 * Talk-to-your-twin chat.
 *
 * Provider order:
 *   1. Gemini
 *   2. Groq
 *   3. OpenRouter
 *
 * Only ONE provider is used for a normal request. If that provider fails,
 * the next provider is tried. Once a provider successfully returns a
 * tool-call response, the rest of that tool loop stays on that provider.
 *
 * Required:
 *   GEMINI_API_KEY
 *   GROQ_API_KEY
 *   OPENROUTER_API_KEY
 *
 * Optional:
 *   GEMINI_TWIN_MODEL
 *   GROQ_TWIN_MODEL
 *   OPENROUTER_TWIN_MODEL
 *   NEXT_PUBLIC_APP_URL
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_HISTORY_FOR_PROMPT = 30;
const TURN_CAP = 6;

const GEMINI_MODEL =
  process.env.GEMINI_TWIN_MODEL || "gemini-2.5-flash";

const GROQ_MODEL =
  process.env.GROQ_TWIN_MODEL || "llama-3.3-70b-versatile";

const OPENROUTER_MODEL =
  process.env.OPENROUTER_TWIN_MODEL ||
  "dots-studio/dots-3-note-preview:free";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_API_URL =
  "https://openrouter.ai/api/v1/chat/completions";

type CanonicalMessage = {
  role: "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }[];
  tool_call_id?: string;
  name?: string;
};

type CanonicalToolCall = {
  id: string;
  name: string;
  input: Record<string, any>;
};

type ProviderResult = {
  provider: "gemini" | "groq" | "openrouter";
  text: string;
  toolCalls: CanonicalToolCall[];
  assistantMessage: CanonicalMessage;
};

type OpenAIResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
  error?: {
    message?: string;
  };
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      role?: string;
      parts?: Array<{
        text?: string;
        functionCall?: {
          name?: string;
          args?: Record<string, any>;
        };
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
  };
};

function getToolName(tool: any): string {
  return tool?.name || tool?.function?.name || "";
}

function getToolDescription(tool: any): string {
  return tool?.description || tool?.function?.description || "";
}

function getToolParameters(tool: any): Record<string, any> {
  return (
    tool?.input_schema ||
    tool?.parameters ||
    tool?.function?.parameters ||
    {
      type: "object",
      properties: {}
    }
  );
}

/**
 * Convert the existing Anthropic-style TWIN_TOOLS definitions into
 * OpenAI/Groq/OpenRouter function-tool definitions.
 */
function toOpenAITools(tools: any[]) {
  return tools
    .map((tool) => {
      const name = getToolName(tool);
      if (!name) return null;

      return {
        type: "function",
        function: {
          name,
          description: getToolDescription(tool),
          parameters: getToolParameters(tool)
        }
      };
    })
    .filter(Boolean);
}

/**
 * Convert the existing Anthropic-style TWIN_TOOLS definitions into
 * Gemini function declarations.
 */
function toGeminiTools(tools: any[]) {
  return [
    {
      functionDeclarations: tools
        .map((tool) => {
          const name = getToolName(tool);
          if (!name) return null;

          return {
            name,
            description: getToolDescription(tool),
            parameters: getToolParameters(tool)
          };
        })
        .filter(Boolean)
    }
  ];
}

function parseJsonObject(value: string | undefined): Record<string, any> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }

    return { result: parsed };
  } catch {
    return { result: value };
  }
}

function normalizeOpenAIHistory(messages: CanonicalMessage[]) {
  return messages.map((message) => {
    if (message.role === "assistant" && message.tool_calls?.length) {
      return {
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.tool_calls
      };
    }

    if (message.role === "tool") {
      return {
        role: "tool",
        tool_call_id: message.tool_call_id,
        name: message.name,
        content: message.content ?? ""
      };
    }

    return {
      role: message.role,
      content: message.content ?? ""
    };
  });
}

async function callOpenAICompatible(args: {
  provider: "groq" | "openrouter";
  model: string;
  system: string;
  messages: CanonicalMessage[];
  tools: any[];
}): Promise<ProviderResult> {
  const apiKey =
    args.provider === "groq"
      ? process.env.GROQ_API_KEY
      : process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      `${args.provider === "groq" ? "GROQ_API_KEY" : "OPENROUTER_API_KEY"} is not configured.`
    );
  }

  const url =
    args.provider === "groq" ? GROQ_API_URL : OPENROUTER_API_URL;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(args.provider === "openrouter"
        ? {
            "HTTP-Referer":
              process.env.NEXT_PUBLIC_APP_URL || "https://syncedin.org",
            "X-Title": "SyncedIn"
          }
        : {})
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        {
          role: "system",
          content: args.system
        },
        ...normalizeOpenAIHistory(args.messages)
      ],
      tools: toOpenAITools(args.tools),
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 1200
    })
  });

  const raw = await response.text();

  let data: OpenAIResponse | null = null;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `${args.provider} returned invalid JSON (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      `${args.provider} request failed (${response.status}): ${
        data?.error?.message || raw.slice(0, 1000)
      }`
    );
  }

  const message = data?.choices?.[0]?.message;

  if (!message) {
    throw new Error(`${args.provider} returned no message.`);
  }

  const toolCalls: CanonicalToolCall[] = (message.tool_calls || [])
    .map((toolCall) => {
      const name = toolCall.function?.name || "";
      if (!name) return null;

      return {
        id: toolCall.id || `${args.provider}-tool-${Date.now()}`,
        name,
        input: parseJsonObject(toolCall.function?.arguments)
      };
    })
    .filter(Boolean) as CanonicalToolCall[];

  return {
    provider: args.provider,
    text: typeof message.content === "string" ? message.content : "",
    toolCalls,
    assistantMessage: {
      role: "assistant",
      content: typeof message.content === "string" ? message.content : undefined,
      ...(message.tool_calls?.length
        ? {
            tool_calls: message.tool_calls
              .filter(
                (tc) => tc?.id && tc?.function?.name
              )
              .map((tc) => ({
                id: tc.id as string,
                type: "function" as const,
                function: {
                  name: tc.function?.name as string,
                  arguments: tc.function?.arguments || "{}"
                }
              }))
          }
        : {})
    }
  };
}

function toGeminiContents(messages: CanonicalMessage[]) {
  const contents: any[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: message.content ?? "" }]
      });
      continue;
    }

    if (message.role === "assistant") {
      const parts: any[] = [];

      if (message.content) {
        parts.push({ text: message.content });
      }

      for (const toolCall of message.tool_calls || []) {
        parts.push({
          functionCall: {
            name: toolCall.function.name,
            args: parseJsonObject(toolCall.function.arguments)
          }
        });
      }

      if (parts.length) {
        contents.push({
          role: "model",
          parts
        });
      }

      continue;
    }

    if (message.role === "tool") {
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: message.name || "tool",
              response: parseJsonObject(message.content)
            }
          }
        ]
      });
    }
  }

  return contents;
}

async function callGemini(args: {
  system: string;
  messages: CanonicalMessage[];
  tools: any[];
}): Promise<ProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const response = await fetch(
    `${GEMINI_API_URL}/${encodeURIComponent(
      GEMINI_MODEL
    )}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: args.system }]
        },
        contents: toGeminiContents(args.messages),
        tools: toGeminiTools(args.tools),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1200
        }
      })
    }
  );

  const raw = await response.text();

  let data: GeminiResponse | null = null;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `Gemini returned invalid JSON (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Gemini request failed (${response.status}): ${
        data?.error?.message || raw.slice(0, 1000)
      }`
    );
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];

  const text = parts
    .filter(
      (part) =>
        typeof part?.text === "string" && part.text.trim()
    )
    .map((part) => part.text)
    .join("\n");

  const toolCalls: CanonicalToolCall[] = parts
  .filter(
    (part): part is { functionCall: { name: string; args?: Record<string, any> } } =>
      typeof part?.functionCall?.name === "string"
  )
  .map((part, index) => ({
    id: `gemini-tool-${Date.now()}-${index}`,
    name: part.functionCall.name,
    input:
      part.functionCall.args &&
      typeof part.functionCall.args === "object"
        ? part.functionCall.args
        : {}
  }));

  const assistantMessage: CanonicalMessage = {
    role: "assistant",
    content: text ||  undefined,
    ...(toolCalls.length
      ? {
          tool_calls: toolCalls.map((call) => ({
            id: call.id,
            type: "function" as const,
            function: {
              name: call.name,
              arguments: JSON.stringify(call.input)
            }
          }))
        }
      : {})
  };

  return {
    provider: "gemini",
    text,
    toolCalls,
    assistantMessage
  };
}

async function callProvider(args: {
  provider: "gemini" | "groq" | "openrouter";
  system: string;
  messages: CanonicalMessage[];
  tools: any[];
}): Promise<ProviderResult> {
  if (args.provider === "gemini") {
    return callGemini({
      system: args.system,
      messages: args.messages,
      tools: args.tools
    });
  }

  if (args.provider === "groq") {
    return callOpenAICompatible({
      provider: "groq",
      model: GROQ_MODEL,
      system: args.system,
      messages: args.messages,
      tools: args.tools
    });
  }

  return callOpenAICompatible({
    provider: "openrouter",
    model: OPENROUTER_MODEL,
    system: args.system,
    messages: args.messages,
    tools: args.tools
  });
}

export async function GET() {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }

  const service = createServiceClient();

  try {
    const { data, error } = await service
      .from("twin_chat_messages")
      .select("id, role, body, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({
      messages: data ?? []
    });
  } catch (e: any) {
    if (
      /relation .* does not exist|schema cache/i.test(
        e?.message ?? ""
      )
    ) {
      return NextResponse.json(
        {
          messages: [],
          _err: "schema_missing",
          _detail:
            "Run the twin_chat_messages migration in Supabase → SQL Editor."
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        messages: [],
        _err: e?.message ?? null
      },
      { status: 200 }
    );
  }
}

export async function POST(req: Request) {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }

  let body: { body?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 }
    );
  }

  const userText = (body.body ?? "").trim();

  if (!userText) {
    return NextResponse.json(
      { error: "missing_body" },
      { status: 400 }
    );
  }

  if (userText.length > 4000) {
    return NextResponse.json(
      { error: "too_long" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Pull the user's twin profile so the assistant can speak in their voice.
  const [{ data: profile }, { data: twin }] = await Promise.all([
    service
      .from("profiles")
      .select("display_name, email")
      .eq("id", user.id)
      .maybeSingle(),

    service
      .from("twin_profiles")
      .select(
        "goals, deal_preferences, communication_style, deal_breakers, ai_export_blob, hometown, current_city"
      )
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  // Pull pending proposals.
  let proposalContext = "";

  try {
    const { data: convs } = await service
      .from("conversations")
      .select(
        "id, participant_a, participant_b, summary, counterpart_summary, created_at"
      )
      .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
      .not("summary", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    const convIds = (convs ?? []).map((c: any) => c.id);

    if (convIds.length) {
      const { data: resps } = await service
        .from("agreement_responses")
        .select("conversation_id")
        .eq("user_id", user.id)
        .in("conversation_id", convIds);

      const respondedSet = new Set(
        (resps ?? []).map(
          (r: any) => r.conversation_id
        )
      );

      const pending = (convs ?? [])
        .filter(
          (c: any) => !respondedSet.has(c.id)
        )
        .slice(0, 5);

      if (pending.length) {
        proposalContext =
          "\n\n# Pending proposals waiting on the user:\n" +
          pending
            .map(
              (p: any, i: number) =>
                `${i + 1}. ${(
                  p.counterpart_summary ?? "Counterpart"
                ).slice(
                  0,
                  120
                )} — proposal: ${(p.summary ?? "").slice(
                  0,
                  200
                )}`
            )
            .join("\n");
      }
    }
  } catch {
    // Non-fatal.
  }

  // Load recent thread history.
  const { data: priorRows } = await service
    .from("twin_chat_messages")
    .select("role, body, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY_FOR_PROMPT);

  const priorMessages: CanonicalMessage[] = ((priorRows ?? []) as any[])
    .reverse()
    .map((m) => ({
      role:
        m.role === "assistant"
          ? ("assistant" as const)
          : ("user" as const),
      content: m.body as string
    }));

  // Persist user message before generation.
  const { data: userMsg } = await service
    .from("twin_chat_messages")
    .insert({
      user_id: user.id,
      role: "user",
      body: userText
    })
    .select("id")
    .single();

  const selfName =
    (profile as any)?.display_name ||
    ((profile as any)?.email as string)?.split("@")[0] ||
    "you";

  const system = `You are ${selfName}'s digital twin. They are talking to you directly — this is NOT a twin-to-twin networking conversation. They came here to think out loud with you, get advice on pending proposals, or refine your voice.

You know them intimately:
- Goals: ${(twin as any)?.goals || "(not set yet)"}
- Deal preferences: ${(twin as any)?.deal_preferences || "(not set)"}
- Communication style: ${(twin as any)?.communication_style || "(not set)"}
- Deal-breakers: ${(twin as any)?.deal_breakers || "(not set)"}
- Hometown / current city: ${(twin as any)?.hometown || "?"} → ${
    (twin as any)?.current_city || "?"
  }

Speak in first-person as their twin, but stay aware that you ARE the AI and they ARE the human. Be candid. Push back when their thinking is off. Offer specific moves they can take next. Keep replies under 200 words unless they explicitly ask for more depth.

# YOUR TOOLS

You have 7 tools — read tools run immediately, write tools generate Approve cards the user taps to confirm:

READ (auto-execute, you get the data back):
- list_pending_proposals() — every proposal waiting on the user
- list_recent_conversations() — last 10 active threads
- search_platform_users(query) — find people on the platform

WRITE (return an inline Approve card, NO DB writes happen unless the user taps Approve):
- update_proposal_text(conversation_id, counterpart_name, new_text)
- accept_proposal(conversation_id, counterpart_name)
- deny_proposal(conversation_id, counterpart_name, reason)
- send_message_to_conversation(conversation_id, counterpart_name, text)

# RULES

- When the user asks "what proposals do I have", "who's waiting on me", "triage my inbox" — call list_pending_proposals FIRST, then summarize.
- When they ask to update / accept / deny / send — call list_pending_proposals or list_recent_conversations FIRST to get real conversation_ids, then call the appropriate write tool. NEVER invent a conversation_id.
- Write tools stage actions. After calling one, tell the user briefly what you've staged — e.g. "Staged an update to the Jacob proposal — tap Approve below to ship it." Do NOT claim the action is done. The user's tap is what writes to the DB.
- If they ask to do something across multiple proposals ("update all 5"), call the write tool ONCE per conversation — every action gets its own Approve card.
- For drafts: write the new text in plain prose (contract-style for agreements, the user's voice for messages). No emoji clusters, no markdown images.
- ${proposalContext}`;

  try {
    let conversationTurns: CanonicalMessage[] = [
      ...priorMessages,
      {
        role: "user",
        content: userText
      }
    ];

    let finalText = "";
    const pendingActions: PendingAction[] = [];

    // Start with Gemini. If the request fails, move to Groq, then OpenRouter.
    const providers: Array<
      "gemini" | "groq" | "openrouter"
    > = ["gemini", "groq", "openrouter"];

    let activeProvider:
      | "gemini"
      | "groq"
      | "openrouter"
      | null = null;

    let firstAttemptError = "";

    for (const provider of providers) {
      try {
        const firstResponse = await callProvider({
          provider,
          system,
          messages: conversationTurns,
          tools: TWIN_TOOLS as any[]
        });

        activeProvider = provider;

        if (firstResponse.text.trim()) {
          finalText = firstResponse.text;
        }

        conversationTurns.push(firstResponse.assistantMessage);

        if (firstResponse.toolCalls.length === 0) {
          break;
        }

        // Tool loop stays on the provider that successfully started it.
        for (let i = 0; i < TURN_CAP; i++) {
          const currentResponse =
            i === 0
              ? firstResponse
              : await callProvider({
                  provider: activeProvider,
                  system,
                  messages: conversationTurns,
                  tools: TWIN_TOOLS as any[]
                });

          if (i > 0) {
            if (currentResponse.text.trim()) {
              finalText = currentResponse.text;
            }

            conversationTurns.push(
              currentResponse.assistantMessage
            );

            if (currentResponse.toolCalls.length === 0) {
              break;
            }
          }

          const toolResultMessages: CanonicalMessage[] = [];

          for (const toolCall of currentResponse.toolCalls) {
            const { data, pending_action } =
              await runTwinTool(
                service as any,
                user.id,
                toolCall.name,
                toolCall.input || {}
              );

            if (pending_action) {
              pendingActions.push(pending_action);
            }

            toolResultMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolCall.name,
              content: JSON.stringify(data).slice(0, 6000)
            });
          }

          conversationTurns.push(...toolResultMessages);
        }

        break;
      } catch (e: any) {
        firstAttemptError =
          e?.message || `${provider} failed`;

        console.error(
          `[twin/chat] ${provider} failed; trying next provider`,
          e
        );
      }
    }

    if (!activeProvider) {
      throw new Error(
        `All AI providers failed. Last error: ${firstAttemptError || "unknown error"}`
      );
    }

    const out = finalText.trim() || "(no reply)";

    // Persist assistant response.
    const persistBody =
      pendingActions.length > 0
        ? `${out}\n\n<!--PENDING_ACTIONS:${JSON.stringify(
            pendingActions
          )}-->`
        : out;

    const { data: asstMsg } = await service
      .from("twin_chat_messages")
      .insert({
        user_id: user.id,
        role: "assistant",
        body: persistBody
      })
      .select("id, created_at")
      .single();

    return NextResponse.json({
      ok: true,
      provider: activeProvider,
      user_message_id:
        (userMsg as any)?.id ?? null,
      assistant: {
        id:
          (asstMsg as any)?.id ?? null,
        role: "assistant",
        body: out,
        created_at:
          (asstMsg as any)?.created_at ?? null
      },
      pending_actions: pendingActions
    });
  } catch (e: any) {
    console.error(
      "[twin/chat] all AI providers failed",
      e
    );

    return NextResponse.json(
      {
        error: "generation_failed",
        detail:
          e?.message ??
          "Couldn't reach any configured AI provider."
      },
      { status: 500 }
    );
  }
}