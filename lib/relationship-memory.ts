import { createClient } from "@/lib/supabase/server";

type InteractionEvent =
  | "conversation"
  | "message"
  | "meaningful_exchange"
  | "introduction"
  | "introduction_accepted"
  | "collaboration"
  | "referral"
  | "mentorship"
  | "successful_outcome"
  | "failed_outcome";

type RelationshipMemory = {
  id: string;
  user_id: string;
  person_id: string;
  relationship_type: string | null;
  relationship_strength: number;
  trust_score: number;
  interaction_count: number;
  successful_introductions: number;
  failed_introductions: number;
  last_interaction_at: string | null;
};
const EVENT_DELTA: Record<
  InteractionEvent,
  {
    strength: number;
    trust: number;
  }
> = {
  conversation: {
    strength: 10,
    trust: 5
  },

  message: {
    strength: 2,
    trust: 1
  },

  meaningful_exchange: {
    strength: 5,
    trust: 4
  },

  introduction: {
    strength: 8,
    trust: 3
  },

  introduction_accepted: {
    strength: 12,
    trust: 8
  },

  collaboration: {
    strength: 15,
    trust: 12
  },

  referral: {
    strength: 10,
    trust: 8
  },

  mentorship: {
    strength: 12,
    trust: 10
  },

  successful_outcome: {
    strength: 20,
    trust: 15
  },

  failed_outcome: {
    strength: -5,
    trust: -8
  }
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
export function isMeaningfulExchange(
  message: string
): boolean {
  const text = message.trim();

  if (!text) {
    return false;
  }

  // Ignore very short acknowledgements.
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const trivialMessages = new Set([
    "ok",
    "okay",
    "yes",
    "no",
    "sure",
    "thanks",
    "thank you",
    "cool",
    "great",
    "nice",
    "lol",
    "haha",
    "hey",
    "hi",
    "hello",
    "👍",
    "👌",
    "🙂",
    "😊"
  ]);

  if (trivialMessages.has(normalized)) {
    return false;
  }

  /*
   * A meaningful exchange should contain enough substance
   * to represent an actual contribution to the conversation.
   */
  const words = text
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 12) {
    return true;
  }

  /*
   * Questions are generally stronger relationship signals
   * than simple acknowledgements.
   */
  if (text.includes("?") && words.length >= 6) {
    return true;
  }

  /*
   * Detect practical/action-oriented language.
   */
  const meaningfulTerms = [
    "project",
    "idea",
    "opportunity",
    "build",
    "building",
    "work",
    "working",
    "company",
    "business",
    "startup",
    "collaborate",
    "collaboration",
    "introduce",
    "introduction",
    "referral",
    "help",
    "goal",
    "plan",
    "planning",
    "meeting",
    "connect",
    "skill",
    "experience",
    "fund",
    "funding",
    "invest",
    "investment"
  ];

  if (
    meaningfulTerms.some((term) =>
      normalized.includes(term)
    ) &&
    words.length >= 5
  ) {
    return true;
  }

  return false;
}
/**
 * Keep user_a/user_b direction consistent.
 *
 * Your database stores:
 *   user_id  = the person whose network this belongs to
 *   person_id = the other person
 *
 * We therefore update both directions when appropriate.
 */
async function getRelationship(
  supabase: any,
  userId: string,
  personId: string
): Promise<RelationshipMemory | null> {
  const { data, error } = await supabase
    .from("relationship_memory")
    .select(
      `
        id,
        user_id,
        person_id,
        relationship_type,
        relationship_strength,
        trust_score,
        interaction_count,
        successful_introductions,
        failed_introductions,
        last_interaction_at
      `
    )
    .eq("user_id", userId)
    .eq("person_id", personId)
    .maybeSingle();

  if (error) {
    console.error(
      "[relationship-memory] read failed:",
      error
    );
    return null;
  }

  return data as RelationshipMemory | null;
}


/**
 * Apply time-based decay to an existing relationship.
 *
 * Recent interactions keep a relationship strong.
 * Long periods without interaction gradually reduce strength
 * and trust.
 *
 * Decay is capped so a relationship never becomes negative.
 */
