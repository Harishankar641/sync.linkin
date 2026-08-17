"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * PollMissingTwinsButton — invites every twin that hasn't yet answered
 * this specific poll into the result set, then re-synthesizes the network
 * paragraph + headline. Lets polls keep growing as new people sign up,
 * rather than freezing at the moment-of-creation snapshot.
 *
 * Hits /api/polls/[id]/poll-missing. Shows the count of twins that just
 * answered so it's obvious the click did something.
 */
export function PollMissingTwinsButton({
  pollId,
  pendingCount
}: {
  pollId: string;
  pendingCount: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<number | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setJustAdded(null);
    try {
      const r = await fetch(`/api/polls/${pollId}/poll-missing`, {
        method: "POST"
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        setError(j.detail || j.error || "Couldn't poll missing twins.");
        setRunning(false);
        return;
      }
      setJustAdded(j.added ?? 0);
      router.refresh();
      setRunning(false);
    } catch {
      setError("Couldn't reach the server.");
      setRunning(false);
    }
  }

  // No new twins to poll — hide the button entirely. The signal "everyone
  // who could answer has answered" is more useful than a dead button.
  if (pendingCount <= 0 && justAdded === null) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={running || pendingCount <= 0}
        className="retro-btn retro-btn-primary text-xs"
        title="Poll every twin that has signed up since this poll launched, then re-synthesize the result."
      >
        {running
          ? `polling ${pendingCount} new twin${pendingCount === 1 ? "" : "s"}…`
          : pendingCount > 0
            ? `+ poll ${pendingCount} new twin${pendingCount === 1 ? "" : "s"}`
            : "all twins have answered"}
      </button>
      {justAdded !== null && (
        <span className="text-xs" style={{ color: "var(--text-dim)" }}>
          {justAdded > 0
            ? `added ${justAdded} fresh response${justAdded === 1 ? "" : "s"} · synthesis refreshed`
            : "no new responses generated"}
        </span>
      )}
      {error && (
        <span className="text-xs" style={{ color: "var(--red, #ef4444)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
