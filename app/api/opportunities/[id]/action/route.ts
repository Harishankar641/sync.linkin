export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type ActionBody = {
  action?: string;
  connectorId?: string;
  targetId?: string;
  introductionId?: string;
  outcomeType?: string;
  notes?: string;
  message?: string;
};

const ALLOWED_ACTIONS = new Set([
  "viewed",
  "saved",
  "dismissed",
  "approved",
  "request_introduction",
  "withdraw_request",
  "approve_introduction",
  "decline_introduction",
  "cancel_introduction",
  "record_outcome"
]);

const ALLOWED_OUTCOMES = new Set([
  "discovered",
  "saved",
  "introduction_requested",
  "introduced",
  "replied",
  "meeting",
  "opportunity_created",
  "won",
  "lost",
  "not_interested"
]);

export async function POST(
  request: Request,
  context: {
    params: {
      id: string;
    };
  }
) {
  try {
    const supabase = createClient();

    const {
      data: {
        user
      },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized"
        },
        {
          status: 401
        }
      );
    }

    const opportunityId =
      context.params.id;

    if (!opportunityId) {
      return NextResponse.json(
        {
          error:
            "Opportunity id is required"
        },
        {
          status: 400
        }
      );
    }

    const body =
      (await request.json()) as ActionBody;

    const action =
      body.action?.trim();

    if (
      !action ||
      !ALLOWED_ACTIONS.has(action)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid opportunity action"
        },
        {
          status: 400
        }
      );
    }

    const service =
      createServiceClient();

    /*
     * ---------------------------------------------------------
     * Verify opportunity
     * ---------------------------------------------------------
     */

    const {
      data: opportunity,
      error: opportunityError
    } = await service
      .from("opportunities")
      .select(
        `
          id,
          opportunity_type,
          title,
          status
        `
      )
      .eq(
        "id",
        opportunityId
      )
      .maybeSingle();

    if (
      opportunityError
    ) {
      console.error(
        "Opportunity lookup failed:",
        opportunityError
      );

      return NextResponse.json(
        {
          error:
            opportunityError.message
        },
        {
          status: 500
        }
      );
    }

    if (!opportunity) {
      return NextResponse.json(
        {
          error:
            "Opportunity not found"
        },
        {
          status: 404
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * Simple actions
     * ---------------------------------------------------------
     */

    if (
      action === "viewed" ||
      action === "saved" ||
      action === "dismissed" ||
      action === "approved" ||
      action ===
        "withdraw_request"
    ) {
      const {
        error
      } = await service
        .from(
          "opportunity_actions"
        )
        .insert({
          opportunity_id:
            opportunityId,

          user_id:
            user.id,

          action_type:
            action,

          notes:
            body.notes ??
            null
        });

      if (error) {
        console.error(
          "Opportunity action insert failed:",
          error
        );

        return NextResponse.json(
          {
            error:
              error.message
          },
          {
            status: 500
          }
        );
      }

      return NextResponse.json({
        ok: true,
        action
      });
    }

    /*
     * ---------------------------------------------------------
     * Request introduction
     * ---------------------------------------------------------
     */

    if (
      action ===
      "request_introduction"
    ) {
      const connectorId =
        body.connectorId?.trim();

      const targetId =
        body.targetId?.trim();

      if (
        !connectorId ||
        !targetId
      ) {
        return NextResponse.json(
          {
            error:
              "connectorId and targetId are required"
          },
          {
            status: 400
          }
        );
      }

      if (
        connectorId === user.id ||
        targetId === user.id ||
        connectorId === targetId
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid introduction participants"
          },
          {
            status: 400
          }
        );
      }

      /*
       * Make sure the requested connector
       * and target actually exist.
       */

      const {
        data: people,
        error: peopleError
      } = await service
        .from("profiles")
        .select("id")
        .in(
          "id",
          [
            connectorId,
            targetId
          ]
        );

      if (
        peopleError
      ) {
        return NextResponse.json(
          {
            error:
              peopleError.message
          },
          {
            status: 500
          }
        );
      }

      const peopleIds =
        new Set(
          (people ?? []).map(
            (person) =>
              person.id
          )
        );

      if (
        !peopleIds.has(
          connectorId
        ) ||
        !peopleIds.has(
          targetId
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Connector or target does not exist"
          },
          {
            status: 400
          }
        );
      }

      /*
       * Prevent duplicate active requests.
       */

      const {
        data: existingIntroduction,
        error:
          existingError
      } = await service
        .from(
          "opportunity_introductions"
        )
        .select(
          `
            id,
            status
          `
        )
        .eq(
          "opportunity_id",
          opportunityId
        )
        .eq(
          "requester_id",
          user.id
        )
        .eq(
          "connector_id",
          connectorId
        )
        .eq(
          "target_id",
          targetId
        )
        .in(
          "status",
          [
            "requested",
            "approved",
            "introduced"
          ]
        )
        .maybeSingle();

      if (
        existingError
      ) {
        console.error(
          "Existing introduction lookup failed:",
          existingError
        );

        return NextResponse.json(
          {
            error:
              existingError.message
          },
          {
            status: 500
          }
        );
      }

      if (
        existingIntroduction
      ) {
        return NextResponse.json(
          {
            ok: true,
            alreadyExists: true,
            introduction:
              existingIntroduction
          }
        );
      }

      /*
       * Create introduction request.
       */

      const {
        data: introduction,
        error:
          introductionError
      } = await service
        .from(
          "opportunity_introductions"
        )
        .insert({
          opportunity_id:
            opportunityId,

          requester_id:
            user.id,

          connector_id:
            connectorId,

          target_id:
            targetId,

          status:
            "requested",

          requester_message:
            body.message ??
            null
        })
        .select()
        .single();

      if (
        introductionError
      ) {
        console.error(
          "Introduction request failed:",
          introductionError
        );

        return NextResponse.json(
          {
            error:
              introductionError.message
          },
          {
            status: 500
          }
        );
      }

      /*
       * Also record the user action.
       */

      await service
        .from(
          "opportunity_actions"
        )
        .insert({
          opportunity_id:
            opportunityId,

          user_id:
            user.id,

          action_type:
            "request_introduction",

          notes:
            body.message ??
            null
        });

      /*
       * Create the first outcome event.
       */

      await service
        .from(
          "opportunity_outcomes"
        )
        .insert({
          opportunity_id:
            opportunityId,

          user_id:
            user.id,

          introduction_id:
            introduction.id,

          outcome_type:
            "introduction_requested",

          notes:
            body.message ??
            null
        });

      return NextResponse.json({
        ok: true,

        action,

        introduction
      });
    }

    /*
     * ---------------------------------------------------------
     * Approve introduction
     * ---------------------------------------------------------
     */

    if (
      action ===
      "approve_introduction"
    ) {
      const introductionId =
        body.introductionId?.trim();

      if (!introductionId) {
        return NextResponse.json(
          {
            error:
              "introductionId is required"
          },
          {
            status: 400
          }
        );
      }

      const {
        data: introduction,
        error:
          introductionError
      } = await service
        .from(
          "opportunity_introductions"
        )
        .select(
          `
            id,
            opportunity_id,
            requester_id,
            connector_id,
            target_id,
            status
          `
        )
        .eq(
          "id",
          introductionId
        )
        .eq(
          "opportunity_id",
          opportunityId
        )
        .maybeSingle();

      if (
        introductionError
      ) {
        return NextResponse.json(
          {
            error:
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
              "Introduction not found"
          },
          {
            status: 404
          }
        );
      }

      /*
       * Only the connector can approve.
       */

      if (
        introduction.connector_id !==
        user.id
      ) {
        return NextResponse.json(
          {
            error:
              "Only the connector can approve this introduction"
          },
          {
            status: 403
          }
        );
      }

      if (
        introduction.status !==
        "requested"
      ) {
        return NextResponse.json(
          {
            error:
              `Introduction is already ${introduction.status}`
          },
          {
            status: 409
          }
        );
      }

      const now =
        new Date().toISOString();

      const {
        data: updated,
        error: updateError
      } = await service
        .from(
          "opportunity_introductions"
        )
        .update({
          status:
            "introduced",

          connector_message:
            body.message ??
            null,

          responded_at:
            now,

          introduced_at:
            now
        })
        .eq(
          "id",
          introductionId
        )
        .select()
        .single();

      if (
        updateError
      ) {
        return NextResponse.json(
          {
            error:
              updateError.message
          },
          {
            status: 500
          }
        );
      }

      /*
       * Record outcome for requester.
       */

      await service
        .from(
          "opportunity_outcomes"
        )
        .insert({
          opportunity_id:
            opportunityId,

          user_id:
            introduction.requester_id,

          introduction_id:
            introductionId,

          outcome_type:
            "introduced",

          notes:
            body.message ??
            null
        });

      /*
       * Record relationship success
       * for the connector.
       */

      await service.rpc(
        "record_relationship_introduction",
        {
          p_user_id:
            introduction.requester_id,

          p_person_id:
            introduction.connector_id,

          p_successful:
            true
        }
      );

      return NextResponse.json({
        ok: true,

        action,

        introduction:
          updated
      });
    }

    /*
     * ---------------------------------------------------------
     * Decline introduction
     * ---------------------------------------------------------
     */

    if (
      action ===
      "decline_introduction"
    ) {
      const introductionId =
        body.introductionId?.trim();

      if (!introductionId) {
        return NextResponse.json(
          {
            error:
              "introductionId is required"
          },
          {
            status: 400
          }
        );
      }

      const {
        data: introduction,
        error:
          introductionError
      } = await service
        .from(
          "opportunity_introductions"
        )
        .select(
          `
            id,
            opportunity_id,
            requester_id,
            connector_id,
            target_id,
            status
          `
        )
        .eq(
          "id",
          introductionId
        )
        .eq(
          "opportunity_id",
          opportunityId
        )
        .maybeSingle();

      if (
        introductionError
      ) {
        return NextResponse.json(
          {
            error:
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
              "Introduction not found"
          },
          {
            status: 404
          }
        );
      }

      /*
       * Only connector can decline.
       */

      if (
        introduction.connector_id !==
        user.id
      ) {
        return NextResponse.json(
          {
            error:
              "Only the connector can decline this introduction"
          },
          {
            status: 403
          }
        );
      }

      const {
        data: updated,
        error: updateError
      } = await service
        .from(
          "opportunity_introductions"
        )
        .update({
          status:
            "declined",

          connector_message:
            body.message ??
            null,

          responded_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          introductionId
        )
        .select()
        .single();

      if (
        updateError
      ) {
        return NextResponse.json(
          {
            error:
              updateError.message
          },
          {
            status: 500
          }
        );
      }

      await service
        .from(
          "opportunity_outcomes"
        )
        .insert({
          opportunity_id:
            opportunityId,

          user_id:
            introduction.requester_id,

          introduction_id:
            introductionId,

          outcome_type:
            "not_interested",

          notes:
            body.message ??
            "Introduction declined."
        });

      await service.rpc(
        "record_relationship_introduction",
        {
          p_user_id:
            introduction.requester_id,

          p_person_id:
            introduction.connector_id,

          p_successful:
            false
        }
      );

      return NextResponse.json({
        ok: true,

        action,

        introduction:
          updated
      });
    }

    /*
     * ---------------------------------------------------------
     * Cancel introduction
     * ---------------------------------------------------------
     */

    if (
      action ===
      "cancel_introduction"
    ) {
      const introductionId =
        body.introductionId?.trim();

      if (!introductionId) {
        return NextResponse.json(
          {
            error:
              "introductionId is required"
          },
          {
            status: 400
          }
        );
      }

      const {
        data: introduction,
        error:
          introductionError
      } = await service
        .from(
          "opportunity_introductions"
        )
        .select(
          `
            id,
            requester_id,
            status
          `
        )
        .eq(
          "id",
          introductionId
        )
        .eq(
          "opportunity_id",
          opportunityId
        )
        .maybeSingle();

      if (
        introductionError
      ) {
        return NextResponse.json(
          {
            error:
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
              "Introduction not found"
          },
          {
            status: 404
          }
        );
      }

      if (
        introduction.requester_id !==
        user.id
      ) {
        return NextResponse.json(
          {
            error:
              "Only the requester can cancel this introduction"
          },
          {
            status: 403
          }
        );
      }

      const {
        data: updated,
        error: updateError
      } = await service
        .from(
          "opportunity_introductions"
        )
        .update({
          status:
            "cancelled",

          responded_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          introductionId
        )
        .select()
        .single();

      if (
        updateError
      ) {
        return NextResponse.json(
          {
            error:
              updateError.message
          },
          {
            status: 500
          }
        );
      }

      return NextResponse.json({
        ok: true,

        action,

        introduction:
          updated
      });
    }

    /*
     * ---------------------------------------------------------
     * Record opportunity outcome
     * ---------------------------------------------------------
     */

    if (
      action ===
      "record_outcome"
    ) {
      const outcomeType =
        body.outcomeType?.trim();

      if (
        !outcomeType ||
        !ALLOWED_OUTCOMES.has(
          outcomeType
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Valid outcomeType is required"
          },
          {
            status: 400
          }
        );
      }

      const {
        data: outcome,
        error: outcomeError
      } = await service
        .from(
          "opportunity_outcomes"
        )
        .insert({
          opportunity_id:
            opportunityId,

          user_id:
            user.id,

          introduction_id:
            body.introductionId ??
            null,

          outcome_type:
            outcomeType,

          result:
            body.message ??
            null,

          notes:
            body.notes ??
            null
        })
        .select()
        .single();

      if (
        outcomeError
      ) {
        return NextResponse.json(
          {
            error:
              outcomeError.message
          },
          {
            status: 500
          }
        );
      }

      /*
       * -------------------------------------------------------
       * Convert outcome into a Twin learning event.
       * -------------------------------------------------------
       */

      const positiveOutcomes =
        new Set([
          "replied",
          "meeting",
          "opportunity_created",
          "won"
        ]);

      const negativeOutcomes =
        new Set([
          "lost",
          "not_interested"
        ]);

      let weight = 1;

      if (
        positiveOutcomes.has(
          outcomeType
        )
      ) {
        weight = 2;
      }

      if (
        negativeOutcomes.has(
          outcomeType
        )
      ) {
        weight = -1;
      }

      await service
        .from(
          "twin_learning_events"
        )
        .insert({
          user_id:
            user.id,

          opportunity_id:
            opportunityId,

          outcome_id:
            outcome.id,

          event_type:
            "opportunity_outcome",

          signal:
            "opportunity_outcome",

          signal_value:
            outcomeType,

          weight,

          metadata: {
            opportunityType:
              opportunity.opportunity_type,

            opportunityTitle:
              opportunity.title,

            notes:
              body.notes ??
              null
          }
        });

      /*
       * Record the action too.
       */

      await service
        .from(
          "opportunity_actions"
        )
        .insert({
          opportunity_id:
            opportunityId,

          user_id:
            user.id,

          action_type:
            "approved",

          notes:
            `Outcome recorded: ${outcomeType}`
        });

      return NextResponse.json({
        ok: true,

        action,

        outcome
      });
    }

    return NextResponse.json(
      {
        error:
          "Unsupported action"
      },
      {
        status: 400
      }
    );
  } catch (error) {
    console.error(
      "Opportunity action API failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Opportunity action failed"
      },
      {
        status: 500
      }
    );
  }
}