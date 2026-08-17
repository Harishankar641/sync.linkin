"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type AgreementRealtimeRow = {
  conversation_id: string;
  user_id: string;
  response: "accepted" | "rejected";
  reason: string | null;
};

/**
 * useAgreementRealtime — live-subscribes to `agreement_responses` for one
 * conversation so the counterpart's accept/reject reaches this browser the
 * instant it happens, instead of waiting for a refresh or the next poll.
 *
 * This is what makes the "Sync Moment" (SyncMoment.tsx) actually feel live:
 * without it, two people staring at the same conversation would each only
 * find out the deal sealed on their own next page load.
 *
 * Deliberately narrow: it only watches agreement_responses, not the full
 * message stream (see README's "Next things to build" — full chat realtime
 * is a separate, larger change). Fires `onCounterpartChange`:
 *   - with the row when the COUNTERPART inserts/updates a response
 *   - with `null` when their response is cleared (a rejection resets both
 *     sides server-side — see /api/respond-agreement)
 *
 * Fails silent if the realtime channel can't connect (e.g. the 0006
 * migration hasn't been run yet on this Supabase project) — the existing
 * refresh-based flow keeps working either way, this is a pure enhancement.
 */
export function useAgreementRealtime(
  conversationId: string,
  selfUserId: string,
  onCounterpartChange: (row: AgreementRealtimeRow | null) => void
) {
  // Keep the latest callback in a ref so the subscription effect below
  // doesn't need it as a dependency — avoids tearing down/rebuilding the
  // channel every render just because the caller passed a fresh closure.
  const callbackRef = useRef(onCounterpartChange);
  useEffect(() => {
    callbackRef.current = onCounterpartChange;
  }, [onCounterpartChange]);

  useEffect(() => {
    if (!conversationId || !selfUserId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`agreement-responses:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agreement_responses",
          filter: `conversation_id=eq.${conversationId}`
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          if (payload.eventType === "DELETE") {
            // A rejection clears all responses for this conversation
            // server-side (see /api/respond-agreement) — reset locally.
            callbackRef.current(null);
            return;
          }
          const row = payload.new as AgreementRealtimeRow;
          if (!row?.user_id || row.user_id === selfUserId) return; // only the counterpart's changes matter here
          callbackRef.current(row);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, selfUserId]);
}
