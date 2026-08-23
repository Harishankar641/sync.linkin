import { NextResponse } from "next/server";

import {
  createClient,
  createServiceClient
} from "@/lib/supabase/server";

import { notifyNewConnection } from "@/lib/notify";
import { assignConversationSlug } from "@/lib/conversationSlugServer";

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

    const action = String(
      body?.action ?? ""
    )
      .trim()
      .toLowerCase();

    if (!introductionRequestId) {
      return NextResponse.json(
        {
          error: "missing_introduction_request_id"
        },
        {
          status: 400
        }
      );
    }

    if (
      action !== "approve" &&
      action !== "decline"
    ) {
      return NextResponse.json(
        {
          error: "invalid_action"
        },
        {
          status: 400
        }
      );
    }

    const service = createServiceClient();

    /*
     * Load the introduction request.
     */
    const {
      data: introduction,
      error: loadError
    } = await service
      .from("introduction_requests")
      .select(`
        id,
        opportunity_id,
        requester_id,
        connector_id,
        target_id,
        status,
        message
      `)
      .eq("id", introductionRequestId)
      .maybeSingle();

    if (loadError) {
      console.error(
        "[introductions/respond] load failed",
        loadError
      );

      return NextResponse.json(
        {
          error: "failed_to_load_request",
          detail: loadError.message
        },
        {
          status: 500
        }
      );
    }

    if (!introduction) {
      return NextResponse.json(
        {
          error: "introduction_request_not_found"
        },
        {
          status: 404
        }
      );
    }

    /*
     * Only the connector can approve or decline.
     *
     * requester = Harishankar
     * connector = Sharan
     * target    = Johnson
     */
    if (introduction.connector_id !== user.id) {
      return NextResponse.json(
        {
          error: "not_authorized_to_respond"
        },
        {
          status: 403
        }
      );
    }

    /*
     * Only pending requests can be responded to.
     */
    if (introduction.status !== "pending") {
      return NextResponse.json(
        {
          error: "request_already_responded",
          status: introduction.status
        },
        {
          status: 409
        }
      );
    }

    /*
     * DECLINE
     *
     * If the connector declines, simply mark the request
     * as declined. No conversation is created.
     */
    if (action === "decline") {
      const {
        data: updated,
        error: updateError
      } = await service
        .from("introduction_requests")
        .update({
          status: "declined",
          responded_at: new Date().toISOString()
        })
        .eq("id", introductionRequestId)
        .eq("connector_id", user.id)
        .eq("status", "pending")
        .select(`
          id,
          opportunity_id,
          requester_id,
          connector_id,
          target_id,
          status,
          message,
          responded_at
        `)
        .single();

      if (updateError || !updated) {
        console.error(
          "[introductions/respond] decline update failed",
          updateError
        );

        return NextResponse.json(
          {
            error: "failed_to_update_request",
            detail:
              updateError?.message ??
              "update_failed"
          },
          {
            status: 500
          }
        );
      }

      return NextResponse.json(
        {
          success: true,
          status: "declined",
          request: updated
        },
        {
          status: 200
        }
      );
    }

    /*
     * APPROVE
     *
     * First mark the request as approved.
     */
    const {
      data: approvedRequest,
      error: approveError
    } = await service
      .from("introduction_requests")
      .update({
        status: "approved",
        responded_at: new Date().toISOString()
      })
      .eq("id", introductionRequestId)
      .eq("connector_id", user.id)
      .eq("status", "pending")
      .select(`
        id,
        opportunity_id,
        requester_id,
        connector_id,
        target_id,
        status,
        message,
        responded_at
      `)
      .single();

    if (approveError || !approvedRequest) {
      console.error(
        "[introductions/respond] approval update failed",
        approveError
      );

      return NextResponse.json(
        {
          error: "failed_to_approve_request",
          detail:
            approveError?.message ??
            "approval_failed"
        },
        {
          status: 500
        }
      );
    }

    const requesterId = introduction.requester_id;
    const targetId = introduction.target_id;

    /*
     * Safety check.
     */
    if (
      !requesterId ||
      !targetId ||
      requesterId === targetId
    ) {
      console.error(
        "[introductions/respond] invalid requester/target",
        {
          requesterId,
          targetId
        }
      );

      return NextResponse.json(
        {
          error: "invalid_introduction_participants"
        },
        {
          status: 500
        }
      );
    }

    /*
     * Check whether requester ↔ target already have
     * a conversation.
     *
     * Reuse it instead of creating a duplicate.
     */
    const {
      data: existingConversation,
      error: existingConversationError
    } = await service
      .from("conversations")
      .select("id")
      .or(
        `and(participant_a.eq.${requesterId},participant_b.eq.${targetId}),and(participant_a.eq.${targetId},participant_b.eq.${requesterId})`
      )
      .maybeSingle();

    if (existingConversationError) {
      console.error(
        "[introductions/respond] existing conversation lookup failed",
        existingConversationError
      );

      return NextResponse.json(
        {
          error:
            "failed_to_check_existing_conversation",
          detail:
            existingConversationError.message
        },
        {
          status: 500
        }
      );
    }

    let conversationId: string;

    if (existingConversation?.id) {
      /*
       * Conversation already exists.
       */
      conversationId = existingConversation.id;
    } else {
      /*
       * Create the actual requester ↔ target conversation.
       */
      const {
        data: conversation,
        error: conversationError
      } = await service
        .from("conversations")
        .insert({
          participant_a: requesterId,
          participant_b: targetId
        })
        .select("id")
        .single();

      if (conversationError || !conversation) {
        console.error(
          "[introductions/respond] conversation creation failed",
          conversationError
        );

        /*
         * The request is currently approved but the actual
         * introduction could not be created.
         *
         * Leave it as approved so it can be retried safely.
         */
        return NextResponse.json(
          {
            error:
              "failed_to_create_introduction_conversation",
            detail:
              conversationError?.message ??
              "conversation_creation_failed",
            status: "approved"
          },
          {
            status: 500
          }
        );
      }

      conversationId = conversation.id;

      /*
       * Assign the short conversation slug.
       */
      assignConversationSlug(conversationId).catch(
        (error) => {
          console.warn(
            "[introductions/respond] conversation slug assignment failed",
            error
          );
        }
      );
    }

    /*
     * Notify the actual two people being introduced.
     *
     * Connector is NOT included as a conversation participant.
     */
    notifyNewConnection({
      conversationId,
      participantA: requesterId,
      participantB: targetId
    }).catch((error) => {
      console.warn(
        "[introductions/respond] notification failed",
        error
      );
    });

    /*
     * The introduction has now actually happened:
     *
     * requester ↔ target conversation exists.
     *
     * Mark the introduction request as completed.
     */
    const {
      data: completedRequest,
      error: completedError
    } = await service
      .from("introduction_requests")
      .update({
        status: "completed"
      })
      .eq("id", introductionRequestId)
      .eq("connector_id", user.id)
      .eq("status", "approved")
      .select(`
        id,
        opportunity_id,
        requester_id,
        connector_id,
        target_id,
        status,
        message,
        created_at,
        responded_at
      `)
      .single();

    if (completedError || !completedRequest) {
      console.error(
        "[introductions/respond] completion update failed",
        completedError
      );

      /*
       * The conversation was created successfully, so return
       * the conversation ID even if marking the request completed
       * failed. The request remains approved and can be reconciled.
       */
      return NextResponse.json(
        {
          success: true,
          status: "approved",
          conversation_id: conversationId,
          warning:
            "introduction_created_but_completion_update_failed",
          detail:
            completedError?.message ??
            "completion_update_failed"
        },
        {
          status: 200
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: "completed",
        conversation_id: conversationId,
        request: completedRequest
      },
      {
        status: 200
      }
    );
  } catch (error) {
    console.error(
      "[introductions/respond] unexpected error",
      error
    );

    return NextResponse.json(
      {
        error: "internal_server_error"
      },
      {
        status: 500
      }
    );
  }
}