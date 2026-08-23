export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

import {
  findOpportunityPaths,
  type GraphConnection,
  type GraphPerson,
  type OpportunityTarget,
  type RelationshipMemory
} from "@/lib/opportunity-graph";

type OpportunityRow = {
  id: string;
  opportunity_type: string;
  title: string;
  company: string | null;
  description: string | null;
  skills: string[];
  source: string | null;
  source_url: string | null;
  location: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type TwinRow = {
  user_id: string;
  goals: string | null;
  deal_preferences: string | null;
  communication_style: string | null;
  ai_export_blob: string | null;
};

type ConversationRow = {
  id: string;
  participant_a: string;
  participant_b: string;
  excitement_score: number | null;
  sync_score_override: number | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

/*
 * Convert the conversation scoring fields into the
 * relationship strength expected by the graph engine.
 *
 * excitement_score:
 *   55%
 *
 * sync_score_override:
 *   45%
 *
 * Minimum relationship signal:
 *   20%
 *
 * Maximum:
 *   100%
 */
function calculateRelationshipStrength(
  conversation: ConversationRow
): number {
  const excitement =
    typeof conversation.excitement_score ===
    "number"
      ? conversation.excitement_score
      : 0;

  const sync =
    typeof conversation.sync_score_override ===
    "number"
      ? conversation.sync_score_override
      : 50;

  return Math.min(
    100,
    Math.max(
      20,
      Math.round(
        excitement * 0.55 +
          sync * 0.45
      )
    )
  );
}

/*
 * Build graph connections from real conversations.
 *
 * IMPORTANT:
 *
 * We intentionally load all conversations here rather
 * than only conversations involving the current user.
 *
 * That allows the graph engine to discover:
 *
 *   You → Person A → Person B → Target
 *
 * instead of only:
 *
 *   You → Person A
 *
 * This is required for genuine multi-hop warm paths.
 */
function buildGraphConnections(
  conversations: ConversationRow[]
): GraphConnection[] {
  return conversations
    .filter(
      (conversation) =>
        Boolean(
          conversation.participant_a &&
            conversation.participant_b
        ) &&
        conversation.participant_a !==
          conversation.participant_b
    )
    .map((conversation) => ({
      from:
        conversation.participant_a,

      to:
        conversation.participant_b,

      strength:
        calculateRelationshipStrength(
          conversation
        ),

      reason:
        conversation.status ??
        "conversation",

      source:
        "conversation"
    }));
}

/*
 * Convert profiles + Twin data into the richer
 * person representation expected by the graph engine.
 *
 * The current profiles query only exposes:
 *   id
 *   display_name
 *   email
 *
 * Therefore we do not invent company, role,
 * wants, or offers values.
 */
function buildGraphPeople({
  profiles,
  twins
}: {
  profiles: ProfileRow[];
  twins: TwinRow[];
}): GraphPerson[] {
  const twinByUser =
    new Map<string, TwinRow>();

  for (const twin of twins) {
    twinByUser.set(
      twin.user_id,
      twin
    );
  }

  return profiles.map(
    (profile) => {
      const twin =
        twinByUser.get(
          profile.id
        );

      return {
        id: profile.id,

        name:
          profile.display_name ??
          profile.email ??
          "Professional",

        company: null,

        role: null,

        skills: [],

        goals:
          twin?.goals ?? null,

        wants: null,

        offers: null,

        isDirectConversationPartner:
          false
      };
    }
  );
}

/*
 * Convert database opportunity rows into the
 * graph engine's OpportunityTarget shape.
 */
function buildGraphOpportunities(
  opportunities: OpportunityRow[]
): OpportunityTarget[] {
  return opportunities.map(
    (opportunity) => ({
      id: opportunity.id,

      title:
        opportunity.title,

      company:
        opportunity.company,

      description:
        opportunity.description,

      skills:
        Array.isArray(
          opportunity.skills
        )
          ? opportunity.skills
          : [],

      opportunity_type:
        opportunity.opportunity_type,

      source:
        opportunity.source,

      source_url:
        opportunity.source_url,

      location:
        opportunity.location
    })
  );
}

export async function GET() {
  try {
    /*
     * ---------------------------------------------------------
     * 0. Authenticate current user
     * ---------------------------------------------------------
     */

    const supabase =
      createClient();

    const {
      data: {
        user
      },
      error: userError
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized"
        },
        {
          status: 401
        }
      );
    }

    const service =
      createServiceClient();

    /*
     * ---------------------------------------------------------
     * 1. Load current user's Twin
     * ---------------------------------------------------------
     */

    const {
      data: twinData,
      error: twinError
    } = await service
      .from("twin_profiles")
      .select(
        `
          user_id,
          goals,
          deal_preferences,
          communication_style,
          ai_export_blob
        `
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

    if (twinError) {
      console.error(
        "Opportunity Twin query failed:",
        twinError
      );
    }

    const twin =
      (twinData ??
        {}) as Partial<TwinRow>;

    /*
     * Build the current user's opportunity context.
     *
     * This is deliberately richer than only goals.
     */
    const userGoals = [
      twin.goals ?? "",

      twin.deal_preferences ??
        "",

      twin.communication_style ??
        "",

      twin.ai_export_blob ??
        ""
    ]
      .filter(Boolean)
      .join(" ");

    /*
     * ---------------------------------------------------------
     * 2. Load active opportunities
     * ---------------------------------------------------------
     */

    const {
      data: opportunitiesData,
      error: opportunitiesError
    } = await service
      .from("opportunities")
      .select(
        `
          id,
          opportunity_type,
          title,
          company,
          description,
          skills,
          source,
          source_url,
          location,
          status,
          created_at,
          updated_at
        `
      )
      .eq(
        "status",
        "active"
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );

    if (
      opportunitiesError
    ) {
      console.error(
        "Opportunity query failed:",
        opportunitiesError
      );

      return NextResponse.json(
        {
          error:
            opportunitiesError.message
        },
        {
          status: 500
        }
      );
    }

    const opportunities =
      (opportunitiesData ??
        []) as OpportunityRow[];

    /*
     * ---------------------------------------------------------
     * 3. Load real users
     * ---------------------------------------------------------
     */

    const {
      data: profilesData,
      error: profilesError
    } = await service
      .from("profiles")
      .select(
        `
          id,
          display_name,
          email
        `
      );

    if (profilesError) {
      console.error(
        "Profiles query failed:",
        profilesError
      );
    }

    const profiles =
      (profilesData ??
        []) as ProfileRow[];

    /*
     * ---------------------------------------------------------
     * 4. Load Twin data for all users
     * ---------------------------------------------------------
     */

    const {
      data: twinsData,
      error: twinsError
    } = await service
      .from("twin_profiles")
      .select(
        `
          user_id,
          goals,
          deal_preferences,
          communication_style,
          ai_export_blob
        `
      );

    if (twinsError) {
      console.error(
        "Twin profiles query failed:",
        twinsError
      );
    }

    const twins =
      (twinsData ??
        []) as TwinRow[];

    /*
     * ---------------------------------------------------------
     * 5. Load relationship conversations
     * ---------------------------------------------------------
     *
     * IMPORTANT:
     *
     * The previous route only loaded conversations
     * involving the current user:
     *
     *   participant_a = user.id
     *   OR
     *   participant_b = user.id
     *
     * That prevented reliable multi-hop discovery.
     *
     * The graph engine needs the complete relationship
     * graph so it can discover:
     *
     *   You → A → B
     *
     * and:
     *
     *   You → A → B → C
     *
     * where the final person may not directly
     * communicate with the current user.
     */

    const {
      data: conversationsData,
      error: conversationsError
    } = await service
      .from("conversations")
      .select(
        `
          id,
          participant_a,
          participant_b,
          excitement_score,
          sync_score_override,
          status,
          created_at,
          updated_at
        `
      );

    if (
      conversationsError
    ) {
      console.error(
        "Conversation query failed:",
        conversationsError
      );
    }

    const conversations =
      (conversationsData ??
        []) as ConversationRow[];

    /*
     * ---------------------------------------------------------
     * 6. Convert database data to graph-engine data
     * ---------------------------------------------------------
     */

    const graphPeople =
      buildGraphPeople({
        profiles,
        twins
      });
      const {
  data: relationshipMemoryRows,
  error: relationshipMemoryError
} = await service
  .from("relationship_memory")
  .select(`
    user_id,
    person_id,
    relationship_type,
    relationship_strength,
    trust_score,
    interaction_count,
    last_interaction_at,
    shared_context,
    shared_topics,
    successful_introductions,
    failed_introductions,
    notes,
    created_at,
    updated_at
  `);

if (relationshipMemoryError) {
  console.warn(
    "[opportunities] relationship memory load failed:",
    relationshipMemoryError
  );
}

const relationshipMemory =
  (relationshipMemoryRows ?? []) as RelationshipMemory[];

    const graphConnections =
      buildGraphConnections(
        conversations
      );

    const graphOpportunities =
      buildGraphOpportunities(
        opportunities
      );

    /*
     * ---------------------------------------------------------
     * 7. Run the single Opportunity Graph engine
     * ---------------------------------------------------------
     *
     * This is now the SINGLE source of truth for:
     *
     *   - Twin → opportunity fit
     *   - person → opportunity fit
     *   - relationship strength
     *   - warm paths
     *   - path distance
     *   - bridge
     *   - why[]
     *   - opportunity score
     *
     * We intentionally do not duplicate this scoring
     * inside the API route anymore.
     */

    const graphResults =
  findOpportunityPaths({
    userId:
      user.id,

    userGoals,

    opportunities:
      graphOpportunities,

    people:
      graphPeople,

    connections:
      graphConnections,

    relationshipMemory
  });

    /*
     * ---------------------------------------------------------
     * 8. Return graph results
     * ---------------------------------------------------------
     *
     * Preserve the existing API response structure:
     *
     * {
     *   opportunities: [...],
     *   meta: {...}
     * }
     *
     * The graph engine now additionally provides:
     *
     *   why
     *   personScore
     *   relationshipStrength
     *   userFit
     *   bridge
     *   distance
     *   warm-path information
     */

    const results =
      graphResults;

    /*
     * ---------------------------------------------------------
     * 9. Metadata
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      opportunities:
        results,

      meta: {
        userId:
          user.id,

        opportunityCount:
          results.length,

        peopleCount:
          profiles.length,

        relationshipCount:
          conversations.length,

        warmPathCount:
          results.filter(
            (item) =>
              item.distance >= 1
          ).length
      }
    });
  } catch (error) {
    console.error(
      "Opportunity API failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Opportunity service failed"
      },
      {
        status: 500
      }
    );
  }
}