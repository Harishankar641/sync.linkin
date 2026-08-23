import { NextResponse } from "next/server";

import {
  createClient,
  createServiceClient
} from "@/lib/supabase/server";

export async function POST(
  request: Request
) {
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
        { status: 401 }
      );
    }

    const body = await request.json();

    const opportunityId =
  String(body.opportunity_id ?? "").trim();

    const connectorId =
      String(body.connector_id ?? "").trim();

    const targetId =
      String(body.target_id ?? "").trim();

    const message =
      body.message
        ? String(body.message).trim()
        : null;

    if (!connectorId || !targetId) {
      return NextResponse.json(
        {
          error:
            "connector_id and target_id are required"
        },
        { status: 400 }
      );
    }

    /*
     * The requester is always the authenticated user.
     * Never trust requester_id from the browser.
     */
    const requesterId = user.id;

    /*
     * Prevent invalid self requests.
     */
    if (
      requesterId === connectorId ||
      requesterId === targetId ||
      connectorId === targetId
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid introduction participants"
        },
        { status: 400 }
      );
    }

    const service =
      createServiceClient();

      /*
 * Verify that the opportunity exists.
 *
 * introduction_requests.opportunity_id references
 * opportunities.id, so only the real UUID is accepted.
 */
const {
  data: opportunity,
  error: opportunityError
} = await service
  .from("opportunities")
  .select("id")
  .eq("id", opportunityId)
  .maybeSingle();

if (opportunityError) {
  console.error(
    "[introductions/request] opportunity lookup failed",
    opportunityError
  );

  return NextResponse.json(
    {
      error:
        "failed_to_validate_opportunity",
      detail:
        opportunityError.message
    },
    { status: 500 }
  );
}

if (!opportunity) {
  return NextResponse.json(
    {
      error:
        "opportunity_not_found"
    },
    { status: 400 }
  );
}

    /*
     * Prevent duplicate pending requests.
     */
    const { data: existing } =
      await service
        .from("introduction_requests")
        .select("id,status")
        .eq(
          "requester_id",
          requesterId
        )
        .eq(
          "connector_id",
          connectorId
        )
        .eq(
          "target_id",
          targetId
        )
        .eq(
          "status",
          "pending"
        )
        .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        already_exists: true,
        request: existing
      });
    }

    /*
     * Create the introduction request.
     *
     * IMPORTANT:
     * This does NOT create a conversation.
     *
     * The connector must approve first.
     */
    const { data: created, error } =
      await service
        .from("introduction_requests")
        .insert({
          opportunity_id:
            opportunityId,

          requester_id:
            requesterId,

          connector_id:
            connectorId,

          target_id:
            targetId,

          status: "pending",

          message
        })
        .select(
          `
          id,
          opportunity_id,
          requester_id,
          connector_id,
          target_id,
          status,
          message,
          created_at,
          responded_at
          `
        )
        .single();

    if (error || !created) {
      console.error(
        "[introductions/request] insert failed",
        error
      );

      return NextResponse.json(
        {
          error:
            "failed_to_create_request",
          detail:
            error?.message ??
            "insert_failed"
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      already_exists: false,
      request: created
    });
  } catch (error) {
    console.error(
      "[introductions/request] unexpected error",
      error
    );

    return NextResponse.json(
      {
        error:
          "unexpected_server_error"
      },
      { status: 500 }
    );
  }
}