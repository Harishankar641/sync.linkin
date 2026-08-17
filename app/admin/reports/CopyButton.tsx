"use client";

import { useState } from "react";

/**
 * One-click copy button used in the admin reports inbox. Accepts a
 * `text` blob to copy and an optional `onAck` callback fired AFTER
 * a successful copy (so "Copy all + ack" can flip the rows in one
 * gesture).
 */
export function CopyButton({
  text,
  label,
  onAck
}: {
  text: string;
  label: string;
  onAck?: () => void | Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          if (onAck) {
            try {
              await onAck();
            } catch {
              /* ack failures shouldn't break the copy UX */
            }
          }
          setTimeout(() => setCopied(false), 1600);
        } catch {
          window.prompt("Copy this:", text);
        }
      }}
      className="retro-btn"
      style={{
        fontSize: 12,
        padding: "5px 10px",
        flexShrink: 0,
        borderColor: copied ? "#22c55e" : undefined,
        color: copied ? "#22c55e" : undefined
      }}
    >
      {copied ? "✓ copied" : label}
    </button>
  );
}

/**
 * Per-row "Ack" toggle. Marks a single grouped signature (or list of
 * ids) as handed off. Calls POST /api/admin/feedback-ack and refreshes
 * the page so the row falls into the "acked" pile.
 */
export function AckToggle({
  signatures,
  initialAcked
}: {
  signatures: string[];
  initialAcked: boolean;
}) {
  const [acked, setAcked] = useState(initialAcked);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/admin/feedback-ack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signatures, unack: acked })
      });
      setAcked((v) => !v);
      // Quick refresh so server-side grouping reflects the new state.
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload();
      }, 200);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="retro-btn"
      style={{
        fontSize: 11,
        padding: "4px 8px",
        flexShrink: 0,
        borderColor: acked ? "#22c55e" : undefined,
        color: acked ? "#22c55e" : "var(--text-dim)"
      }}
      title={
        acked
          ? "Acked — paste shared with an AI assistant. Click to un-ack."
          : "Mark as paste-shared with an AI assistant."
      }
    >
      {acked ? "✓ acked" : "ack"}
    </button>
  );
}

/**
 * Big top-of-page "Copy all un-acked errors + mark them acked" button.
 * One click → all unacked errors land on the clipboard in a single
 * AI-ready blob AND every row gets stamped acked_at=now.
 */
export function CopyAllUnackedButton({
  blob,
  signatures,
  count
}: {
  blob: string;
  signatures: string[];
  count: number;
}) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy || count === 0) return;
    setBusy(true);
    try {
      await navigator.clipboard.writeText(blob);
      await fetch("/api/admin/feedback-ack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signatures })
      });
      setDone(true);
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload();
      }, 800);
    } catch {
      window.prompt("Copy this:", blob);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={go}
      disabled={busy || count === 0}
      className="retro-btn retro-btn-primary"
      style={{ fontSize: 13, padding: "8px 16px" }}
    >
      {done
        ? "✓ copied + acked"
        : count === 0
          ? "no new errors"
          : `□ copy all ${count} new + ack`}
    </button>
  );
}
