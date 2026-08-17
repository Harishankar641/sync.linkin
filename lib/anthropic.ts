import { EventEmitter } from "events";

/**
 * lib/anthropic.ts — a multi-provider fallback chain, all on free tiers.
 *
 * File name kept as `anthropic.ts` (rather than renamed to e.g. ai.ts)
 * because ~39 files across this codebase import from "@/lib/anthropic" —
 * renaming would mean touching every one of those call sites for a
 * cosmetic gain. What matters is what's inside: this implements just
 * enough of the Anthropic Messages API *shape* — requests AND responses —
 * so every existing call site works unmodified, regardless of which
 * underlying vendor actually answers the request.
 *
 * WHY A CHAIN, NOT ONE VENDOR: every free tier has a ceiling (daily quota,
 * per-minute rate limit, or both). Depending on a single provider means the
 * whole product goes down the moment one vendor's free ceiling is hit —
 * exactly the failure mode this file exists to avoid. Instead, each call
 * tries providers in order and falls through to the next on a transient
 * failure (429 rate limit, 503 overloaded, missing key), the same
 * "N vendors, graceful degrade" pattern already used elsewhere in this repo
 * for scraping (Apify → ScrapingDog, see .env.example). A provider that has
 * no API key configured is skipped instantly with zero network cost.
 *
 * CHAIN (in order — see PROVIDERS below to reorder/add/remove):
 *   1. Gemini      — GEMINI_API_KEY      — generous free tier, primary
 *   2. Groq         — GROQ_API_KEY        — free tier, extremely fast inference
 *   3. OpenRouter   — OPENROUTER_API_KEY  — free-tier model IDs (DeepSeek, Llama, Qwen…)
 *   4. Mistral      — MISTRAL_API_KEY     — free "La Plateforme" tier
 *   5. Cohere       — COHERE_API_KEY      — free trial tier, OpenAI-compatible endpoint
 * Only Gemini needs a translation layer (its own REST shape). Groq,
 * OpenRouter, Mistral, and Cohere all speak the OpenAI chat-completions
 * shape, so they share one adapter (`openAICompatCreate` /
 * `openAICompatStream`) parameterized by base URL + model — adding a 6th
 * OpenAI-compatible provider later is a 4-line entry in PROVIDERS, not a
 * new adapter.
 *
 * SUPPORTED (everything this codebase actually uses, verified by grep
 * across every call site before writing this):
 *   - messages.create({ model, max_tokens, system, messages, tools })
 *   - messages.stream({ model, max_tokens, system, messages }) with
 *     .on("text", cb) and .finalMessage()
 *   - multi-turn tool-use loops (tool_use / tool_result content blocks)
 *   - plain multi-turn text conversations
 *
 * NOT implemented (nothing in this codebase currently uses these — grepped
 * for all of them before deciding to skip): image/vision content blocks,
 * prompt caching (cache_control), extended thinking, temperature/top_p/
 * top_k/stop_sequences (zero call sites set these).
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Twin generation model. `TWIN_MODEL` name is kept for backward
// compatibility — every existing call site imports this exact name.
// Override with GEMINI_MODEL or TWIN_MODEL if you want a different Gemini
// model (e.g. gemini-3.1-pro-preview for higher quality, at a much lower
// free daily-request ceiling).
export const TWIN_MODEL =
  process.env.TWIN_MODEL || process.env.GEMINI_MODEL || "gemini-3.6-flash";

// ---------------------------------------------------------------------------
// Friendly error type — same shape/name as before so existing catch blocks
// and .message displays keep working unmodified.
// ---------------------------------------------------------------------------

export class FriendlyAnthropicError extends Error {
  public readonly status: number;
  public readonly retryable: boolean;
  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = "FriendlyAnthropicError";
    this.status = status;
    this.retryable = retryable;
  }
}

type ErrLike = { status?: number; message?: string };

function isRateLimited(e: ErrLike): boolean {
  return e.status === 429 || /rate.?limit|quota/i.test(e.message ?? "");
}
function isOverloaded(e: ErrLike): boolean {
  return e.status === 503 || /overloaded|unavailable/i.test(e.message ?? "");
}
function isTransient(e: ErrLike): boolean {
  const s = e.status ?? 0;
  return (
    isOverloaded(e) || isRateLimited(e) || s === 500 || s === 502 || s === 504
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wraps any call with exponential-backoff retry on transient failures.
 * Unchanged in behavior from the original Anthropic-SDK version — same
 * signature, same usage pattern at every call site.
 */
