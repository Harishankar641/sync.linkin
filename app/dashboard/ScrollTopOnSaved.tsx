"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Tiny client component the dashboard mounts. When the URL carries
 * `?saved=1` (set by the post-onboarding redirect), it:
 *   1. Scrolls the window to the top.
 *   2. Cleans the query param out of the URL so a manual reload doesn't
 *      keep re-scrolling.
 *
 * The previous behavior was that the browser's scroll restoration kept
 * the user anchored to wherever they last were in onboarding, dropping
 * them at the bottom of the dashboard on save.
 */
export function ScrollTopOnSaved() {
  const router = useRouter();
  const params = useSearchParams();
  const saved = params.get("saved");

  useEffect(() => {
    if (saved !== "1") return;
    // Two-frame nudge: some browsers restore scroll AFTER the initial
    // render. Scrolling on rAF + a small timeout covers both timings.
    try {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } catch {
      window.scrollTo(0, 0);
    }
    const t = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
    // Strip the flag so reload doesn't re-trigger.
    const next = new URLSearchParams(params.toString());
    next.delete("saved");
    const qs = next.toString();
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard");
    return () => clearTimeout(t);
  }, [saved, params, router]);

  return null;
}
