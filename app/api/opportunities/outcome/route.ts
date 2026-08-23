import { NextResponse } from "next/server";

import {
  createClient,
  createServiceClient
} from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "unauthorized"
        },
        {
          status: 401
        }
      );
    }

    const body = await request.json();

    const introductionRequestId = String(
      body?.introduction_request_id ?? ""
    ).trim();

    const opportunityId = String(
      body?.opportunity_id ?? ""
    ).trim();

    const conversationId = String(
      body?.conversation_id ?? ""
    ).trim();

    const outcomeType = String(
      body?.outcome_type ?? ""
    )
      .trim()
      .toLowerCase();

    const notes = String(
      body?.notes ?? ""
    ).trim();

    if (!introductionRequestId) {
      return NextResponse.json(
        {
          error:
            "missing_introduction_request_id"
        },
        {
          status: 400
        }
      );
    }

    if (!opportunityId) {
      return NextResponse.json(
        {
          error: "missing_opportunity_id"
        },
        {
          status: 400
        }
      );
    }

    if (!conversationId) {
      return NextResponse.json(
        {
          error: "missing_conversation_id"
        },
        {
          status: 400
        }
      );
    }

    const allowedOutcomeTypes = [
      "collaboration",
      "referral",
      "career",
      "mentorship",
      "opportunity",
      "follow_up",
      "no_outcome"
    ];

    if (!allowedOutcomeTypes.includes(outcomeType)) {
      return NextResponse.json(
        {
          error: "invalid_outcome_type",
          allowed_outcome_types:
            allowedOutcomeTypes
        },
        {
          status: 400
        }
      );
    }

    const service =
      createServiceClient();

    /*
     * Load the completed introduction.
     */
    const {
      data: introduction,
      error: introductionError
    } = await service
      .from("introduction_requests")
      .select(`
        id,
        opportunity_id,
        requester_id,
        connector_id,
        target_id,
        status
      `)
      .eq(
        "id",
        introductionRequestId
      )
      .maybeSingle();

    if (introductionError) {
      console.error(
        "[opportunities/outcome] introduction load failed",
        introductionError
      );

      return NextResponse.json(
        {
          error:
            "failed_to_load_introduction",
          detail:
            introductionError.message
        },
        {
          status: 500
        }
      );
    }

    if (!introduction) {
      return NextResponse.json(
        {
          error:
            "introduction_request_not_found"
        },
        {
          status: 404
        }
      );
    }

    /*
     * The introduction must actually be completed.
     */
    if (
      introduction.status !==
      "completed"
    ) {
      return NextResponse.json(
        {
          error:
            "introduction_not_completed",
          status:
            introduction.status
        },
        {
          status: 409
        }
      );
    }

    /*
     * Only requester, connector, or target
     * can record the outcome.
     */
    const isParticipant =
      introduction.requester_id ===
        user.id ||
      introduction.connector_id ===
        user.id ||
      introduction.target_id ===
        user.id;

    if (!isParticipant) {
      return NextResponse.json(
        {
          error:
            "not_authorized_to_record_outcome"
        },
        {
          status: 403
        }
      );
    }

    /*
     * Verify the conversation exists and belongs
     * to the requester ↔ target pair.
     *
     * conversationId is used for validation only
     * because the existing opportunity_outcomes
     * table does not have a conversation_id column.
     */
    const {
      data: conversation,
      error: conversationError
    } = await service
      .from("conversations")
      .select(`
        id,
        participant_a,
        participant_b,
        status
      `)
      .eq(
        "id",
        conversationId
      )
      .maybeSingle();

    if (conversationError) {
      console.error(
        "[opportunities/outcome] conversation load failed",
        conversationError
      );

      return NextResponse.json(
        {
          error:
            "failed_to_load_conversation",
          detail:
            conversationError.message
        },
        {
          status: 500
        }
      );
    }

    if (!conversation) {
      return NextResponse.json(
        {
          error:
            "conversation_not_found"
        },
        {
          status: 404
        }
      );
    }

    const requesterTargetConversation =
      (
        conversation.participant_a ===
          introduction.requester_id &&
        conversation.participant_b ===
          introduction.target_id
      ) ||
      (
        conversation.participant_a ===
          introduction.target_id &&
        conversation.participant_b ===
          introduction.requester_id
      );

    if (
      !requesterTargetConversation
    ) {
      return NextResponse.json(
        {
          error:
            "conversation_does_not_match_introduction"
        },
        {
          status: 409
        }
      );
    }

    /*
     * Prevent duplicate outcomes for the same
     * introduction.
     */
    const {
      data: existingOutcome,
      error: existingOutcomeError
    } = await service
      .from("opportunity_outcomes")
      .select("id")
      .eq(
        "introduction_id",
        introductionRequestId
      )
      .maybeSingle();

    if (existingOutcomeError) {
      console.error(
        "[opportunities/outcome] existing outcome lookup failed",
        existingOutcomeError
      );

      return NextResponse.json(
        {
          error:
            "failed_to_check_existing_outcome",
          detail:
            existingOutcomeError.message
        },
        {
          status: 500
        }
      );
    }

    if (existingOutcome) {
      return NextResponse.json(
        {
          error:
            "outcome_already_recorded",
          outcome_id:
            existingOutcome.id
        },
        {
          status: 409
        }
      );
    }

    /*
     * Use the opportunity ID stored on the
     * introduction when possible.
     */
    const storedOpportunityId =
      String(
        introduction.opportunity_id ??
          opportunityId
      ).trim();

    /*
     * Record the outcome using the EXISTING
     * opportunity_outcomes schema.
     */
    const {
      data: outcome,
      error: outcomeError
    } = await service
      .from("opportunity_outcomes")
      .insert({
        opportunity_id:
          storedOpportunityId,
        user_id:
          user.id,
        introduction_id:
          introductionRequestId,
        outcome_type:
          outcomeType,
        result:
          outcomeType,
        notes:
          notes || null,
        occurred_at:
          new Date().toISOString()
      })
      .select(`
        id,
        opportunity_id,
        user_id,
        introduction_id,
        outcome_type,
        result,
        notes,
        occurred_at,
        created_at
      `)
      .single();

    if (outcomeError || !outcome) {
      console.error(
        "[opportunities/outcome] insert failed",
        outcomeError
      );

      return NextResponse.json(
        {
          error:
            "failed_to_create_outcome",
          detail:
            outcomeError?.message ??
            "outcome_insert_failed"
        },
        {
          status: 500
        }
      );
    }

    /*
 * ---------------------------------------------------------
 * OUTCOME → TWIN LEARNING SIGNAL
 *
 * Keep the user's explicit Twin profile untouched.
 * Store outcome-derived learning separately so future
 * opportunity ranking can learn from real results.
 * ---------------------------------------------------------
 */