export async function withAnthropicRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; label?: string } = {}
): Promise<T> {
  const retries = opts.retries ?? 4;
  let backoff = 800;
  let lastErr: ErrLike = {};
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const overloaded = isOverloaded(e);
      const retryable = isTransient(e);
      if (!retryable || attempt === retries) {
        const friendly = overloaded
          ? "The AI is overloaded right now — give it a few seconds and try again."
          : isRateLimited(e)
            ? "Hit the AI rate limit (Gemini's free tier has daily/per-minute caps). Wait a bit and try again."
            : e?.message || "AI call failed. Retrying...";
        throw new FriendlyAnthropicError(friendly, e?.status ?? 0, retryable);
      }
      console.warn(
        `[anthropic-retry${opts.label ? ":" + opts.label : ""}] attempt ${
          attempt + 1
        }/${retries + 1} failed (status ${e?.status}), backing off ${backoff}ms`
      );
      const jitter = Math.random() * 200;
      await sleep(backoff + jitter);
      backoff *= 2;
    }
  }
  throw new FriendlyAnthropicError(
    "AI call exhausted retries",
    (lastErr as any)?.status ?? 0,
    true
  );
}

// ---------------------------------------------------------------------------
// Anthropic-shaped types (just the subset this codebase touches)
// ---------------------------------------------------------------------------

type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
  // Gemini 3 thought signatures must be preserved exactly across
  // multi-step function-calling turns. The Anthropic-shaped adapter keeps
  // this opaque value attached to the original tool_use block.
  thought_signature?: string;
};
type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
};
type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

type AnthropicMessageParam = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

type AnthropicToolDef = {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
};

type CreateParams = {
  model?: string;
  max_tokens?: number;
  system?: string;
  messages: AnthropicMessageParam[];
  tools?: AnthropicToolDef[];
};

