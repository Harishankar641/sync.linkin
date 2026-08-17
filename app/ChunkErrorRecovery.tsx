"use client";

import { useEffect } from "react";

/**
 * Catches the dreaded `ChunkLoadError` that Next.js throws when a user's
 * stale tab tries to load a JS chunk hash that no longer exists after a
 * deploy. Without recovery the page shows the empty React-#418/#423
 * hydration error screen — what Jack hit on /poll in prod.
 *
 * Strategy: listen for unhandled errors + promise rejections globally,
 * detect the ChunkLoadError signature, and force a one-time hard reload
 * (using a sessionStorage marker so we don't infinite-loop if reload
 * also fails). Mounted once at the root in app/layout.tsx.
 */
export function ChunkErrorRecovery() {
  useEffect(() => {
    const RELOAD_KEY = "syncedin.chunk_reload_at";

    function looksLikeChunkError(err: unknown): boolean {
      if (!err) return false;
      const e = err as { name?: string; message?: string };
      if (e.name === "ChunkLoadError") return true;
      const msg = (e.message || "").toString();
      return (
        /ChunkLoadError/i.test(msg) ||
        /Loading chunk \d+ failed/i.test(msg) ||
        /Loading CSS chunk/i.test(msg) ||
        /Failed to fetch dynamically imported module/i.test(msg)
      );
    }

    function triggerReload() {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
        const now = Date.now();
        // Cool-down: don't reload more than once per 30s, ever. If the
        // chunk still 404s after a fresh load there's a real bug — let
        // the user see it rather than enter a refresh loop.
        if (now - last < 30_000) return;
        sessionStorage.setItem(RELOAD_KEY, String(now));
      } catch {
        /* sessionStorage blocked — best-effort, still reload */
      }
      // Force-bypass cache. Same effect as Cmd+Shift+R.
      window.location.reload();
    }

    const onError = (event: ErrorEvent) => {
      if (looksLikeChunkError(event.error || event.message)) {
        triggerReload();
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (looksLikeChunkError(event.reason)) {
        triggerReload();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
