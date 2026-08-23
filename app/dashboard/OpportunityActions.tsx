"use client";

import { useState } from "react";

type OpportunityActionsProps = {
  opportunityId: string;
  introductionId?: string | null;
};

export function OpportunityActions({
  opportunityId,
  introductionId
}: OpportunityActionsProps) {
  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  async function sendAction(
    action: string,
    extra: Record<string, unknown> = {}
  ) {
    setLoading(true);
    setMessage(null);

    try {
      const response =
        await fetch(
          `/api/opportunities/${opportunityId}/action`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              action,
              ...extra
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Action failed"
        );
      }

      setMessage(
        "Action completed successfully."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Action failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function recordOutcome(
    outcomeType: string
  ) {
    await sendAction(
      "record_outcome",
      {
        outcomeType,
        introductionId:
          introductionId ??
          undefined
      }
    );
  }

  return (
    <div
      style={{
        marginTop: 14
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8
        }}
      >
        <button
          type="button"
          className="retro-btn"
          disabled={loading}
          onClick={() =>
            sendAction(
              "saved"
            )
          }
        >
          {loading
            ? "Working..."
            : "Save opportunity"}
        </button>

        {introductionId && (
          <>
            <button
              type="button"
              className="retro-btn"
              disabled={loading}
              onClick={() =>
                recordOutcome(
                  "replied"
                )
              }
            >
              Replied
            </button>

            <button
              type="button"
              className="retro-btn"
              disabled={loading}
              onClick={() =>
                recordOutcome(
                  "meeting"
                )
              }
            >
              Meeting
            </button>

            <button
              type="button"
              className="retro-btn retro-btn-primary"
              disabled={loading}
              onClick={() =>
                recordOutcome(
                  "opportunity_created"
                )
              }
            >
              Opportunity created
            </button>

            <button
              type="button"
              className="retro-btn"
              disabled={loading}
              onClick={() =>
                recordOutcome(
                  "won"
                )
              }
            >
              Won
            </button>

            <button
              type="button"
              className="retro-btn"
              disabled={loading}
              onClick={() =>
                recordOutcome(
                  "lost"
                )
              }
            >
              Lost
            </button>
          </>
        )}
      </div>

      {message && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            background:
              "var(--panel-solid)",
            border:
              "1px solid var(--border)",
            fontSize: 12,
            color:
              "var(--text-dim)"
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}