type AnthropicResponse = {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: AnthropicContentBlock[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
};

function randomId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${rand}`;
}

// ---------------------------------------------------------------------------
// Anthropic <-> Gemini request translation
// ---------------------------------------------------------------------------

function toGeminiContents(messages: AnthropicMessageParam[]) {
  // tool_result blocks only carry the CALLING tool_use's id, not its name —
  // Gemini's functionResponse needs the name. Build an id->name map by
  // scanning every tool_use block across the whole conversation first.
  const idToName: Record<string, string> = {};
  for (const m of messages) {
    if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === "tool_use") idToName[block.id] = block.name;
      }
    }
  }

  return messages.map((m) => {
    const role = m.role === "assistant" ? "model" : "user";
    const parts: any[] = [];

    if (typeof m.content === "string") {
      parts.push({ text: m.content });
    } else {
      for (const block of m.content) {
        if (block.type === "text") {
          parts.push({ text: block.text });
        } else if (block.type === "tool_use") {
          const functionCallPart: any = {
            functionCall: { name: block.name, args: block.input || {} }
          };
          // IMPORTANT: Gemini 3 requires the exact thoughtSignature returned
          // on the functionCall to be echoed back in the same Part. Do not
          // regenerate, move, or merge this value.
          if (block.thought_signature) {
            functionCallPart.thoughtSignature = block.thought_signature;
          }
          parts.push(functionCallPart);
        } else if (block.type === "tool_result") {
          const name = idToName[block.tool_use_id] || "unknown_tool";
          // Every call site in this codebase JSON.stringify's the tool
          // result into a plain string before building this block — wrap
          // it back into an object since functionResponse.response must
          // be a JSON object, not a raw string.
          let response: Record<string, unknown>;
          try {
            const parsed = JSON.parse(block.content);
            response =
              parsed && typeof parsed === "object"
                ? parsed
                : { result: parsed };
          } catch {
            response = { result: block.content };
          }
          parts.push({ functionResponse: { name, response } });
        }
      }
    }

    return { role, parts: parts.length ? parts : [{ text: "" }] };
  });
}

function toolsToGemini(tools?: AnthropicToolDef[]) {
  if (!tools || tools.length === 0) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description || "",
        parameters: t.input_schema
      }))
    }
  ];
}

function geminiPartsToAnthropicContent(parts: any[]): AnthropicContentBlock[] {
  const out: AnthropicContentBlock[] = [];
  for (const part of parts || []) {
    if (part.functionCall) {
      out.push({
        type: "tool_use",
        id: randomId("toolu"),
        name: part.functionCall.name,
        input: part.functionCall.args || {},
        ...(part.thoughtSignature
          ? { thought_signature: part.thoughtSignature }
          : {})
      });
    } else if (typeof part.text === "string") {
      out.push({ type: "text", text: part.text });
    }
  }
  return out;
}

async function geminiError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}) as any);
  const message =
    body?.error?.message || `Gemini request failed (HTTP ${res.status})`;
  const err: any = new Error(message);
  err.status = res.status;
  throw err;
}

function assertKey() {
  if (!GEMINI_API_KEY) {
    // Mirrors the shape of the Anthropic SDK's own "key required" error so
    // existing error-handling / friendly-message logic still applies.
    const err: any = new Error(
      "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey and add it to .env.local."
    );
    err.status = 401;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Public client — same shape as `new Anthropic(...)`: `anthropic.messages.create(...)`
// ---------------------------------------------------------------------------

async function geminiCreate(params: CreateParams): Promise<AnthropicResponse> {
  assertKey();
  const model = params.model || TWIN_MODEL;

  const body: Record<string, unknown> = {
    contents: toGeminiContents(params.messages || []),
    generationConfig: { maxOutputTokens: params.max_tokens || 1024 }
  };
  if (params.system) {
    body.systemInstruction = { parts: [{ text: params.system }] };
  }
  const tools = toolsToGemini(params.tools);
  if (tools) body.tools = tools;

  const res = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }
  );
  if (!res.ok) await geminiError(res);

  const json = await res.json();
  const candidate = json.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const content = geminiPartsToAnthropicContent(parts);
  const hasToolUse = content.some((c) => c.type === "tool_use");

  return {
    id: randomId("msg"),
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason:
      candidate?.finishReason === "MAX_TOKENS"
        ? "max_tokens"
        : hasToolUse
          ? "tool_use"
          : "end_turn",
    usage: {
      input_tokens: json.usageMetadata?.promptTokenCount || 0,
      output_tokens: json.usageMetadata?.candidatesTokenCount || 0
    }
  };
}

/**
 * Streams from Gemini into an already-created EventEmitter, emitting
 * "text" chunks as they arrive. Throws (without emitting a "message") if
 * the request fails before any bytes came back, which is what lets the
 * caller in `streamCreate` below fall through to the next provider.
 */
function geminiStreamInto(
  params: CreateParams,
  emitter: EventEmitter
): Promise<AnthropicResponse> {
  return (async () => {
    assertKey();
    const model = params.model || TWIN_MODEL;
    const body: Record<string, unknown> = {
      contents: toGeminiContents(params.messages || []),
      generationConfig: { maxOutputTokens: params.max_tokens || 1024 }
    };
    if (params.system) {
      body.systemInstruction = { parts: [{ text: params.system }] };
    }

    const res = await fetch(
      `${GEMINI_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      }
    );
    if (!res.ok || !res.body) await geminiError(res);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let fullText = "";
    let finishReason = "STOP";
    let usage = { promptTokenCount: 0, candidatesTokenCount: 0 };

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;
        let chunk: any;
        try {
          chunk = JSON.parse(jsonStr);
        } catch {
          continue;
        }
        const cand = chunk.candidates?.[0];
        const text = (cand?.content?.parts || [])
          .map((p: any) => p.text || "")
          .join("");
        if (text) {
          fullText += text;
          emitter.emit("text", text);
        }
        if (cand?.finishReason) finishReason = cand.finishReason;
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
      }
    }

    const finalMsg: AnthropicResponse = {
      id: randomId("msg"),
      type: "message",
      role: "assistant",
      model,
      content: [{ type: "text", text: fullText }],
      stop_reason: finishReason === "MAX_TOKENS" ? "max_tokens" : "end_turn",
      usage: {
        input_tokens: usage.promptTokenCount || 0,
        output_tokens: usage.candidatesTokenCount || 0
      }
    };
    emitter.emit("message", finalMsg);
    return finalMsg;
  })();
}

