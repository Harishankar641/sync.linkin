"use client";

import { useState } from "react";
function formatOpportunityType(
  type?: string | null
): string {
  switch (type) {
    case "technical_collaboration":
      return "Technical Collaboration";

    default:
      return (
        type
          ?.replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()) ??
        "Opportunity"
      );
  }
}

type OpportunityPerson = {
  id: string;
  name: string;
  company?: string | null;
};

type Opportunity = {
  id: string;
  opportunity_type?: string | null;
  title: string;
  company?: string | null;
  description?: string | null;
  skills?: string[];
};

type OpportunityPath = {
  opportunity: Opportunity;

  score: number;

  reason: string;

  why?: string[];

  path: OpportunityPerson[];

  distance: number;

  bridge?: OpportunityPerson;

  relationshipStrength?: number;

  personScore?: number;

  warmPath?: boolean;
};

export function OpportunityGraph({
  opportunities
}: {
  opportunities: OpportunityPath[];
}) {
  const [
    selectedOpportunity,
    setSelectedOpportunity
  ] = useState<string | null>(null);

  const [
    actionMessage,
    setActionMessage
  ] = useState<string | null>(null);

  const [
    loadingId,
    setLoadingId
  ] = useState<string | null>(null);

  /*
   * Tracks opportunities that have been
   * successfully saved during this session.
   *
   * The actual persistence is still handled
   * by /api/opportunities/[id]/action.
   */
  const [
    savedOpportunities,
    setSavedOpportunities
  ] = useState<Set<string>>(
    () => new Set()
  );

  const [
    introductionStates,
    setIntroductionStates
  ] = useState<
    Record<
      string,
      {
        status: "requested";
        connectorName?: string;
      }
    >
  >({});

  async function saveOpportunity(
    opportunityId: string
  ) {
    setLoadingId(
      opportunityId
    );

    setActionMessage(null);

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
              action: "saved"
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Unable to save opportunity"
        );
      }

      /*
       * Only mark the opportunity as saved
       * after the API confirms success.
       */
      setSavedOpportunities((current) => {
        const next = new Set(current);

        next.add(opportunityId);

        return next;
      });

      setActionMessage(
        "Opportunity saved."
      );
    } catch (error) {
      setActionMessage(
        error instanceof Error
          ? error.message
          : "Unable to save opportunity."
      );
    } finally {
      setLoadingId(null);
    }
  }

  async function requestIntroduction(
    opportunity: OpportunityPath
  ) {
    if (
      opportunity.path.length <
      3
    ) {
      setActionMessage(
        "A multi-person warm path is required before requesting an introduction."
      );
      return;
    }

    const connector =
      opportunity.path[1];

    const target =
      opportunity.path[
        opportunity.path.length - 1
      ];

    if (
      !connector?.id ||
      !target?.id
    ) {
      setActionMessage(
        "The warm path is missing a connector or target."
      );
      return;
    }

    setLoadingId(
      opportunity.opportunity.id
    );
    setActionMessage(null);

    try {
  const response =
    await fetch(
      "/api/introductions/request",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          opportunity_id:
            opportunity.opportunity.id,

          connector_id:
            connector.id,

          target_id:
            target.id,

          message:
            `I'd like to explore the ${opportunity.opportunity.title.toLowerCase()} opportunity.`
        })
      }
    );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Unable to request introduction"
        );
      }

      setIntroductionStates(
        (current) => ({
          ...current,
          [opportunity.opportunity.id]:
            {
              status:
                "requested",
              connectorName:
                connector.name
            }
        })
      );

      setActionMessage(
        `Introduction requested from ${connector.name}. Waiting for their approval.`
      );
    } catch (error) {
      setActionMessage(
        error instanceof Error
          ? error.message
          : "Unable to request introduction."
      );
    } finally {
      setLoadingId(null);
    }
  }

  if (
    !opportunities ||
    opportunities.length === 0
  ) {
    return (
      <section
        style={{
          marginTop: 30
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing:
              "0.14em",
            textTransform:
              "uppercase",
            color:
              "var(--amber-bright)",
            marginBottom: 12
          }}
        >
          Opportunities within reach
        </div>

        <div
          className="retro-panel"
          style={{
            padding: 18,
            fontSize: 13,
            lineHeight: 1.6
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              marginBottom: 8
            }}
          >
            No opportunities yet
          </div>

          <div
            style={{
              color:
                "var(--text-dim)"
            }}
          >
            Your Twin does not have
            enough opportunity context
            yet.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        marginTop: 30
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing:
            "0.14em",
          textTransform:
            "uppercase",
          color:
            "var(--amber-bright)",
          marginBottom: 12
        }}
      >
        Opportunities within reach
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14
        }}
      >
        {opportunities
          .slice(0, 6)
          .map((path) => {
            const opportunity =
              path.opportunity;

            const isSelected =
              selectedOpportunity ===
              opportunity.id;

            const isSaved =
              savedOpportunities.has(
                opportunity.id
              );

            const introductionState =
              introductionStates[
                opportunity.id
              ];

            const hasWarmPath =
  path.path.length >= 3;

            const connector =
              path.path.length >=
              2
                ? path.path[1]
                : undefined;

            const target =
              path.path.length >=
              2
                ? path.path[
                    path.path.length - 1
                  ]
                : undefined;

            return (
              <div
                key={
                  opportunity.id
                }
                className="retro-panel"
                style={{
                  padding: 18
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing:
                      "0.1em",
                    textTransform:
                      "uppercase",
                    color:
                      "var(--text-dim)"
                  }}
                >
                  {formatOpportunityType(
  opportunity.opportunity_type
)}
                </div>

                <div
                  style={{
                    marginTop: 7,
                    fontSize: 18,
                    fontWeight: 850
                  }}
                >
                  {opportunity.title}
                </div>

                {opportunity.company && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color:
                        "var(--text-dim)"
                    }}
                  >
                    {opportunity.company}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 14,
                    color:
                      "var(--green)",
                    fontWeight: 800
                  }}
                >
                  {path.score}%
                  {" "}
                  opportunity fit
                </div>

                <p
                  style={{
                    marginTop: 10,
                    fontSize: 13,
                    color:
                      "var(--text-dim)",
                    lineHeight: 1.5
                  }}
                >
                  {path.reason}
                </p>

                {opportunity.skills &&
                  opportunity.skills.length >
                    0 && (
                    <div
                      style={{
                        display:
                          "flex",
                        flexWrap:
                          "wrap",
                        gap: 6,
                        marginTop: 10
                      }}
                    >
                      {opportunity.skills
                        .slice(0, 5)
                        .map(
                          (
                            skill
                          ) => (
                            <span
                              key={
                                skill
                              }
                              style={{
                                padding:
                                  "4px 7px",
                                border:
                                  "1px solid var(--border)",
                                borderRadius:
                                  999,
                                fontSize:
                                  11,
                                color:
                                  "var(--text-dim)"
                              }}
                            >
                              {skill}
                            </span>
                          )
                        )}
                    </div>
                  )}

                {hasWarmPath ? (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 11,
                      borderRadius: 10,
                      background:
                        "var(--panel-solid)",
                      border:
                        "1px solid var(--border)"
                    }}
                  >
                    <strong>
                      Potential path:
                    </strong>

                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 13
                      }}
                    >
                      {path.path.map(
                        (
                          person,
                          index
                        ) => (
                          <span
                            key={
                              person.id
                            }
                          >
                            {index >
                              0 &&
                              " → "}
                            {
                              person.name
                            }
                          </span>
                        )
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color:
                          "var(--text-dim)"
                      }}
                    >
                      {
                        path.distance
                      }{" "}
                      connection
                      {path.distance ===
                      1
                        ? ""
                        : "s"}{" "}
                      away
                    </div>

                    {connector && (
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 12
                        }}
                      >
                        <strong>
                          Connector:
                        </strong>{" "}
                        {
                          connector.name
                        }
                      </div>
                    )}

                    {target && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12
                        }}
                      >
                        <strong>
                          Potential target:
                        </strong>{" "}
                        {
                          target.name
                        }
                      </div>
                    )}

                    {typeof path.relationshipStrength ===
                      "number" && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color:
                            "var(--text-dim)"
                        }}
                      >
                        Relationship
                        strength:{" "}
                        {
                          path.relationshipStrength
                        }%
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 11,
                      borderRadius: 10,
                      background:
                        "var(--panel-solid)",
                      border:
                        "1px solid var(--border)"
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700
                      }}
                    >
                      No verified warm
                      path yet
                    </div>

                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 12,
                        color:
                          "var(--text-dim)",
                        lineHeight: 1.5
                      }}
                    >
                      This opportunity
                      matches your Twin,
                      but the current
                      network does not
                      contain a verified
                      multi-person path.
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display:
                      "flex",
                    gap: 8,
                    marginTop: 14
                  }}
                >
                  <button
                    type="button"
                    className="retro-btn"
                    onClick={() =>
                      setSelectedOpportunity(
                        isSelected
                          ? null
                          : opportunity.id
                      )
                    }
                    style={{
                      flex: 1,
                      fontSize: 12
                    }}
                  >
                    {isSelected
                      ? "Hide details"
                      : "Why this?"}
                  </button>

                  <button
                    type="button"
                    className="retro-btn"
                    disabled={
                      loadingId ===
                      opportunity.id
                    }
                    onClick={() =>
                      saveOpportunity(
                        opportunity.id
                      )
                    }
                    style={{
                      flex: 1,
                      fontSize: 12
                    }}
                  >
                    {loadingId ===
                    opportunity.id
                      ? "Saving..."
                      : isSaved
                        ? "Saved ✓"
                        : "Save"}
                  </button>
                </div>

                {isSelected && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: 10,
                      border:
                        "1px solid var(--border)",
                      background:
                        "var(--panel-solid)"
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800
                      }}
                    >
                      Why this
                      opportunity?
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        lineHeight: 1.6,
                        color:
                          "var(--text-dim)"
                      }}
                    >
                      <div>
                        Twin fit:{" "}
                        <strong>
                          {
                            path.score
                          }%
                        </strong>
                      </div>

                      {typeof path.personScore ===
                        "number" &&
                        path.personScore >
                          0 && (
                          <div>
                            Person
                            relevance:{" "}
                            <strong>
                              {
                                path.personScore
                              }%
                            </strong>
                          </div>
                        )}

                      {typeof path.relationshipStrength ===
                        "number" &&
                        path.relationshipStrength >
                          0 && (
                          <div>
                            Relationship
                            strength:{" "}
                            <strong>
                              {
                                path.relationshipStrength
                              }%
                            </strong>
                          </div>
                        )}

                      <div
                        style={{
                          marginTop: 10,
                          fontWeight: 700,
                          color:
                            "var(--text)"
                        }}
                      >
                        Why this person?
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          lineHeight: 1.6
                        }}
                      >
                        {path.reason}
                      </div>

                      {path.why &&
                        path.why.length >
                          0 && (
                          <div
                            style={{
                              marginTop: 10,
                              display: "grid",
                              gap: 6
                            }}
                          >
                            {path.why
                              .slice(0, 7)
                              .map(
                                (
                                  item,
                                  index
                                ) => (
                                  <div
                                    key={`${opportunity.id}-why-${index}`}
                                    style={{
                                      display:
                                        "flex",
                                      gap: 7,
                                      alignItems:
                                        "flex-start"
                                    }}
                                  >
                                    <span
                                      aria-hidden="true"
                                      style={{
                                        fontWeight:
                                          900,
                                        color:
                                          "var(--green)"
                                      }}
                                    >
                                      ✓
                                    </span>
                                    <span>
                                      {item}
                                    </span>
                                  </div>
                                )
                              )}
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {hasWarmPath && (
                  <div
                    style={{
                      marginTop: 10
                    }}
                  >
                    {introductionState?.status ===
                    "requested" ? (
                      <div
                        className="retro-panel"
                        style={{
                          padding: 11,
                          fontSize: 12,
                          lineHeight: 1.5,
                          border:
                            "1px solid var(--border)"
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800
                          }}
                        >
                          Introduction requested
                        </div>

                        <div
                          style={{
                            marginTop: 4,
                            color:
                              "var(--text-dim)"
                          }}
                        >
                          Waiting for{" "}
                          <strong>
                            {
                              introductionState.connectorName ??
                              connector?.name ??
                              "the connector"
                            }
                          </strong>{" "}
                          to approve the introduction.
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="retro-btn retro-btn-primary"
                        disabled={
                          loadingId ===
                          opportunity.id
                        }
                        onClick={() =>
                          requestIntroduction(
                            path
                          )
                        }
                        style={{
                          width:
                            "100%",
                          fontSize: 12
                        }}
                      >
                        {loadingId ===
                        opportunity.id
                          ? "Requesting..."
                          : "Request introduction "}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {actionMessage && (
        <div
          className="retro-panel"
          style={{
            marginTop: 12,
            padding: 12,
            fontSize: 13
          }}
        >
          {actionMessage}
        </div>
      )}
    </section>
  );
}