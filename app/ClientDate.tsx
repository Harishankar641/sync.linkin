"use client";

import { useEffect, useState } from "react";

/**
 * Renders a timestamp using the user's locale + timezone WITHOUT
 * causing a hydration mismatch.
 *
 * The root cause this fixes (Ari's React #422 + #425 errors):
 * `new Date(iso).toLocaleString()` produces different output on the
 * server (UTC, en-US server locale) vs the client (user's timezone +
 * locale), so the SSR HTML and the first client render disagree.
 * React 18 logs that as a fatal hydration error in production builds.
 *
 * Strategy: render an EMPTY string on the server + during the first
 * client render, then swap to the localized string after mount.
 * The visible flash is one frame; the silent kill is a worth-it trade.
 *
 * Usage: <ClientDate value={isoString} />
 *        <ClientDate value={ms} mode="dateOnly" />
 */
export function ClientDate({
  value,
  mode = "full",
  fallback = ""
}: {
  value: string | number | Date | null | undefined;
  mode?: "full" | "dateOnly" | "timeOnly";
  /** Text to show before mount (server render + first paint). Default
   *  empty so the layout doesn't shift on hydration. */
  fallback?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || value == null || value === "") {
    return <span suppressHydrationWarning>{fallback}</span>;
  }

  let formatted = "";
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
      formatted = fallback;
    } else if (mode === "dateOnly") {
      formatted = d.toLocaleDateString();
    } else if (mode === "timeOnly") {
      formatted = d.toLocaleTimeString();
    } else {
      formatted = d.toLocaleString();
    }
  } catch {
    formatted = fallback;
  }
  return <span suppressHydrationWarning>{formatted}</span>;
}
