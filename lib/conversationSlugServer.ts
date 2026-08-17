/**
 * Server-side helpers around the conversation short-slug (#69).
 *
 * - `assignConversationSlug(conversationId)` — looks up the conversation
 *   + both participants' display_name/email, builds the slug, and writes
 *   it to conversations.short_slug. Idempotent: bails if already set.
 * - `resolveConversationBySlug(slug)` — used by /c/[slug] to find the
 *   conversation UUID for redirect.
 *
 * All writes go through the service client (RLS bypass) — slug is a
 * derived public-ish identifier, not a security boundary.
 */

import { createServiceClient } from "@/lib/supabase/server";
import {
  buildConversationSlug,
  profileSlugName
} from "@/lib/conversationSlug";

export async function assignConversationSlug(
  conversationId: string
): Promise<string | null> {
  if (!conversationId) return null;
  const service = createServiceClient();
  try {
    const { data: conv } = await service
      .from("conversations")
      .select("id, participant_a, participant_b, short_slug")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return null;
    if ((conv as any).short_slug) return (conv as any).short_slug as string;

    const { data: people } = await service
      .from("profiles")
      .select("id, display_name, email, handle")
      .in("id", [
        (conv as any).participant_a,
        (conv as any).participant_b
      ]);
    const pa = (people ?? []).find(
      (p: any) => p.id === (conv as any).participant_a
    );
    const pb = (people ?? []).find(
      (p: any) => p.id === (conv as any).participant_b
    );

    const slug = buildConversationSlug({
      conversationId,
      nameA: pa ? profileSlugName(pa as any) : null,
      nameB: pb ? profileSlugName(pb as any) : null
    });

    // Unique index will reject collisions — fall back to suffix retry.
    let candidate = slug;
    for (let i = 0; i < 4; i++) {
      const { error } = await service
        .from("conversations")
        .update({ short_slug: candidate })
        .eq("id", conversationId)
        .is("short_slug", null);
      if (!error) return candidate;
      if (/duplicate key|unique constraint/i.test(error.message)) {
        candidate = `${slug}-${Math.random().toString(36).slice(2, 4)}`;
        continue;
      }
      // Schema not yet migrated — swallow so caller doesn't crash.
      if (/column .* does not exist|schema cache/i.test(error.message)) {
        return null;
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveConversationBySlug(
  slug: string
): Promise<string | null> {
  const s = (slug || "").toLowerCase().trim();
  if (!s) return null;
  const service = createServiceClient();
  try {
    const { data } = await service
      .from("conversations")
      .select("id")
      .eq("short_slug", s)
      .maybeSingle();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}
