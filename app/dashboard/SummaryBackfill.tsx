"use client";

import { useEffect, useRef } from "react";

/**
 * Fire-and-forget client-side backfill: for any conversation lacking a
 * summary or excitement_score, POST to /api/summarize-conversation and then
 * reload the dashboard once everything has settled so the new scores render.
 *
 * Runs ONCE per dashboard mount. If a conv just got summarized, the page
 * reloads to show it. If nothing needed summarizing, it does nothing visible.
 */
export function SummaryBackfill({
  conversationIds
}: {
  conversationIds: string[];
}) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!conversationIds.length) return;

    (async () => {
      const results = await Promise.allSettled(
        conversationIds.map((id) =>
          fetch("/api/summarize-conversation", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ conversation_id: id })
          }).then((r) => r.ok)
        )
      );
      // If ANY succeeded, the DB now has fresh summaries — reload to show them.
      const anySuccess = results.some(
        (r) => r.status === "fulfilled" && r.value
      );
      if (anySuccess) {
        // Small delay so the API writes are committed before the refetch.
        setTimeout(() => window.location.reload(), 800);
      }
    })();
  }, [conversationIds]);

  return null;
}
