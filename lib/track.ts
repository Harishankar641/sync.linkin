/**
 * Fire-and-forget funnel beacon. Never throws, never blocks UI. Uses
 * sendBeacon when available so events survive page navigations (claim
 * clicks that leave the page). The anonymous id is a random
 * localStorage token so a funnel can be stitched across steps without
 * an account. It is not a fingerprint and carries no personal data.
 *
 * Server side: /api/track silently no-ops until the 0003 migration
 * runs, so calling this is always safe.
 */
export function track(event: string, meta?: Record<string, unknown>) {
  try {
    if (typeof window === "undefined") return;
    let anon = "";
    try {
      anon = localStorage.getItem("syncedin-anon-id") || "";
      if (!anon) {
        anon =
          Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem("syncedin-anon-id", anon);
      }
    } catch {
      /* storage blocked: events still send, just unstitched */
    }
    const payload = JSON.stringify({
      event,
      path: window.location.pathname,
      anon,
      meta
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/track",
        new Blob([payload], { type: "application/json" })
      );
    } else {
      fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(() => {});
    }
  } catch {
    /* never break the product for analytics */
  }
}
