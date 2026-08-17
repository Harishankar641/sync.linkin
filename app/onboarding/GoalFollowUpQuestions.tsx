"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Goal-aware follow-up questions. When the user types their goal in
 * onboarding, we debounce-fetch /api/onboarding-questions and render
 * 3–5 tailored questions the AI designed for THIS goal + intent.
 *
 * Jack: "when someone puts their goals in, maybe we should custom
 * generate the questions we ask based on that specific goal."
 *
 * Answers are concatenated and appended to the goals string (separated
 * by `\n\n`) so they flow into the same twin context — no schema
 * changes needed.
 *
 * Intent comes from the `?intent=cofounder|investors|advisors|idea`
 * query param the landing tiles deep-link with. If missing, the AI
 * still generates from the goal text alone.
 */

type Question = {
  id: string;
  prompt: string;
  placeholder?: string;
  kind: "short" | "long";
};

export function GoalFollowUpQuestions({
  goal,
  intent,
  onAnswersChange
}: {
  goal: string;
  /** Optional intent label from the landing-page tile click. */
  intent?: string;
  /** Called whenever answers change. Parent appends to goals string. */
  onAnswersChange: (answersBlock: string) => void;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const lastGoalRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced fetch on goal change.
  useEffect(() => {
    const g = goal.trim();
    if (g.length < 12) {
      // too short to ask follow-ups against
      if (questions.length > 0) setQuestions([]);
      return;
    }
    if (g === lastGoalRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      lastGoalRef.current = g;
      setLoading(true);
      try {
        const r = await fetch("/api/onboarding-questions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ goal: g, intent: intent || "" })
        });
        const j = await r.json();
        if (Array.isArray(j.questions)) {
          setQuestions(j.questions as Question[]);
        }
      } catch {
        /* silent — fallback is no questions */
      } finally {
        setLoading(false);
      }
    }, 1200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, intent]);

  // Propagate combined answers to parent.
  useEffect(() => {
    const block = questions
      .map((q) => {
        const a = (answers[q.id] || "").trim();
        if (!a) return null;
        return `Q: ${q.prompt}\nA: ${a}`;
      })
      .filter(Boolean)
      .join("\n\n");
    onAnswersChange(block);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, questions]);

  if (questions.length === 0 && !loading) return null;

  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 12,
        border: "1px solid rgba(31, 89, 255, 0.30)",
        background: "rgba(31, 89, 255, 0.05)"
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#1f59ff",
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}
      >
        <span aria-hidden="true">✦</span>
        <span>
          {loading ? "tailoring questions to your goal…" : "tailored to your goal"}
        </span>
      </div>
      {!loading && (
        <p
          style={{
            fontSize: 12,
            color: "var(--text-dim)",
            lineHeight: 1.5,
            margin: "0 0 12px"
          }}
        >
          Answering even 1-2 of these makes your twin{" "}
          <strong style={{ color: "var(--text)" }}>10x sharper</strong> at
          finding the right counterpart. Skip the ones that don&apos;t fit.
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {questions.map((q) => (
          <div key={q.id}>
            <label
              htmlFor={`gfu-${q.id}`}
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 4,
                lineHeight: 1.4
              }}
            >
              {q.prompt}
            </label>
            <textarea
              id={`gfu-${q.id}`}
              value={answers[q.id] ?? ""}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
              }
              rows={q.kind === "short" ? 1 : 3}
              placeholder={q.placeholder || ""}
              className="retro-input"
              style={{
                width: "100%",
                fontSize: 13,
                padding: 8,
                resize: "vertical",
                minHeight: q.kind === "short" ? 36 : 70
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
