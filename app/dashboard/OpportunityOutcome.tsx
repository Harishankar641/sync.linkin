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
}[] = [
  {
    type: "collaboration",
    label: "Collaboration"
  },
  {
    type: "referral",
    label: "Referral"
  },
  {
    type: "career",
    label: "Career"
  },
  {
    type: "mentorship",
    label: "Mentorship"
  },
  {
    type: "opportunity",
    label: "Opportunity"
  },
  {
    type: "follow_up",
    label: "Follow-up"
  },
  {
    type: "no_outcome",
    label: "No outcome"
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

  const [loading, setLoading] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function recordOutcome(
    outcomeType: OutcomeType
  ) {
    if (loading || saved) {
      return;
    }

    setSelected(outcomeType);
    setLoading(true);
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
              outcomeType,
            notes
          })
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Unable to record outcome"
        );
      }

      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to record outcome"
      );

      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  if (saved) {
    return (
      <div
        className="retro-panel"
        style={{
          marginTop: 16,
          padding: 14,
          fontSize: 13
        }}
      >
        <strong>
          Outcome recorded
        </strong>

        <div
          style={{
            marginTop: 4,
            opacity: 0.7
          }}
        >
          Your Twin can use this result
          to improve future opportunities.
        </div>
      </div>
    );
  }

  return (
    <div
      className="retro-panel"
      style={{
        marginTop: 16,
        padding: 16
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing:
            "0.12em",
          textTransform:
            "uppercase",
          color:
            "var(--amber-bright)"
        }}
      >
        Opportunity outcome
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 15,
          fontWeight: 800
        }}
      >
        How did this introduction go?
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 8
        }}
      >
        {outcomes.map((outcome) => (
          <button
            key={outcome.type}
            type="button"
            disabled={loading}
            onClick={() =>
              recordOutcome(
                outcome.type
              )
            }
            style={{
              padding:
                "8px 12px",
              cursor: loading
                ? "not-allowed"
                : "pointer",
              opacity:
                loading &&
                selected !==
                  outcome.type
                  ? 0.5
                  : 1
            }}
          >
            {loading &&
            selected ===
              outcome.type
              ? "Saving..."
              : outcome.label}
          </button>
        ))}
      </div>

      <textarea
        value={notes}
        onChange={(event) =>
          setNotes(
            event.target.value
          )
        }
        placeholder="Optional: what happened?"
        rows={3}
        style={{
          width: "100%",
          marginTop: 12,
          padding: 10,
          resize: "vertical"
        }}
      />

      {error && (
        <div
          style={{
            marginTop: 10,
            fontSize: 13,
            color:
              "var(--red, #e0526a)"
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}