"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Generic "force the page to scroll to top + strip the flag" component.
 * Mount it inside any page that gets navigated to with a transient
 * `?<flag>=1` marker from a server-action redirect — without it the
 * browser's scroll restoration drops the user wherever they last were
 * on the previous page (typically the submit-button at the bottom of
 * a form, hence "took me straight to bottom").
 *
 * Replaces the older dashboard-only ScrollTopOnSaved. Pass the flag
 * names you want to react to via `flags` (defaults to ["saved",
 * "created"]).
 */
export function ScrollTopOnFlag({
  flags = ["saved", "created"]
}: {
  flags?: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const present = flags.find((f) => params.get(f) === "1");

  useEffect(() => {
    if (!present) return;
    // Two-frame nudge: some browsers restore scroll AFTER initial render.
    try {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } catch {
      window.scrollTo(0, 0);
    }
    const t = setTimeout(() => window.scrollTo(0, 0), 50);
    // Strip the flag so reload doesn't re-trigger.
    const next = new URLSearchParams(params.toString());
    next.delete(present);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    return () => clearTimeout(t);
  }, [present, params, router, pathname]);

  return null;
}