function applyRelationshipDecay(
  relationship: RelationshipMemory,
  now: Date
): {
  strength: number;
  trust: number;
} {
  if (!relationship.last_interaction_at) {
    return {
      strength: clamp(
        Number(relationship.relationship_strength ?? 0)
      ),
      trust: clamp(
        Number(relationship.trust_score ?? 0)
      )
    };
  }

  const lastInteraction =
    new Date(
      relationship.last_interaction_at
    );

  if (Number.isNaN(lastInteraction.getTime())) {
    return {
      strength: clamp(
        Number(relationship.relationship_strength ?? 0)
      ),
      trust: clamp(
        Number(relationship.trust_score ?? 0)
      )
    };
  }

  const elapsedMs =
    now.getTime() -
    lastInteraction.getTime();

  const elapsedDays =
    Math.max(
      0,
      elapsedMs / (1000 * 60 * 60 * 24)
    );

  /*
   * No decay during the first 14 days.
   */
  if (elapsedDays <= 14) {
    return {
      strength: clamp(
        Number(relationship.relationship_strength ?? 0)
      ),
      trust: clamp(
        Number(relationship.trust_score ?? 0)
      )
    };
  }

  /*
   * After 14 days:
   *
   * strength: 1 point per 14 inactive days
   * trust:    0.5 point per 14 inactive days
   *
   * This keeps decay gradual rather than destroying
   * relationships after a short period of inactivity.
   */
  const inactiveDays =
    elapsedDays - 14;

  const strengthDecay =
    Math.floor(inactiveDays / 14);

  const trustDecay =
    Math.floor(inactiveDays / 14) * 0.5;

  return {
    strength: clamp(
      Number(
        relationship.relationship_strength ?? 0
      ) - strengthDecay
    ),

    trust: clamp(
      Number(
        relationship.trust_score ?? 0
      ) - trustDecay
    )
  };
}
/**
 * Automatically evolve relationship memory after a real event.
 *
 * This is intentionally deterministic.
 * AI is NOT used to randomly invent relationship strength.
 */
export async function evolveRelationshipMemory({
  userId,
  personId,
  event,
  relationshipType,
  incrementInteraction = true,
  successfulIntroduction = false,
  failedIntroduction = false
}: {
  userId: string;
  personId: string;
  event: InteractionEvent;
  relationshipType?: string;
  incrementInteraction?: boolean;
  successfulIntroduction?: boolean;
  failedIntroduction?: boolean;
}): Promise<RelationshipMemory | null> {
  if (!userId || !personId) {
    return null;
  }

  if (userId === personId) {
    return null;
  }

  const supabase = await createClient();

  const delta = EVENT_DELTA[event];

  if (!delta) {
    return null;
  }

  const existing = await getRelationship(
    supabase,
    userId,
    personId
  );

  const nowDate = new Date();
const now = nowDate.toISOString();

  /*
   * First interaction:
   * create the persistent relationship.
   */
  if (!existing) {
    const initialStrength = clamp(
      Math.max(10, delta.strength)
    );

    const initialTrust = clamp(
      Math.max(10, delta.trust)
    );

    const { data, error } = await supabase
      .from("relationship_memory")
      .insert({
        user_id: userId,
        person_id: personId,

        relationship_type:
          relationshipType ?? "conversation",

        relationship_strength: initialStrength,

        trust_score: initialTrust,

        interaction_count:
          incrementInteraction ? 1 : 0,

        last_interaction_at: now,

        shared_context: [],

        shared_topics: [],

        successful_introductions:
          successfulIntroduction ? 1 : 0,

        failed_introductions:
          failedIntroduction ? 1 : 0,

        notes:
          "Automatically created from real interaction."
      })
      .select(
        `
          id,
          user_id,
          person_id,
          relationship_type,
          relationship_strength,
          trust_score,
          interaction_count,
          successful_introductions,
          failed_introductions,
          last_interaction_at
        `
      )
      .single();

    if (error) {
      console.error(
        "[relationship-memory] insert failed:",
        error
      );
      return null;
    }

    return data as RelationshipMemory;
  }

  /*
   * Existing relationship:
   * evolve the stored values.
   */
  const decayed = applyRelationshipDecay(
  existing,
  nowDate
);

const nextStrength = clamp(
  decayed.strength + delta.strength
);

const nextTrust = clamp(
  decayed.trust + delta.trust
);

  const nextInteractionCount =
    Number(existing.interaction_count ?? 0) +
    (incrementInteraction ? 1 : 0);

  const nextSuccessfulIntroductions =
    Number(
      existing.successful_introductions ?? 0
    ) +
    (successfulIntroduction ? 1 : 0);

  const nextFailedIntroductions =
    Number(
      existing.failed_introductions ?? 0
    ) +
    (failedIntroduction ? 1 : 0);

  const { data, error } = await supabase
    .from("relationship_memory")
    .update({
      relationship_type:
        relationshipType ??
        existing.relationship_type ??
        "conversation",

      relationship_strength:
        nextStrength,

      trust_score:
        nextTrust,

      interaction_count:
        nextInteractionCount,

      successful_introductions:
        nextSuccessfulIntroductions,

      failed_introductions:
        nextFailedIntroductions,

      last_interaction_at:
        now
    })
    .eq("id", existing.id)
    .select(
      `
        id,
        user_id,
        person_id,
        relationship_type,
        relationship_strength,
        trust_score,
        interaction_count,
        successful_introductions,
        failed_introductions,
        last_interaction_at
      `
    )
    .single();

  if (error) {
    console.error(
      "[relationship-memory] update failed:",
      error
    );
    return null;
  }

  return data as RelationshipMemory;
}