"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Color the score: cool → hot.
function tone(score: number): string {
  if (score >= 75) return "var(--green)";
  if (score >= 45) return "var(--amber)";
  return "var(--text-dim)";
}

export function ExcitementControl({
  conversationId,
  score,
  locked
}: {
  conversationId: string;
  score: number | null;
  locked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(score ?? 50);
  const [saving, setSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  // Two-step save: after the user picks a new score, we ask WHY so
  // the calibration delta carries reasoning the next-AI-score prompt
  // can learn from. Skippable, but the field is visible by default
  // so most users will at least drop a sentence.
  const [askingReason, setAskingReason] = useState(false);
  const [reason, setReason] = useState("");

  // The "why" prompt only matters when the new value is actually
  // different from what's already there (otherwise we'd capture a
  // useless calibration). aiPrior is what the AI scored before this
  // override.
  const aiPrior = score ?? null;
  const isChanged = aiPrior === null || val !== aiPrior;

  function startSave() {
    if (!isChanged) {
      // No-op save — just close the editor without prompting.
      setOpen(false);
      return;
    }
    setAskingReason(true);
  }

  async function commitSave() {
    setSaving(true);
    try {
      await fetch("/api/excitement", {
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

  function cancelReason() {
    setAskingReason(false);
    setReason("");
  }

  return (
    <div className="flex items-center gap-1 shrink-0 relative">
      <button
        type="button"
        onClick={() => setShowInfo(true)}
        title="How the score is calculated"
        className="retro-dim hover:text-white text-sm leading-none px-1"
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: "1.5px solid var(--border-bright)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700
        }}
      >
        i
      </button>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="retro-panel retro-panel-hover px-2.5 py-1 text-sm"
          title="Deal = how excited you are about this conversation. Click to override."
        >
          {score === null ? (
            <span className="retro-dim">score —</span>
          ) : (
            <span
              style={{
                color: tone(score),
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}
            >
              {/* DEAL icon — handshake silhouette. Jack: "have the
                  icon better represent deal." Was a flat ◆ diamond
                  glyph; the handshake reads as "agreement reached"
                  which IS what excitement / deal score measures.
                  Custom inline SVG tints to the score tone. */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              >
                <path d="M11 17l-5-5 4-4 3 3 4-4 5 5-6 6a3 3 0 0 1-4 0z" />
                <path d="M14 7l-3 3" />
                <path d="M2 13l4-4" />
              </svg>
              {score}
              {locked ? " ·set" : ""}
            </span>
          )}
        </button>
      ) : askingReason ? (
        // Step 2: capture WHY the user is rescoring so the calibration
        // delta carries reasoning the next AI-score prompt can learn from.
        // The reason is optional but visible by default — most users drop
        // at least a sentence when asked directly.
        <div
          className="retro-panel p-3"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 280
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--text)",
              fontWeight: 600
            }}
          >
            Why{" "}
            <span style={{ color: tone(val), fontFamily: "monospace" }}>
              {val}
            </span>
            {aiPrior !== null && (
              <>
                {" "}
                instead of{" "}
                <span
                  style={{
                    color: "var(--text-dim)",
                    fontFamily: "monospace"
                  }}
                >
                  {aiPrior}
                </span>
                ?
              </>
            )}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 400))}
            rows={3}
            autoFocus
            placeholder="e.g. they're a real fit, not just on paper · this lead is dead · I'd rather meet in person · serious about the deal"
            className="retro-input"
            style={{
              fontSize: 13,
              padding: 8,
              width: "100%",
              minHeight: 60
            }}
          />
          <div
            style={{
              fontSize: 10,
              color: "var(--text-dim)",
              lineHeight: 1.4
            }}
          >
            Trains your personal scoring rubric. Future scores get
            sharper with each reason you add.
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={cancelReason}
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
              title="Save without a reason — calibration still logged"
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
            className="w-28 accent-[var(--amber)]"
          />
          <span
            className="text-sm w-8 text-center font-mono"
            style={{ color: tone(val) }}
          >
            {val}
          </span>
          <button
            type="button"
            onClick={startSave}
            disabled={saving}
            className="retro-btn retro-btn-primary text-sm"
            title={
              isChanged
                ? "Continue — we'll ask why"
                : "No change — just close"
            }
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
        <ScoringPromptModal onClose={() => setShowInfo(false)} />
      )}
    </div>
  );
}

function ScoringPromptModal({ onClose }: { onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [calibrations, setCalibrations] = useState<
    Array<{ ai_score: number | null; user_score: number; reason: string | null }>
  >([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/scoring-prompt")
      .then((r) => r.json())
      .then((j) => {
        setPrompt(j.prompt ?? "");
        setDefaultPrompt(j.default_prompt ?? "");
        setIsDefault(!!j.is_default);
        setCalibrations(j.calibrations ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/scoring-prompt", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      setIsDefault(false);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setPrompt(defaultPrompt);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="retro-panel retro-shadow p-6"
        style={{ maxWidth: 720, width: "100%", maxHeight: "85vh", overflow: "auto" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="retro-h1 text-xl">How the excitement score works</h2>
          <button
            onClick={onClose}
            className="retro-dim hover:text-white text-lg"
          >
            ✕
          </button>
        </div>
        <p className="mt-3 text-sm" style={{ color: "var(--text-dim)" }}>
          After every completed conversation, The Sync reads the full
          transcript and returns a 0 to 100 score using the rubric below.
          It&apos;s <em>your</em> Sync Score, so you choose how it&apos;s
          calibrated. Every time you change a score manually, the new value
          is logged as a calibration delta, and the next score The Sync
          generates for you uses those deltas as guidance. Over time your
          chats stay sorted by what&apos;s actually highest-value to you.
        </p>

        <div className="mt-5">
          <label className="retro-label" style={{ color: "var(--amber-bright)" }}>
            scoring rubric ({isDefault ? "default" : "your custom version"})
          </label>
          {!loaded ? (
            <p className="retro-dim text-sm mt-2">Loading…</p>
          ) : (
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={12}
              className="retro-input mt-2 font-mono text-sm"
              style={{ minHeight: 220 }}
            />
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || !prompt.trim()}
              className="retro-btn retro-btn-primary"
            >
              {saving ? "Saving…" : "Save rubric"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="retro-btn"
            >
              Reset to default
            </button>
          </div>
        </div>

        {calibrations.length > 0 && (
          <div className="mt-6">
            <label className="retro-label" style={{ color: "var(--amber-bright)" }}>
              what the score has learned from you ({calibrations.length})
            </label>
            <ul className="mt-2 text-sm space-y-1.5">
              {calibrations.map((c, i) => (
                <li key={i} className="retro-panel p-2.5">
                  AI scored{" "}
                  <span
                    className="font-mono"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {c.ai_score ?? "—"}
                  </span>{" "}
                  → you corrected to{" "}
                  <span
                    className="font-mono"
                    style={{ color: "var(--amber-bright)" }}
                  >
                    {c.user_score}
                  </span>
                  {c.reason ? ` — ${c.reason}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