// ---------------------------------------------------------------------------
// OpenAI-compatible adapter — shared by Groq, OpenRouter, Mistral, Cohere.
// Each of those vendors' chat-completions endpoint is (near-)identical to
// OpenAI's, so one translation layer covers all four instead of writing a
// bespoke client per vendor.
// ---------------------------------------------------------------------------

type OpenAICompatProvider = {
  name: string;
  apiKey: string;
  baseUrl: string; // full .../chat/completions URL
  model: string;
  extraHeaders?: Record<string, string>;
};

/**
 * Provider chain, in fallback order. Every entry after Gemini shares the
 * OpenAI-compatible adapter below — to add a 6th provider, add one entry
 * here (and document its env var in .env.example); no new client code.
 */
function openAICompatProviders(model?: string): OpenAICompatProvider[] {
  return [
    {
      name: "groq",
      apiKey: process.env.GROQ_API_KEY || "",
      baseUrl: "https://api.groq.com/openai/v1/chat/completions",
      model: model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
    },
    {
      name: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY || "",
      baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      // ":free" model IDs are OpenRouter's zero-cost tier. Overridable in
      // case a specific free model gets deprecated/renamed.
      model:
        model ||
        process.env.OPENROUTER_MODEL ||
        "deepseek/deepseek-chat-v3.1:free",
      extraHeaders: {
        // OpenRouter uses these to attribute + rate-limit-bucket traffic;
        // harmless to omit but recommended by their docs.
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://syncedin.org",
        "X-Title": "SyncedIn"
      }
    },
    {
      name: "mistral",
      apiKey: process.env.MISTRAL_API_KEY || "",
      baseUrl: "https://api.mistral.ai/v1/chat/completions",
      model: model || process.env.MISTRAL_MODEL || "mistral-small-latest"
    },
    {
      name: "cohere",
      apiKey: process.env.COHERE_API_KEY || "",
      // Cohere's OpenAI-compatibility endpoint — same chat-completions
      // shape as the others, so it needs no bespoke handling either.
      baseUrl: "https://api.cohere.com/compatibility/v1/chat/completions",
      model: model || process.env.COHERE_MODEL || "command-r-plus"
    }
  ].filter((p) => p.apiKey); // skip anything with no key configured — zero cost
}

function toolsToOpenAI(tools?: AnthropicToolDef[]) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description || "",
      parameters: t.input_schema
    }
  }));
}

