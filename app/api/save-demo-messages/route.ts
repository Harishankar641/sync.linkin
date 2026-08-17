import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Persist the generated demo conversation messages onto a pending
 * invite, so every subsequent visitor to /<slug> sees the SAME
 * conversation without re-running the LLM.
 *
 * Public endpoint (no auth) — pending invites are public landing
 * pages and the conversation is itself public, so anyone with the
 * slug can save / view the demo. We only WRITE when the row doesn't
 * already have demo_messages (so a malicious actor can't overwrite
 * a generated demo someone else saw).
 *
 * Body: { slug, messages: [{ sender, text }] }
 */
export async function POST(req: Request) {
  let body: {
    slug?: string;
    messages?: Array<{ sender: string; text: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const slug = (body.slug ?? "").toLowerCase().trim();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!slug || messages.length === 0) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const service = createServiceClient();
  // Only persist if the row doesn't already have a demo cached.
  // This makes the save idempotent + prevents a later visitor from
  // overwriting the canonical conversation an earlier visitor saw.
  let existing: any = null;
  try {
    const { data } = await service
      .from("pending_invites")
      .select("slug, demo_messages")
      .eq("slug", slug)
      .maybeSingle();
    existing = data ?? null;
  } catch {
    /* schema column may not be migrated yet — return ok with a hint */
    return NextResponse.json(
      {
        ok: false,
        error: "schema_missing",
        detail:
          "Run: alter table public.pending_invites add column if not exists demo_messages jsonb; alter table public.pending_invites add column if not exists demo_generated_at timestamptz;"
      },
      { status: 200 }
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "slug_not_found" }, { status: 404 });
  }
  if (
    existing.demo_messages &&
    Array.isArray(existing.demo_messages) &&
    existing.demo_messages.length > 0
  ) {
    // Already cached — keep the original.
    return NextResponse.json({ ok: true, kept_existing: true });
  }
  // Sanitize: clamp to 40 messages, strip non-string sender/text.
  const clean = messages
    .slice(0, 40)
    .map((m) => ({
      sender:
        (m.sender || "").toLowerCase() === "recipient"
          ? "recipient"
          : "inviter",
      text: typeof m.text === "string" ? m.text.toString().slice(0, 4000) : ""
    }))
    .filter((m) => m.text.trim().length > 0);
  if (clean.length === 0) {
    return NextResponse.json({ error: "no_clean_messages" }, { status: 400 });
  }

  const { error } = await service
    .from("pending_invites")
    .update({
      demo_messages: clean,
      demo_generated_at: new Date().toISOString()
    })
    .eq("slug", slug);
  if (error) {
    if (/demo_messages|column|schema cache/i.test(error.message)) {
      return NextResponse.json(
        {
          ok: false,
          error: "schema_missing",
          detail:
            "Run: alter table public.pending_invites add column if not exists demo_messages jsonb; alter table public.pending_invites add column if not exists demo_generated_at timestamptz;"
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: "save_failed", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, saved: clean.length });
}
