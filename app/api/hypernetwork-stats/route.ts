import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Live counts for the public Hypernetwork dashboard. Aggregates only —
 * no PII leaks. Anyone can hit this endpoint.
 */
export async function GET() {
  const service = createServiceClient();

  const headCount = (table: string, filter?: (q: any) => any) => {
    let q = service.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    return q;
  };

  const [
    { count: realUsers },
    { count: completedTwins },
    { count: realConversations },
    { count: closedConversations },
    { count: totalMessages },
    { count: pendingInvites },
    { count: claimedInvites },
    { count: acceptedAgreements },
    { count: editDeltas },
    { count: scoringCalibrations }
  ] = await Promise.all([
    headCount("profiles", (q: any) => q.eq("is_test_persona", false)),
    // Count twins among NON-test users only — test personas have built
    // twins too, so an unfiltered count made "twins" exceed "humans" on the
    // public dashboard. Inner-join profiles and filter to real users.
    service
      .from("twin_profiles")
      .select("user_id, profiles!inner(is_test_persona)", {
        count: "exact",
        head: true
      })
      .eq("profiles.is_test_persona", false)
      .not("goals", "is", null),
    headCount("conversations"),
    headCount("conversations", (q: any) => q.eq("status", "closed")),
    headCount("messages"),
    headCount("pending_invites"),
    headCount("pending_invites", (q: any) =>
      q.not("claimed_by_user_id", "is", null)
    ),
    headCount("agreement_responses", (q: any) => q.eq("response", "accepted")),
    headCount("edit_deltas"),
    headCount("scoring_calibrations")
  ]);

  // Average excitement across scored conversations.
  const { data: scored } = await service
    .from("conversations")
    .select("excitement_score")
    .not("excitement_score", "is", null);
  const scores = (scored ?? [])
    .map((c: any) => c.excitement_score as number)
    .filter((n): n is number => typeof n === "number");
  const avgExcitement = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  return NextResponse.json({
    real_users: realUsers ?? 0,
    completed_twins: completedTwins ?? 0,
    real_conversations: realConversations ?? 0,
    closed_conversations: closedConversations ?? 0,
    total_messages: totalMessages ?? 0,
    pending_invites: pendingInvites ?? 0,
    claimed_invites: claimedInvites ?? 0,
    accepted_agreements: acceptedAgreements ?? 0,
    edit_deltas: editDeltas ?? 0,
    scoring_calibrations: scoringCalibrations ?? 0,
    average_excitement: avgExcitement
  });
}
