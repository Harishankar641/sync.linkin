"use client";

import { useEffect, useState } from "react";

/**
 * Cycling dots loader: . / .. / ... / .. / . / ...
 * Designed for in-button "drafting" indicators so the user sees motion
 * instead of a static string.
 */
const FRAMES = [".", "..", "...", "..", "."];

export function DotsLoader({
  label,
  intervalMs = 220
}: {
  label?: string;
  intervalMs?: number;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setI((n) => (n + 1) % FRAMES.length),
      intervalMs
    );
    return () => clearInterval(t);
  }, [intervalMs]);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {label}
      <span
        style={{
          fontFamily:
            '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
          letterSpacing: "0.15em",
          minWidth: 22,
          display: "inline-block",
          textAlign: "left"
        }}
      >
        {FRAMES[i]}
      </span>
    </span>
  );
}
