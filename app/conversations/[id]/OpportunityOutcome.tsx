"use client";

import { useState } from "react";

type OutcomeType =
  | "collaboration"
  | "referral"
  | "career"
  | "mentorship"
  | "opportunity"
  | "follow_up"
  | "no_outcome";

type Props = {
  introductionRequestId: string;
  opportunityId: string;
  conversationId: string;
};

const outcomes: {
  type: OutcomeType;
  label: string;
  icon: string;
}[] = [
  {
    type: "collaboration",
    label: "Collaboration",
    icon: "🤝"
  },
  {
    type: "referral",
    label: "Referral",
    icon: "👥"
  },
  {
    type: "career",
    label: "Career",
    icon: "💼"
  },
  {
    type: "mentorship",
    label: "Mentorship",
    icon: "🎓"
  },
  {
    type: "opportunity",
    label: "Opportunity",
    icon: "✦"
  },
  {
    type: "follow_up",
    label: "Follow-up",
    icon: "◷"
  },
  {
    type: "no_outcome",
    label: "No outcome",
    icon: "⊘"
  }
];

export function OpportunityOutcome({
  introductionRequestId,
  opportunityId,
  conversationId
}: Props) {
  const [selected, setSelected] =
    useState<OutcomeType | null>(null);

  const [notes, setNotes] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function saveOutcome() {
    if (!selected) {
      setError("Select an outcome first.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/opportunities/outcome",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            introduction_request_id:
              introductionRequestId,

            opportunity_id:
              opportunityId,

            conversation_id:
              conversationId,

            outcome_type:
              selected,

            notes: notes.trim()
          })
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Unable to save outcome"
        );
      }

      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save outcome."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      style={{
        width: "100%",
        boxSizing: "border-box",
        marginTop: 20,
        padding: 20,
        borderRadius: 18,
        border:
          "1px solid rgba(59,130,246,0.45)",
        background:
          "linear-gradient(180deg, #111a26 0%, #0c141f 100%)",
        boxShadow:
          "0 12px 40px rgba(0,0,0,0.25)"
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 8
        }}
      >
        <span
          style={{
            fontSize: 21
          }}
        >
          ◉
        </span>

        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.08em",
            color: "#4da3ff"
          }}
        >
          OPPORTUNITY OUTCOME
        </span>

        <span
          title="Record what happened after the introduction."
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            border:
              "1px solid rgba(255,255,255,0.25)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: "#9ca3af"
          }}
        >
          ?
        </span>
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 750,
          color: "#f8fafc",
          marginBottom: 18
        }}
      >
        How did this introduction go?
      </div>

      {/* Outcome buttons */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 10,
          width: "100%"
        }}
      >
        {outcomes.map((outcome) => {
          const active =
            selected === outcome.type;

          return (
            <button
              key={outcome.type}
              type="button"
              onClick={() => {
                setSelected(
                  outcome.type
                );
                setSaved(false);
                setError(null);
              }}
              style={{
                minHeight: 82,
                padding: "12px 8px",
                borderRadius: 12,
                border: active
                  ? "1px solid #22c55e"
                  : "1px solid rgba(148,163,184,0.22)",
                background: active
                  ? "rgba(34,197,94,0.10)"
                  : "rgba(15,23,42,0.75)",
                color: "#f8fafc",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                transition:
                  "all 150ms ease"
              }}
            >
              <span
                style={{
                  fontSize: 25,
                  lineHeight: 1
                }}
              >
                {outcome.icon}
              </span>

              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: "nowrap"
                }}
              >
                {outcome.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notes */}
      <div
        style={{
          marginTop: 20
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: "#cbd5e1",
            marginBottom: 8
          }}
        >
          Optional: what happened?
        </div>

        <textarea
          value={notes}
          onChange={(event) =>
            setNotes(
              event.target.value
            )
          }
          maxLength={500}
          placeholder="Share any notes about this introduction..."
          style={{
            width: "100%",
            minHeight: 110,
            resize: "vertical",
            boxSizing: "border-box",
            borderRadius: 12,
            border:
              "1px solid rgba(148,163,184,0.20)",
            background: "#172231",
            color: "#f8fafc",
            padding: 14,
            outline: "none",
            fontSize: 14
          }}
        />
      </div>

      {/* Bottom */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#64748b"
          }}
        >
          {notes.length}/500
        </div>

        <button
          type="button"
          onClick={saveOutcome}
          disabled={
            saving ||
            !selected ||
            saved
          }
          style={{
            border: "none",
            borderRadius: 12,
            padding:
              "11px 18px",
            background:
              saved
                ? "#16a34a"
                : "#1683ff",
            color: "white",
            fontWeight: 750,
            cursor:
              saving ||
              !selected ||
              saved
                ? "default"
                : "pointer",
            opacity:
              !selected &&
              !saved
                ? 0.55
                : 1
          }}
        >
          {saving
            ? "Saving..."
            : saved
              ? "✓ Saved"
              : "✓ Save outcome"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: 10,
            color: "#f87171",
            fontSize: 13
          }}
        >
          {error}
        </div>
      )}
    </section>
  );
}