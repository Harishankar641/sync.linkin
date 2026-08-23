"use server";

import { redirect } from "next/navigation";
import {
  createClient,
  createServiceClient
} from "@/lib/supabase/server";
import { notifyNewConnection } from "@/lib/notify";
import { assignConversationSlug } from "@/lib/conversationSlugServer";
import { evolveRelationshipMemory } from "@/lib/relationship-memory";
const PENDING_LIMIT = 10;
/**
 * Dead-weight guard. Counts proposals the user has NOT acted on
 * (conversations with a summary set, no agreement_response from
 * this user).
 */
async function countOwedProposals(
  userId: string
): Promise<number> {
  const service = createServiceClient();

  try {
    const { data: convs } = await service
      .from("conversations")
      .select(
        "id, participant_a, participant_b, summary"
      )
      .or(
        `participant_a.eq.${userId},participant_b.eq.${userId}`
      )
      .not("summary", "is", null);

    const ids = ((convs ?? []) as any[]).map(
      (c) => c.id
    );

    if (ids.length === 0) return 0;

    const { data: resps } = await service
      .from("agreement_responses")
      .select("conversation_id")
      .eq("user_id", userId)
      .in("conversation_id", ids);

    const responded = new Set(
      ((resps ?? []) as any[]).map(
        (r) => r.conversation_id
      )
    );

    return ids.filter(
      (id: string) => !responded.has(id)
    ).length;
  } catch {
    return 0;
  }
}


async function openConversationBetween(
  userId: string,
  otherId: string
) {
  const supabase = createClient();

  // Check whether a conversation already exists.
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(participant_a.eq.${userId},participant_b.eq.${otherId}),and(participant_a.eq.${otherId},participant_b.eq.${userId})`
    )
    .maybeSingle();

  if (existing) {
    return existing.id as string;
  }

  // Dead-weight guard.
  const owed = await countOwedProposals(userId);

  if (owed >= PENDING_LIMIT) {
    return {
      blocked: "pending_limit" as const,
      owed
    };
  }

  // Create the conversation.
  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({
      participant_a: userId,
      participant_b: otherId
    })
    .select("id")
    .single();

  if (error || !conv) {
    console.error(
      "conversation insert failed",
      error
    );
    return null;
  }

  // =========================================================
  // AUTOMATIC RELATIONSHIP MEMORY
  // =========================================================
  //
  // A new conversation creates a relationship-memory record
  // for both directions.
  //
  // userId  -> otherId
  // otherId -> userId
  //
  // Relationship-memory failure must NOT break conversation
  // creation, so this intentionally runs fire-and-forget.
  Promise.all([
    evolveRelationshipMemory({
      userId,
      personId: otherId,
      event: "conversation",
      relationshipType: "conversation"
    }),

    evolveRelationshipMemory({
      userId: otherId,
      personId: userId,
      event: "conversation",
      relationshipType: "conversation"
    })
  ]).catch((e) => {
    console.warn(
      "[new-conv] relationship memory update failed:",
      e
    );
  });

  // Assign short slug for /c/<slug> resolution.
  assignConversationSlug(
    conv.id as string
  ).catch(() => {});

  // Notify both sides of the new connection.
  notifyNewConnection({
    conversationId: conv.id as string,
    participantA: userId,
    participantB: otherId
  }).catch((e) => {
    console.warn(
      "[new-conv] notify failed",
      e
    );
  });

  return conv.id as string;
}

/**
 * Start a conversation by email.
 *
 * Kept for backwards compatibility.
 */
export async function startConversation(
  formData: FormData
) {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = String(
    formData.get("email") ?? ""
  )
    .trim()
    .toLowerCase();

  if (!email) {
    redirect(
      "/conversations/new?error=email"
    );
  }

  const service = createServiceClient();

  const { data: other } = await service
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!other) {
    redirect(
      "/conversations/new?error=not_found"
    );
  }

  if (other.id === user.id) {
    redirect(
      "/conversations/new?error=self"
    );
  }

  const result =
    await openConversationBetween(
      user.id,
      other.id
    );

  if (!result) {
    redirect(
      "/conversations/new?error=create"
    );
  }

  if (
    typeof result === "object" &&
    "blocked" in result
  ) {
    redirect(
      `/proposals?blocked=pending&owed=${result.owed}`
    );
  }

  redirect(
    `/conversations/${result}`
  );
}

/**
 * Start a conversation by user_id.
 *
 * Used by the name-search + Exa picker UI.
 */
export async function startConversationByUserId(
  formData: FormData
) {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const otherId = String(
    formData.get("user_id") ?? ""
  ).trim();

  if (!otherId) {
    redirect(
      "/conversations/new?error=not_found"
    );
  }

  if (otherId === user.id) {
    redirect(
      "/conversations/new?error=self"
    );
  }

  const result =
    await openConversationBetween(
      user.id,
      otherId
    );

  if (!result) {
    redirect(
      "/conversations/new?error=create"
    );
  }

  if (
    typeof result === "object" &&
    "blocked" in result
  ) {
    redirect(
      `/proposals?blocked=pending&owed=${result.owed}`
    );
  }

  redirect(
    `/conversations/${result}`
  );
}