const signalWeightByOutcome: Record<
  string,
  number
> = {
  collaboration: 1,
  referral: 1,
  career: 1,
  mentorship: 1,
  opportunity: 1,
  follow_up: 0.5,
  no_outcome: -0.5
};

const signalWeight =
  signalWeightByOutcome[outcomeType] ?? 1;

const {
  data: learningSignal,
  error: learningError
} = await service
  .from("opportunity_learning_signals")
  .insert({
    user_id: user.id,
    opportunity_id: storedOpportunityId,
    introduction_id: introductionRequestId,
    outcome_type: outcomeType,
    signal_weight: signalWeight,
    notes: notes || null
  })
  .select(`
    id,
    user_id,
    opportunity_id,
    introduction_id,
    outcome_type,
    signal_weight,
    notes,
    created_at
  `)
  .single();

if (learningError || !learningSignal) {
  /*
   * The actual outcome was already stored successfully.
   * Do not report the whole operation as failed.
   *
   * The outcome can be reconciled later if necessary.
   */
  console.error(
    "[opportunities/outcome] learning signal insert failed",
    learningError
  );

  return NextResponse.json(
    {
      success: true,
      outcome,
      learning_signal: null,
      warning:
        "outcome_recorded_but_learning_signal_failed"
    },
    {
      status: 201
    }
  );
}

return NextResponse.json(
  {
    success: true,
    outcome,
    learning_signal: learningSignal
  },
  {
    status: 201
  }
);
  } catch (error) {
    console.error(
      "[opportunities/outcome] unexpected error",
      error
    );

    return NextResponse.json(
      {
        error:
          "internal_server_error"
      },
      {
        status: 500
      }
    );
  }
}