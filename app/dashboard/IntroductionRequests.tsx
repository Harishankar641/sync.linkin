"use client";

import { useState } from "react";

type IntroductionRequest = {
  id: string;
  opportunity_id: string;
  requester_id: string;
  connector_id: string;
  target_id: string;
  status: string;
  message: string | null;
  created_at: string;
};

type IntroductionRequestsProps = {
  requests: IntroductionRequest[];
  nameById: Record<string, string>;
};

export function IntroductionRequests({
  requests,
  nameById
}: IntroductionRequestsProps) {
  const [items, setItems] =
    useState<IntroductionRequest[]>(requests);

  const [loadingId, setLoadingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  async function respondToIntroduction(
    requestId: string,
    action: "approve" | "decline"
  ) {
    setLoadingId(requestId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        "/api/introductions/respond",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            introduction_request_id: requestId,
            action
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Unable to respond to introduction request."
        );
      }

      setItems((current) =>
        current.filter(
          (item) => item.id !== requestId
        )
      );

      if (action === "approve") {
        setSuccess(
          "Introduction approved. The requester can now proceed."
        );
      } else {
        setSuccess(
          "Introduction request declined."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to respond to introduction request."
      );
    } finally {
      setLoadingId(null);
    }
  }

  if (items.length === 0 && !error && !success) {
    return null;
  }

  return (
    <section
      style={{
        marginBottom: 24
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--amber-bright)",
          marginBottom: 12
        }}
      >
        Introduction requests
      </div>

      {success && (
        <div
          className="retro-panel"
          style={{
            padding: 12,
            marginBottom: 12,
            fontSize: 13
          }}
        >
          {success}
        </div>
      )}

      {error && (
        <div
          className="retro-panel"
          style={{
            padding: 12,
            marginBottom: 12,
            fontSize: 13
          }}
        >
          {error}
        </div>
      )}

      {items.map((request) => {
        const requester =
          nameById[request.requester_id] ??
          "Someone";

        const connector =
          nameById[request.connector_id] ??
          "You";

        const target =
          nameById[request.target_id] ??
          "someone";

        const isLoading =
          loadingId === request.id;

        return (
          <div
            key={request.id}
            className="retro-panel"
            style={{
              padding: 16,
              marginBottom: 12
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 800
              }}
            >
              New introduction request
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                fontWeight: 700
              }}
            >
              {requester}
              {" wants an introduction to "}
              {target}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                opacity: 0.7
              }}
            >
              {requester}
              {" → "}
              {connector}
              {" → "}
              {target}
            </div>

            {request.message && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13
                }}
              >
                {request.message}
              </div>
            )}

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 8
              }}
            >
              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  respondToIntroduction(
                    request.id,
                    "approve"
                  )
                }
                style={{
                  padding: "8px 14px",
                  cursor: isLoading
                    ? "not-allowed"
                    : "pointer",
                  opacity: isLoading ? 0.6 : 1
                }}
              >
                {isLoading
                  ? "Processing..."
                  : "Approve"}
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  respondToIntroduction(
                    request.id,
                    "decline"
                  )
                }
                style={{
                  padding: "8px 14px",
                  cursor: isLoading
                    ? "not-allowed"
                    : "pointer",
                  opacity: isLoading ? 0.6 : 1
                }}
              >
                {isLoading
                  ? "Processing..."
                  : "Decline"}
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}