"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ResponseRow = {
  id: string;
  poll_id: string;
  twin_user_id: string;
  twin_response: string;
  human_override: string | null;
  was_overridden: boolean;
};

/**
 * OverrideRow — inline edit affordance for the signed-in user to correct
 * what their own twin answered. Hitting "save my real answer" calls the
 * override API and refreshes the page so the synthesis can be re-run.
 */
export function OverrideRow({
  response,
  pollId,
  isSelf
}: {
  response: ResponseRow;
  pollId: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    response.human_override ?? response.twin_response
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (draft.trim().length < 3) {
      setError("Give the override at least a few words.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/polls/${pollId}/override`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response_id: response.id, text: draft.trim() })
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        setError(j.detail || j.error || "Save failed.");
        setSaving(false);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
      setSaving(false);
    }
  }

  const displayed =
    response.was_overridden && response.human_override
      ? response.human_override
      : response.twin_response;

  return (
    <div
      className="retro-panel"
      style={{
        padding: 18,
        borderColor: response.was_overridden
          ? "var(--amber)"
          : "var(--border)"
      }}
    >
      {response.was_overridden && (
        <div
          className="retro-label"
          style={{ color: "var(--amber-bright)" }}
        >
          your correction · live
        </div>
      )}
      {!editing ? (
        <>
          <div
            className="text-base mt-1"
            style={{
              color: "var(--text)",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap"
            }}
          >
            {displayed}
          </div>
          {response.was_overridden && response.twin_response && (
            <details className="mt-3">
              <summary
                className="text-xs cursor-pointer"
                style={{ color: "var(--text-dim)" }}
              >
                show what your twin originally said
              </summary>
              <div
                className="mt-2 retro-panel"
                style={{
                  padding: 12,
                  color: "var(--text-dim)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap"
                }}
              >
                {response.twin_response}
              </div>
            </details>
          )}
          {isSelf && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="retro-btn text-xs mt-4"
            >
              {response.was_overridden
                ? "edit your correction"
                : "✎ correct this"}
            </button>
          )}
        </>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="retro-input"
            style={{ minHeight: 100, resize: "vertical" }}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="retro-btn retro-btn-primary text-xs"
            >
              {saving ? "saving…" : "save my real answer"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(response.human_override ?? response.twin_response);
                setError(null);
              }}
              className="retro-btn text-xs"
            >
              cancel
            </button>
          </div>
          {error && (
            <p
              className="mt-2 text-xs"
              style={{ color: "var(--red, #ef4444)" }}
            >
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
