"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * SitewidePrefetch — mounted by AppShell on every authed page. On
 * first paint, it kicks off router.prefetch() for every primary nav
 * destination so subsequent clicks land instantly (loading.tsx
 * skeleton + cached JS bundle = sub-50ms perceived navigation).
 *
 * Staggered with setTimeout so we don't hammer the browser's network
 * pool right at hydration time — the user's current page renders
 * first, then prefetches trickle in.
 */
const ROUTES = [
  "/dashboard",
  "/messages",
  "/invite",
  "/poll",
  "/hypernetwork",
  "/conferences/new",
  "/communities/new",
  "/onboarding",
  "/settings/notifications",
  "/feedback"
];

export function SitewidePrefetch() {
  const router = useRouter();
  useEffect(() => {
    // Wait until the current page has had a chance to settle before we
    // start firing network requests for routes the user might not even
    // visit. 220ms is enough for the typical first paint + interactive.
    const kickoff = setTimeout(() => {
      ROUTES.forEach((r, i) => {
        setTimeout(() => {
          try {
            router.prefetch(r);
          } catch {
            /* unsupported in dev sometimes */
          }
        }, i * 60);
      });
    }, 220);
    return () => clearTimeout(kickoff);
  }, [router]);
  return null;
}