/** Anthropic message list -> OpenAI chat-completions message list. */
function toOpenAIMessages(params: CreateParams) {
  const idToName: Record<string, string> = {};
  for (const m of params.messages) {
    if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === "tool_use") idToName[block.id] = block.name;
      }
    }
  }

  const out: any[] = [];
  if (params.system) out.push({ role: "system", content: params.system });

  for (const m of params.messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    const textParts: string[] = [];
    const toolCalls: any[] = [];
    for (const block of m.content) {
      if (block.type === "text") {
        textParts.push(block.text);
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input || {})
          }
        });
      } else if (block.type === "tool_result") {
        // tool_result blocks become their own "tool" role message,
        // matched back to the call by tool_call_id — must come AFTER
        // the assistant message containing the corresponding tool_call.
        out.push({
          role: "tool",
          tool_call_id: block.tool_use_id,
          content: block.content
        });
      }
    }
    if (toolCalls.length) {
      out.push({
        role: "assistant",
        content: textParts.join("") || null,
        tool_calls: toolCalls
      });
    } else if (textParts.length) {
      out.push({ role: m.role, content: textParts.join("") });
    }
  }
  return out;
}

function openAIChoiceToAnthropicContent(message: any): AnthropicContentBlock[] {
  const out: AnthropicContentBlock[] = [];
  if (message?.content) out.push({ type: "text", text: message.content });
  for (const tc of message?.tool_calls || []) {
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(tc.function?.arguments || "{}");
    } catch {
      /* leave empty rather than crash the whole response on bad JSON */
    }
    out.push({
      type: "tool_use",
      id: tc.id || randomId("toolu"),
      name: tc.function?.name || "unknown_tool",
      input
    });
  }
  return out;
}

async function openAICompatError(res: Response, provider: string): Promise<never> {
  const body = await res.json().catch(() => ({}) as any);
  const message =
    body?.error?.message || `${provider} request failed (HTTP ${res.status})`;
  const err: any = new Error(`[${provider}] ${message}`);
  err.status = res.status;
  throw err;
}

async function openAICompatCreate(
  provider: OpenAICompatProvider,
  params: CreateParams
): Promise<AnthropicResponse> {
  const res = await fetch(provider.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`,
      ...(provider.extraHeaders || {})
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: params.max_tokens || 1024,
      messages: toOpenAIMessages(params),
      tools: toolsToOpenAI(params.tools)
    })
  });
  if (!res.ok) await openAICompatError(res, provider.name);

  const json = await res.json();
  const choice = json.choices?.[0];
  const content = openAIChoiceToAnthropicContent(choice?.message);
  const hasToolUse = content.some((c) => c.type === "tool_use");

  return {
    id: json.id || randomId("msg"),
    type: "message",
    role: "assistant",
    model: `${provider.name}:${provider.model}`,
    content,
    stop_reason:
      choice?.finish_reason === "length"
        ? "max_tokens"
        : hasToolUse
          ? "tool_use"
          : "end_turn",
    usage: {
      input_tokens: json.usage?.prompt_tokens || 0,
      output_tokens: json.usage?.completion_tokens || 0
    }
  };
}

/** Same fallback-before-first-byte contract as geminiStreamInto. */
function openAICompatStreamInto(
  provider: OpenAICompatProvider,
  params: CreateParams,
  emitter: EventEmitter
): Promise<AnthropicResponse> {
  return (async () => {
    const res = await fetch(provider.baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${provider.apiKey}`,
        ...(provider.extraHeaders || {})
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: params.max_tokens || 1024,
        messages: toOpenAIMessages(params),
        stream: true
      })
    });
    if (!res.ok || !res.body) await openAICompatError(res, provider.name);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let fullText = "";
    let finishReason = "stop";

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        let chunk: any;
        try {
          chunk = JSON.parse(jsonStr);
        } catch {
          continue;
        }
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          emitter.emit("text", delta);
        }
        if (chunk.choices?.[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
      }
    }

    const finalMsg: AnthropicResponse = {
      id: randomId("msg"),
      type: "message",
      role: "assistant",
      model: `${provider.name}:${provider.model}`,
      content: [{ type: "text", text: fullText }],
      stop_reason: finishReason === "length" ? "max_tokens" : "end_turn",
      usage: { input_tokens: 0, output_tokens: 0 }
    };
    emitter.emit("message", finalMsg);
    return finalMsg;
  })();
}

