"use client";

import { useState } from "react";

/**
 * Share URL box with one-click copy, plus native share button on mobile.
 * Renders the URL in monospace so attendees can also just read + type it.
 */
export function ShareUrlBox({
  url,
  conferenceName
}: {
  url: string;
  conferenceName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  }

  async function nativeShare() {
    if (!("share" in navigator)) return;
    try {
      await (navigator as any).share({
        title: `Join ${conferenceName} on SyncedIn`,
        text: `Inside-only twin networking for ${conferenceName}. Join here:`,
        url
      });
      setShared(true);
      setTimeout(() => setShared(false), 1600);
    } catch {
      /* user cancelled */
    }
  }

  const canNativeShare =
    typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div
      className="retro-panel"
      style={{ padding: 14, borderColor: "var(--amber)" }}
    >
      <div
        className="retro-label"
        style={{ color: "var(--amber-bright)" }}
      >
        share with attendees
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="retro-input text-sm flex-1"
          style={{ fontFamily: '"IBM Plex Mono", ui-monospace, monospace', minWidth: 240 }}
        />
        <button
          type="button"
          onClick={copy}
          className="retro-btn retro-btn-primary text-sm shrink-0"
        >
          {copied ? "✓ copied" : "↗ copy link"}
        </button>
        {canNativeShare && (
          <button
            type="button"
            onClick={nativeShare}
            className="retro-btn text-sm shrink-0"
          >
            {shared ? "✓ shared" : "share…"}
          </button>
        )}
      </div>
      <p className="retro-dim text-xs mt-2">
        Anyone who signs up through this link becomes a member of{" "}
        {conferenceName}. Only members see each other in discovery here.
      </p>
    </div>
  );
}
