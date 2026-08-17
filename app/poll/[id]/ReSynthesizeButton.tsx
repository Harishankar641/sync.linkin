"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * ReSynthesizeButton — anyone who can view the poll can request a fresh
 * synthesis (since human overrides may have been added since the last run).
 * Hits /api/polls/[id]/synthesize and refreshes.
 */
export function ReSynthesizeButton({ pollId }: { pollId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const r = await fetch(`/api/polls/${pollId}/synthesize`, {
        method: "POST"
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        setError(j.detail || j.error || "Re-synthesize failed.");
        setRunning(false);
        return;
      }
      router.refresh();
      setRunning(false);
    } catch {
      setError("Couldn't reach the server.");
      setRunning(false);
    }
  }

  return (
    <div
      className="mt-5"
      style={{ display: "flex", flexDirection: "column", gap: 6 }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="retro-btn text-xs"
          title="Re-read every twin's answer (plus your manual corrections) and write a fresh top-level synthesis."
        >
          {running
            ? "re-synthesizing…"
            : "↻ re-synthesize with corrections"}
        </button>
        {error && (
          <span className="text-xs" style={{ color: "var(--red, #ef4444)" }}>
            {error}
          </span>
        )}
      </div>
      {/* Jack: "I don't really know what it means when it's
          re-synthesized with overrides." Spell it out inline so the
          button isn't a mystery. */}
      <p
        className="retro-dim text-xs"
        style={{ maxWidth: 560, lineHeight: 1.5, margin: 0 }}
      >
        Re-reads every twin's answer below — including any you've
        manually corrected — and writes a fresh top-level synthesis at
        the top of the page. Use this after you fix an answer that the
        twin got wrong, or after new people answer the poll.
      </p>
    </div>
  );
}
