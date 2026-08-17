"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

/**
 * Drop-in page-view beacon for server components. Renders nothing.
 * <TrackBeacon meta={{ door: "ai-knows-me" }} />
 */
export function TrackBeacon({
  event = "view",
  meta
}: {
  event?: string;
  meta?: Record<string, unknown>;
}) {
  useEffect(() => {
    track(event, meta);
    // Fire once per mount; meta identity changes are deliberately
    // ignored so object literals in JSX don't refire the event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  return null;
}
