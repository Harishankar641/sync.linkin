"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * PollCreateForm — text area for the question + optional context. On submit
 * hits /api/polls/create which fans out to every twin and synthesizes the
 * result. Then we route to the detail page once we have an ID back.
 */
export function PollCreateForm() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (question.trim().length < 6) {
      setError("Give us at least a few words to ask the network.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/polls/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          context: context.trim() || undefined
        })
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        setError(j.detail || j.error || "Something went wrong.");
        setSubmitting(false);
        return;
      }
      router.push(`/poll/${j.id}`);
    } catch {
      setError("Couldn't reach the server.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="retro-panel" style={{ padding: 16 }}>
      <label className="block">
        <div className="text-sm font-semibold">Question</div>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What's the single highest-leverage move for a founder in 2026?"
          rows={3}
          className="retro-input mt-1"
          style={{ resize: "vertical", minHeight: 70 }}
        />
      </label>
      <label className="block mt-3">
        <div className="text-sm font-semibold">
          Context (optional)
        </div>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Frame the question for every twin so the answers stay comparable."
          rows={2}
          className="retro-input mt-1"
          style={{ resize: "vertical", minHeight: 50 }}
        />
      </label>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={submitting || question.trim().length < 6}
          className="retro-btn retro-btn-primary text-sm"
        >
          {submitting
            ? "polling the network…"
            : "+ run poll across every twin"}
        </button>
        {submitting && (
          <span
            className="text-xs"
            style={{ color: "var(--text-dim)" }}
          >
            fan-out takes ~10-30s. You&apos;ll be redirected when done.
          </span>
        )}
      </div>
      {error && (
        <p
          className="mt-3 text-xs"
          style={{ color: "var(--red, #ef4444)" }}
        >
          {error}
        </p>
      )}
    </form>
  );
}