// ---------------------------------------------------------------------------
// Public client — same shape as `new Anthropic(...)`: `anthropic.messages.create(...)`
// Tries every configured provider in order, falling through on transient
// failure (rate limit / overload / missing key) until one succeeds.
// ---------------------------------------------------------------------------

async function create(params: CreateParams): Promise<AnthropicResponse> {
  const attempts: Array<{ name: string; run: () => Promise<AnthropicResponse> }> = [];
  if (GEMINI_API_KEY) attempts.push({ name: "gemini", run: () => geminiCreate(params) });
  for (const p of openAICompatProviders()) {
    attempts.push({ name: p.name, run: () => openAICompatCreate(p, params) });
  }

  if (attempts.length === 0) {
    const err: any = new Error(
      "No AI provider configured. Set at least one of GEMINI_API_KEY, GROQ_API_KEY, " +
        "OPENROUTER_API_KEY, MISTRAL_API_KEY, or COHERE_API_KEY — all have free tiers " +
        "(see .env.example)."
    );
    err.status = 401;
    throw err;
  }

  let lastErr: any = null;
  for (const attempt of attempts) {
    try {
      return await attempt.run();
    } catch (e: any) {
      lastErr = e;
      console.warn(
        `[ai-chain] ${attempt.name} failed (status ${e?.status}): ${e?.message} — trying next provider`
      );
      // Only fall through on transient/availability failures. A genuine
      // 400 (bad request — our own bug) would fail identically on every
      // provider, so surface it immediately rather than burning through
      // the whole chain for nothing.
      if (!isTransient(e) && e?.status !== 401 && e?.status !== 403) throw e;
    }
  }
  throw lastErr;
}

/**
 * Mirrors the Anthropic SDK's MessageStream: an EventEmitter with a
 * `.finalMessage()` promise. Only the "text" event is implemented — the
 * only one this codebase actually listens for (grepped before writing
 * this). Falls through the same provider chain as `create`, but only
 * before the first byte of a given attempt — once a provider starts
 * streaming text into the UI, switching providers mid-stream would
 * produce a garbled response, so a mid-stream failure surfaces as an
 * error rather than silently swapping vendors.
 */
function streamCreate(
  params: CreateParams
): EventEmitter & { finalMessage: () => Promise<AnthropicResponse> } {
  const emitter = new EventEmitter() as EventEmitter & {
    finalMessage: () => Promise<AnthropicResponse>;
  };

  const attempts: Array<{ name: string; run: () => Promise<AnthropicResponse> }> = [];
  if (GEMINI_API_KEY)
    attempts.push({ name: "gemini", run: () => geminiStreamInto(params, emitter) });
  for (const p of openAICompatProviders()) {
    attempts.push({
      name: p.name,
      run: () => openAICompatStreamInto(p, params, emitter)
    });
  }

  const finalPromise: Promise<AnthropicResponse> = (async () => {
    if (attempts.length === 0) {
      const err: any = new Error(
        "No AI provider configured. Set at least one of GEMINI_API_KEY, GROQ_API_KEY, " +
          "OPENROUTER_API_KEY, MISTRAL_API_KEY, or COHERE_API_KEY (see .env.example)."
      );
      err.status = 401;
      throw err;
    }
    let lastErr: any = null;
    for (const attempt of attempts) {
      try {
        return await attempt.run();
      } catch (e: any) {
        lastErr = e;
        console.warn(
          `[ai-chain:stream] ${attempt.name} failed (status ${e?.status}): ${e?.message} — trying next provider`
        );
        if (!isTransient(e) && e?.status !== 401 && e?.status !== 403) throw e;
      }
    }
    throw lastErr;
  })();

  // Swallow unhandled-rejection noise — real errors surface through
  // `.finalMessage()`, which every call site already awaits.
  finalPromise.catch(() => {});

  emitter.finalMessage = () => finalPromise;
  return emitter;
}

export const anthropic = {
  messages: {
    create,
    stream: streamCreate
  }
};
