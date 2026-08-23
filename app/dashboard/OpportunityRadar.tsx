"use client";

import { useState } from "react";

type OpportunityPath = {
  opportunity: {
    id: string;
    title: string;
    company?: string | null;
  };
  score: number;
  reason: string;
  path: Array<{
    id: string;
    name: string;
  }>;
  distance: number;
};

export function OpportunityRadar({
  onResults
}: {
  onResults: (
    results: OpportunityPath[]
  ) => void;
}) {
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (intent.trim()) {
        params.set("intent", intent.trim());
      }

      const response = await fetch(
        `/api/opportunities?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to search opportunities."
        );
      }

      onResults(
        Array.isArray(data?.opportunities)
          ? data.opportunities
          : []
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Something went wrong while searching."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="retro-panel"
      style={{
        marginTop: 24,
        padding: 20
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--amber-bright)"
        }}
      >
        Opportunity Radar
      </div>

      <h2
        style={{
          marginTop: 8,
          fontSize: 22
        }}
      >
        What are you trying to reach?
      </h2>

      <p
        style={{
          marginTop: 8,
          color: "var(--text-dim)",
          lineHeight: 1.5
        }}
      >
        Tell your Twin what you want. It will combine
        your intent with your existing context.
      </p>

      <input
        value={intent}
        onChange={(event) =>
          setIntent(event.target.value)
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            search();
          }
        }}
        placeholder="e.g. Find a Data Analyst role at an AI company"
        style={{
          width: "100%",
          marginTop: 16,
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--panel-solid)",
          color: "inherit",
          outline: "none"
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 12
        }}
      >
        {[
          "Find a Data Analyst role",
          "Find AI investors",
          "Find a technical cofounder",
          "Find customers for my product",
          "Find mentors"
        ].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setIntent(suggestion)}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "7px 11px",
              background: "transparent",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontSize: 12
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={search}
        disabled={loading}
        style={{
          marginTop: 16,
          border: 0,
          borderRadius: 10,
          padding: "11px 16px",
          fontWeight: 800,
          cursor: loading
            ? "not-allowed"
            : "pointer"
        }}
      >
        {loading
          ? "Scanning..."
          : "Find opportunities"}
      </button>

      {error && (
        <div
          style={{
            marginTop: 12,
            color: "var(--red)",
            fontSize: 13
          }}
        >
          {error}
        </div>
      )}
    </section>
  );
}