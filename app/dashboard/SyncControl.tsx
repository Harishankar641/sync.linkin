"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * SyncControl — pill-style editor for the per-pair sync score (#278).
 *
 * Mirrors ExcitementControl visually so the two scores read as a
 * matched set: each in its own bubble, each with its own (i) tooltip
 * explaining what the score measures, each clickable to override.
 *
 * The sync score is computed deterministically from twin context. This
 * control lets the user override the displayed number for THIS specific
 * pair (e.g. "I know this person, the algorithm's underrating us"). The
 * override is saved to conversations.sync_score_override and used as
 * the display value going forward. Reason feeds calibration.
 *
 * Different from the (i) on /api/scoring-prompt — that edits the global
 * rubric. This is single-pair correction.
 */
function tone(score: number): string {
  if (score >= 70) return "var(--green)";
  if (score >= 40) return "var(--amber-bright)";
  return "var(--text-dim)";
}

export function SyncControl({
  conversationId,
  aiScore,
  overrideScore
}: {
  conversationId: string;
  aiScore: number;
  overrideScore: number | null;
}) {
  const router = useRouter();
  const displayedScore = overrideScore ?? aiScore;
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(displayedScore);
  const [saving, setSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [askingReason, setAskingReason] = useState(false);
  const [reason, setReason] = useState("");

  const isChanged = val !== displayedScore;

  function startSave() {
    if (!isChanged) {
      setOpen(false);
      return;
    }
    setAskingReason(true);
  }

  async function commitSave() {
    setSaving(true);
    try {
      await fetch("/api/sync-override", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          score: val,
          reason: reason.trim() || null
        })
      });
      setOpen(false);
      setAskingReason(false);
      setReason("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1 shrink-0 relative">
      <button
        type="button"
        onClick={() => setShowInfo((v) => !v)}
        title="How sync is calculated"
        aria-label="What is sync?"
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: "1.5px solid var(--border-bright)",
          color: "var(--text-dim)",
          fontSize: 12,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--panel)",
          cursor: "pointer"
        }}
      >
        i
      </button>

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setVal(displayedScore);
          }}
          className="retro-panel retro-panel-hover px-2.5 py-1 text-sm"
          title="Sync = pair-wise complementarity. Click to override."
        >
          <span
            style={{
              color: tone(displayedScore),
              display: "inline-flex",
              alignItems: "center",
              gap: 4
            }}
          >
            {/* SYNC icon — two interlocked rings (Venn intersection)
                signaling alignment between two twins. Custom inline
                SVG so the color always tracks the score tone instead
                of locking to the emoji renderer's default palette.
                Jack: "have the icon better represent sync." */}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <circle cx="9" cy="12" r="5" />
              <circle cx="15" cy="12" r="5" />
            </svg>
            {displayedScore}%
            {overrideScore !== null ? " ·set" : ""}
          </span>
        </button>
      ) : askingReason ? (
        <div
          className="retro-panel p-3"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 280
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            Why{" "}
            <span style={{ color: tone(val), fontFamily: "monospace" }}>
              {val}%
            </span>{" "}
            instead of{" "}
            <span
              style={{
                color: "var(--text-dim)",
                fontFamily: "monospace"
              }}
            >
              {aiScore}%
            </span>
            ?
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 400))}
            rows={3}
            autoFocus
            placeholder="e.g. we already collaborated · their goals shifted · they're not actually who their twin says they are"
            className="retro-input"
            style={{ fontSize: 13, padding: 8, minHeight: 60 }}
          />
          <div
            style={{
              fontSize: 10,
              color: "var(--text-dim)",
              lineHeight: 1.4
            }}
          >
            Calibrates how sync gets scored for you. Your reason becomes
            ground truth for future matches.
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => {
                setAskingReason(false);
                setReason("");
              }}
              disabled={saving}
              className="retro-btn text-xs"
              style={{ padding: "5px 10px" }}
            >
              back
            </button>
            <button
              type="button"
              onClick={commitSave}
              disabled={saving}
              className="retro-btn text-xs"
              style={{ padding: "5px 10px" }}
            >
              skip
            </button>
            <button
              type="button"
              onClick={commitSave}
              disabled={saving || !reason.trim()}
              className="retro-btn retro-btn-primary text-xs"
              style={{ padding: "5px 10px", fontWeight: 700 }}
            >
              {saving ? "…" : "save w/ reason"}
            </button>
          </div>
        </div>
      ) : (
        <div className="retro-panel p-2 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={val}
            onChange={(e) => setVal(Number(e.target.value))}
            disabled={saving}
            className="w-28"
          />
          <span
            className="text-sm w-10 text-center font-mono"
            style={{ color: tone(val) }}
          >
            {val}%
          </span>
          <button
            type="button"
            onClick={startSave}
            disabled={saving}
            className="retro-btn retro-btn-primary text-sm"
          >
            {saving ? "…" : isChanged ? "next →" : "close"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={saving}
            className="retro-dim text-sm hover:text-white px-1"
          >
            ✕
          </button>
        </div>
      )}

      {showInfo && (
        <div
          onClick={() => setShowInfo(false)}
          style={{
            position: "absolute",
            top: 28,
            right: 0,
            zIndex: 30,
            width: 280,
            background: "var(--panel-solid)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 14,
            boxShadow: "0 16px 32px -10px rgba(0,0,0,0.4)",
            fontSize: 12,
            lineHeight: 1.5,
            cursor: "pointer"
          }}
        >
          <div className="font-semibold mb-1" style={{ fontSize: 13 }}>
            What is Sync?
          </div>
          <p style={{ margin: 0, color: "var(--text-dim)" }}>
            Pair-wise complementarity between your twin and theirs. High
            when their goals match what you offer AND your goals match
            what they offer. Click the {displayedScore}% pill to override
            for this pair — the reason you give calibrates future scores.
          </p>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "var(--text-dim)",
              fontStyle: "italic"
            }}
          >
            Click anywhere to close.
          </div>
        </div>
      )}
    </div>
  );
}
