export type GraphPerson = {
  id: string;
  name: string;
  company?: string | null;
  role?: string | null;
  skills?: string[];
  goals?: string | null;
  wants?: string | null;
  offers?: string | null;
  isDirectConversationPartner?: boolean;
};

export type GraphConnection = {
  from: string;
  to: string;
  strength?: number;
  reason?: string;
  source?:
    | "conversation"
    | "memory"
    | "relationship";
};

export type RelationshipMemory = {
  user_id: string;
  person_id: string;
  relationship_type?: string | null;
  relationship_strength: number;
  trust_score: number;
  interaction_count: number;
  last_interaction_at?: string | null;
  shared_context?: string[];
  shared_topics?: string[];
  successful_introductions: number;
  failed_introductions: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type OpportunityTarget = {
  id: string;
  title: string;
  company?: string | null;
  description?: string | null;
  skills?: string[];
  opportunity_type?: string | null;
  source?: string | null;
  source_url?: string | null;
  location?: string | null;
};
export type OpportunityLearningSignal = {
  user_id: string;
  opportunity_id: string;
  introduction_id: string;
  outcome_type: string;
  signal_weight: number;
  notes?: string | null;
  created_at?: string;
};

export type OpportunityPath = {
  opportunity: OpportunityTarget;
  score: number;
  reason: string;
  why?: string[];
  path: GraphPerson[];
  distance: number;
  bridge?: GraphPerson;
  personScore?: number;
  relationshipStrength?: number;
  userFit?: number;
};

/*
 * Normalize Twin/opportunity text into useful matching terms.
 *
 * The old tokenizer treated every word as a signal, which caused
 * explanations such as:
 *
 *   "ai, and, build, to, that"
 *
 * Common language words should not influence opportunity matching.
 * Keep technical terms such as ai, ml, sql, python, c++, c#, etc.
 */
const MATCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "can",
  "could",
  "do",
  "does",
  "doing",
  "for",
  "from",
  "get",
  "getting",
  "got",
  "has",
  "have",
  "having",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "so",
  "that",
  "the",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "us",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
  "build",
  "building",
  "looking",
  "look",
  "want",
  "wants",
  "need",
  "needs",
  "work",
  "working",
  "role",
  "roles",
  "job",
  "jobs",
  "opportunity",
  "opportunities"
]);

function tokenize(value: unknown): string[] {
  return [
    ...new Set(
      String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9+#.\s-]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(
          (token) =>
            token.length > 1 &&
            !MATCH_STOP_WORDS.has(token)
        )
    )
  ];
}

export function similarity(
  left: unknown,
  right: unknown
): number {
  const a = new Set(
    tokenize(left)
  );

  const b = new Set(
    tokenize(right)
  );

  if (!a.size || !b.size) {
    return 0;
  }

  let intersection = 0;

  for (const token of a) {
    if (b.has(token)) {
      intersection++;
    }
  }

  return Math.round(
    (2 * intersection /
      (a.size + b.size)) *
      100
  );
}

/*
 * Extract meaningful overlap between two pieces
 * of Twin context.
 */
function sharedTokens(
  left: unknown,
  right: unknown
): string[] {
  const leftTokens =
    tokenize(left);

  const rightTokens =
    new Set(
      tokenize(right)
    );

  return [
    ...new Set(
      leftTokens.filter(
        (token) =>
          rightTokens.has(token)
      )
    )
  ];
}

/*
 * Build a readable list of meaningful
 * Twin-to-Twin matches.
 */
function buildWantsOffersMatches(
  person: GraphPerson,
  opportunity: OpportunityTarget
): string[] {
  const opportunityText = [
    opportunity.title,
    opportunity.description ?? "",
    opportunity.company ?? "",
    ...(opportunity.skills ?? [])
  ].join(" ");

  const matches: string[] = [];

  /*
   * Person wants → opportunity
   */
  const wantMatches =
    sharedTokens(
      person.wants ?? "",
      opportunityText
    );

  if (wantMatches.length > 0) {
    matches.push(
      `Their wants align with this opportunity: ${wantMatches
        .slice(0, 5)
        .join(", ")}.`
    );
  }

  /*
   * Person offers → opportunity
   */
  const offerMatches =
    sharedTokens(
      person.offers ?? "",
      opportunityText
    );

  if (offerMatches.length > 0) {
    matches.push(
      `Their offers are relevant to this opportunity: ${offerMatches
        .slice(0, 5)
        .join(", ")}.`
    );
  }

  /*
   * Person skills → opportunity
   */
  const skillMatches =
    sharedTokens(
      (person.skills ?? []).join(" "),
      opportunityText
    );

  if (skillMatches.length > 0) {
    matches.push(
      `Relevant skills: ${skillMatches
        .slice(0, 5)
        .join(", ")}.`
    );
  }

  return matches;
}

/*
 * Calculate whether the person's Wants and Offers
 * create a meaningful opportunity signal.
 *
 * This is intentionally separate from the normal
 * personScore so the existing scoring model remains
 * stable.
 */
function calculateTwinOpportunitySignal(
  person: GraphPerson,
  opportunity: OpportunityTarget
): number {
  const opportunityText = [
    opportunity.title,
    opportunity.company ?? "",
    opportunity.description ?? "",
    ...(opportunity.skills ?? [])
  ].join(" ");

  const wantsScore =
    similarity(
      person.wants ?? "",
      opportunityText
    );

  const offersScore =
    similarity(
      person.offers ?? "",
      opportunityText
    );

  const skillsScore =
    similarity(
      (person.skills ?? []).join(" "),
      opportunityText
    );

  /*
   * Offers are slightly more important because
   * an opportunity needs someone who can actually
   * contribute something relevant.
   */
  return Math.round(
    offersScore * 0.45 +
      wantsScore * 0.25 +
      skillsScore * 0.30
  );
}

/*
 * Check whether one person's Wants are potentially
 * satisfied by another person's Offers.
 *
 * This is the foundation for real:
 *
 * You want X
 * Person offers X
 *
 * or:
 *
 * Person wants X
 * You offer X
 */
function calculateWantOfferCompatibility(
  first: GraphPerson,
  second: GraphPerson
): number {
  const firstWantsSecondOffers =
    similarity(
      first.wants ?? "",
      second.offers ?? ""
    );

  const secondWantsFirstOffers =
    similarity(
      second.wants ?? "",
      first.offers ?? ""
    );

  return Math.max(
    firstWantsSecondOffers,
    secondWantsFirstOffers
  );
}

function calculateDirectWantOfferTokens(
  firstWants: unknown,
  firstOffers: unknown,
  secondWants: unknown,
  secondOffers: unknown
): string[] {
  const firstWantsTokens = tokenize(firstWants);
  const firstOffersTokens = tokenize(firstOffers);
  const secondWantsTokens = tokenize(secondWants);
  const secondOffersTokens = tokenize(secondOffers);

  const secondOffersSet = new Set(secondOffersTokens);
  const secondWantsSet = new Set(secondWantsTokens);

  const firstWantsToSecondOffers =
    firstWantsTokens.filter((token) =>
      secondOffersSet.has(token)
    );

  const firstOffersToSecondWants =
    firstOffersTokens.filter((token) =>
      secondWantsSet.has(token)
    );

  return [
    ...new Set([
      ...firstWantsToSecondOffers,
      ...firstOffersToSecondWants
    ])
  ].slice(0, 8);
}

export function buildGraph(
  connections: GraphConnection[]
): Map<string, Set<string>> {
  const graph =
    new Map<
      string,
      Set<string>
    >();

  for (const edge of connections) {
    if (
      !edge.from ||
      !edge.to ||
      edge.from === edge.to
    ) {
      continue;
    }

    if (
      !graph.has(edge.from)
    ) {
      graph.set(
        edge.from,
        new Set()
      );
    }

    if (
      !graph.has(edge.to)
    ) {
      graph.set(
        edge.to,
        new Set()
      );
    }

    graph
      .get(edge.from)!
      .add(edge.to);

    graph
      .get(edge.to)!
      .add(edge.from);
  }

  return graph;
}

export function findPath(
  graph: Map<string, Set<string>>,
  start: string,
  target: string
): string[] {
  if (
    !start ||
    !target
  ) {
    return [];
  }

  if (
    start === target
  ) {
    return [start];
  }

  const queue: string[][] = [
    [start]
  ];

  const visited =
    new Set([start]);

  while (queue.length) {
    const currentPath =
      queue.shift()!;

    const current =
      currentPath[
        currentPath.length - 1
      ];

    for (
      const next of
        graph.get(current) ??
        []
    ) {
      if (
        visited.has(next)
      ) {
        continue;
      }

      const nextPath = [
        ...currentPath,
        next
      ];

      if (
        next === target
      ) {
        return nextPath;
      }

      visited.add(next);

      queue.push(
        nextPath
      );
    }
  }

  return [];
}

export function findOpportunityPaths({
  userId,
  userGoals,
  opportunities,
  people,
  connections,
  userWants,
  userOffers,
  learningSignals,
  relationshipMemory
}: {
  userId: string;
  userGoals: string;
  opportunities: OpportunityTarget[];
  people: GraphPerson[];
  connections: GraphConnection[];
  userWants?: string | null;
  userOffers?: string | null;
  learningSignals?: OpportunityLearningSignal[];
  relationshipMemory?: RelationshipMemory[];
}): OpportunityPath[] {
  const peopleById =
    new Map<
      string,
      GraphPerson
    >();

  for (
    const person of people
  ) {
    peopleById.set(
      person.id,
      person
    );
  }

  const relationshipMemoryByPersonId =
  new Map<string, RelationshipMemory>();

for (const memory of relationshipMemory ?? []) {
  if (
    memory.user_id === userId &&
    memory.person_id &&
    memory.person_id !== userId
  ) {
    relationshipMemoryByPersonId.set(
      memory.person_id,
      memory
    );
  }
}

/*
 * Merge real relationship memory into the graph.
 *
 * Conversations remain the primary graph source.
 * Relationship memory adds historical relationships that
 * may not be represented by the current conversation data.
 *
 * We keep both directions because the graph is undirected.
 */
const relationshipMemoryConnections: GraphConnection[] =
  (relationshipMemory ?? [])
    .filter(
      (memory) =>
        Boolean(memory.user_id) &&
        Boolean(memory.person_id) &&
        memory.user_id !== memory.person_id
    )
    .map((memory) => ({
      from: memory.user_id,
      to: memory.person_id,
      strength: Number(
        memory.relationship_strength ?? 0
      ),
      reason:
        memory.relationship_type ??
        "relationship memory",
      source: "relationship"
    }));

const graph =
  buildGraph([
    ...connections,
    ...relationshipMemoryConnections
  ]);

const currentUser =
  peopleById.get(
    userId
  );

for (const memory of relationshipMemory ?? []) {
  if (
    memory.user_id === userId &&
    memory.person_id &&
    memory.person_id !== userId
  ) {
    relationshipMemoryByPersonId.set(
      memory.person_id,
      memory
    );
  }
}
  const candidateWantOfferTokens =
    new Map<string, string[]>();

  return opportunities
    .map(
      (opportunity): OpportunityPath | undefined => {
      const opportunityText = [
        opportunity.title,
        opportunity.company ?? "",
        opportunity.description ?? "",
        ...(opportunity.skills ?? [])
      ].join(" ");

      /*
       * -------------------------------------------------------
       * USER → OPPORTUNITY FIT
       * -------------------------------------------------------
       */

      const userFit =
        similarity(
          userGoals,
          opportunityText
        );

      let bestPerson:
        | GraphPerson
        | undefined;

      let bestPersonScore =
        -1;

      let bestPath: string[] =
        [];

      let bestRelationshipStrength =
        0;

      let bestHasDirectConnection =
        false;

      let bestHasWarmPath =
        false;

      let bestTwinSignal =
        0;

      let bestWantOfferCompatibility =
        0;

      /*
       * -------------------------------------------------------
       * PERSON SEARCH
       * -------------------------------------------------------
       *
       * A missing warm path must not automatically eliminate
       * a useful person. We score the person first, then use
       * relationship strength as an additional trust signal.
       *
       * This gives us:
       *
       *   Twin relevance
       *       +
       *   Wants ↔ Offers
       *       +
       *   warm path (when available)
       *
       * without inventing a relationship that does not exist.
       */

      for (
        const person of people
      ) {
        if (
          !userId ||
          person.id === userId
        ) {
          continue;
        }

        const path =
          findPath(
            graph,
            userId,
            person.id
          );
          const memory =
  relationshipMemoryByPersonId.get(
    person.id
  );

        const personText = [
          person.name,
          person.company ?? "",
          person.role ?? "",
          person.goals ?? "",
          person.wants ?? "",
          person.offers ?? "",
          ...(person.skills ?? [])
        ].join(" ");

        const basePersonScore =
          similarity(
            personText,
            opportunityText
          );

        /*
         * Real Twin signal.
         */
        const twinOpportunitySignal =
          calculateTwinOpportunitySignal(
            person,
            opportunity
          );

        /*
         * User → person Wants ↔ Offers compatibility.
         *
         * Prefer the explicitly supplied userWants/userOffers,
         * but fall back to the current user's GraphPerson so
         * existing callers remain safe.
         */
        const graphUser =
          currentUser;

        const effectiveUserWants =
          userWants ??
          graphUser?.wants ??
          "";

        const effectiveUserOffers =
          userOffers ??
          graphUser?.offers ??
          "";

        const wantOfferCompatibility =
          graphUser
            ? calculateWantOfferCompatibility(
                {
                  ...graphUser,
                  wants:
                    effectiveUserWants,
                  offers:
                    effectiveUserOffers
                },
                person
              )
            : 0;

        /*
         * Actual token-level complementarity gives us
         * explainable evidence later in "Why this?".
         */
        const directWantOfferTokens =
          calculateDirectWantOfferTokens(
            effectiveUserWants,
            effectiveUserOffers,
            person.wants ?? "",
            person.offers ?? ""
          );

        /*
         * A person can be useful even without a warm path.
         * Keep the path empty in that case — never fabricate one.
         */
        const hasWarmPath =
          path.length >= 3;

        const hasDirectConnection =
          path.length === 2;

        const pathEdges =
          path
            .slice(0, -1)
            .map(
              (
                from,
                index
              ) => ({
                from,
                to: path[
                  index + 1
                ]
              })
            );

        const edgeStrengths =
          pathEdges.map(
            ({ from, to }) => {
              const edge =
                connections.find(
                  (
                    connection
                  ) =>
                    (connection.from ===
                      from &&
                      connection.to ===
                        to) ||
                    (connection.from ===
                      to &&
                      connection.to ===
                        from)
                );

              return (
                edge?.strength ??
                50
              );
            }
          );

        /*
 * Persistent relationship memory is the strongest source
 * when it exists because it represents actual historical
 * interaction between this user and this person.
 *
 * Graph edge strength remains the fallback for relationships
 * that have not yet been persisted in relationship_memory.
 */
const graphRelationshipStrength =
  edgeStrengths.length > 0
    ? Math.round(
        edgeStrengths.reduce(
          (sum, value) => sum + value,
          0
        ) / edgeStrengths.length
      )
    : 0;

const relationshipStrength =
  memory
    ? Math.max(
        0,
        Math.min(
          100,
          Number(
            memory.relationship_strength ?? 0
          )
        )
      )
    : graphRelationshipStrength;

const relationshipTrust =
  memory
    ? Math.max(
        0,
        Math.min(
          100,
          Number(
            memory.trust_score ?? 0
          )
        )
      )
    : relationshipStrength;
        /*
         * Preserve the existing scoring philosophy while allowing
         * Twin compatibility to work without a relationship.
         *
         * Warm path:
         *   person relevance + Twin signal + Wants/Offers + relationship
         *
         * No warm path:
         *   person relevance + Twin signal + Wants/Offers
         *
         * Relationship is therefore a bonus/trust signal, not a
         * prerequisite for discovering the opportunity.
         */
        const candidate =
  basePersonScore *
    0.43 +
  twinOpportunitySignal *
    0.24 +
  wantOfferCompatibility *
    0.18 +
  relationshipStrength *
    0.10 +
  relationshipTrust *
    0.05;
            /*
 * -------------------------------------------------------
 * OUTCOME → TWIN LEARNING
 * -------------------------------------------------------
 *
 * Previous opportunity outcomes provide a small learning
 * signal for future matching.
 *
 * This does NOT replace the existing graph score.
 * It only nudges the score based on real outcomes.
 */
const opportunityLearningScore =
  (learningSignals ?? [])
    .filter(
      (signal) =>
        signal.user_id === userId &&
        signal.opportunity_id === opportunity.id
    )
    .reduce(
      (total, signal) =>
        total +
        Number(signal.signal_weight ?? 0),
      0
    );

const boundedLearningScore =
  Math.max(
    -10,
    Math.min(
      10,
      opportunityLearningScore
    )
  );

        const warmPathBonus =
          hasWarmPath
            ? 15
            : 0;

        const rankedCandidate =
  candidate +
  warmPathBonus +
  boundedLearningScore;

        const currentWarmPathBonus =
  bestHasWarmPath
    ? 15
    : 0;

const current =
  bestPerson
    ? (
        bestPersonScore *
          0.45 +
        bestTwinSignal *
          0.25 +
        bestWantOfferCompatibility *
          0.20 +
        bestRelationshipStrength *
          0.10 +
        currentWarmPathBonus +
        boundedLearningScore
      )
    : -Infinity;

if (
  rankedCandidate >
  current
) {
  bestPerson =
    person;

  bestPersonScore =
    basePersonScore;

  bestPath =
    path;

  bestRelationshipStrength =
    relationshipStrength;

  bestHasDirectConnection =
    hasDirectConnection;

  bestHasWarmPath =
    hasWarmPath;

  bestTwinSignal =
    twinOpportunitySignal;

  bestWantOfferCompatibility =
    wantOfferCompatibility;

  /*
   * Keep this locally available for the explanation
   * generated below by attaching it to a temporary map.
   */
  candidateWantOfferTokens.set(
    person.id,
    directWantOfferTokens
  );
}

      }
      /*
       * -------------------------------------------------------
       * PATH → PEOPLE
       * -------------------------------------------------------
       */

      const pathPeople =
        bestPath
          .map((id) =>
            id === userId
              ? {
                  id,
                  name: "You"
                }
              : peopleById.get(
                  id
                )
          )
          .filter(
            (
              person
            ): person is GraphPerson =>
              Boolean(person)
          );

      /*
       * -------------------------------------------------------
       * WHY THIS?
       * -------------------------------------------------------
       */

      const why: string[] =
        [];

      if (
        bestPerson
      ) {
        /*
         * 1. Relationship evidence
         */
        if (
          bestPath.length ===
          2
        ) {
          why.push(
            `${bestPerson.name} is directly connected to you.`
          );
        } else if (
          bestPath.length >
          2
        ) {
          const mutualConnections =
            bestPath.length -
            2;

          why.push(
            `${bestPerson.name} is reachable through ${mutualConnections} mutual connection${
              mutualConnections ===
              1
                ? ""
                : "s"
            }.`
          );
        }

        /*
         * 2. Relationship strength
         */
        if (
          bestRelationshipStrength >=
          80
        ) {
          why.push(
            `Strong relationship signal (${bestRelationshipStrength}%).`
          );
        } else if (
          bestRelationshipStrength >=
          60
        ) {
          why.push(
            `Good relationship signal (${bestRelationshipStrength}%).`
          );
        } else {
          why.push(
            `Existing relationship signal (${bestRelationshipStrength}%).`
          );
        }

        /*
         * 3. Shared skills
         */
        const opportunitySkills =
          new Set(
            tokenize(
              opportunity.skills?.join(
                " "
              ) ?? ""
            )
          );

        const personSkills =
          tokenize(
            bestPerson.skills?.join(
              " "
            ) ?? ""
          );

        const sharedSkills =
          personSkills.filter(
            (skill) =>
              opportunitySkills.has(
                skill
              )
          );

        if (
          sharedSkills.length >
          0
        ) {
          why.push(
            `Shared skills: ${sharedSkills
              .slice(0, 5)
              .join(", ")}.`
          );
        }

        /*
         * 4. Professional overlap
         */
        if (
          bestPerson.role
        ) {
          why.push(
            `Their role is ${bestPerson.role}.`
          );
        }

        if (
          bestPerson.company
        ) {
          why.push(
            `They are associated with ${bestPerson.company}.`
          );
        }

        /*
         * 5. Twin Wants / Offers evidence
         */
        const twinMatches =
          buildWantsOffersMatches(
            bestPerson,
            opportunity
          );

        why.push(
          ...twinMatches
        );

        /*
         * 6. Wants ↔ Offers compatibility
         */
        const directWantOfferTokens =
          candidateWantOfferTokens.get(
            bestPerson.id
          ) ?? [];

        if (
          directWantOfferTokens.length >
          0
        ) {
          why.push(
            `Meaningful Wants ↔ Offers overlap: ${directWantOfferTokens
              .slice(0, 5)
              .join(", ")}.`
          );
        } else if (
          bestWantOfferCompatibility > 0
        ) {
          why.push(
            `There is measurable Wants ↔ Offers compatibility (${bestWantOfferCompatibility}%).`
          );
        }

        if (
          bestWantOfferCompatibility >=
          60
        ) {
          why.push(
            `Strong Wants ↔ Offers compatibility (${bestWantOfferCompatibility}%).`
          );
        } else if (
          bestWantOfferCompatibility >=
          30
        ) {
          why.push(
            `Some Wants ↔ Offers compatibility (${bestWantOfferCompatibility}%).`
          );
        }

        /*
         * 7. Goal / context overlap
         */
        const opportunityContext =
          tokenize(
            [
              opportunity.title,
              opportunity.description ??
                "",
              ...(opportunity.skills ??
                [])
            ].join(" ")
          );

        const personContext =
          tokenize(
            [
              bestPerson.role ??
                "",
              bestPerson.goals ??
                "",
              bestPerson.wants ??
                "",
              bestPerson.offers ??
                "",
              ...(bestPerson.skills ??
                [])
            ].join(" ")
          );

        const sharedContext =
          personContext.filter(
            (token) =>
              opportunityContext.includes(
                token
              )
          );

        if (
          sharedContext.length >
          0
        ) {
          why.push(
            `Relevant context overlap: ${sharedContext
              .slice(0, 5)
              .join(", ")}.`
          );
        }

        /*
         * 8. Person → opportunity fit
         */
        if (
          bestPersonScore >=
          70
        ) {
          why.push(
            `Strong person-to-opportunity fit (${bestPersonScore}%).`
          );
        } else if (
          bestPersonScore >=
          40
        ) {
          why.push(
            `Moderate person-to-opportunity fit (${bestPersonScore}%).`
          );
        } else if (
          bestPersonScore >=
          20
        ) {
          why.push(
            `Some relevant person-to-opportunity overlap (${bestPersonScore}%).`
          );
        }

        /*
         * 9. Twin signal
         */
        if (
          bestTwinSignal >=
          60
        ) {
          why.push(
            `Their Twin context strongly matches the opportunity (${bestTwinSignal}%).`
          );
        } else if (
          bestTwinSignal >=
          30
        ) {
          why.push(
            `Their Twin context has relevant opportunity signals (${bestTwinSignal}%).`
          );
        }

        /*
         * 10. Explain why this person was selected
         */
        if (
          bestPersonScore >=
            50 &&
          bestRelationshipStrength >=
            60
        ) {
          why.push(
            `${bestPerson.name} combines relevant opportunity context with a meaningful relationship path.`
          );
        } else if (
          bestPersonScore >=
          50
        ) {
          why.push(
            `${bestPerson.name} has the strongest opportunity relevance among the reachable people.`
          );
        } else if (
          bestRelationshipStrength >=
          60
        ) {
          why.push(
            `${bestPerson.name} has one of the strongest available relationship paths for this opportunity.`
          );
        }
      }

      /*
       * -------------------------------------------------------
       * WARM PATH
       * -------------------------------------------------------
       */

      const selectedHasWarmPath =
  Boolean(
    bestPerson &&
      bestHasWarmPath &&
      bestPath.length >= 3
  );

      /*
       * -------------------------------------------------------
       * OPPORTUNITY SCORE
       * -------------------------------------------------------
       *
       * Existing model:
       *
       * 50% Twin → opportunity
       * 30% person → opportunity
       * 20% relationship
       *
       * We add a small Twin/network compatibility
       * signal without destroying the existing model.
       */

      const score =
        bestPerson
          ? Math.min(
              99,
              Math.round(
                userFit *
                  0.40 +
                  bestPersonScore *
                    0.25 +
                  bestTwinSignal *
                    0.15 +
                  bestWantOfferCompatibility *
                    0.10 +
                  bestRelationshipStrength *
                    0.10
              )
            )
          : Math.min(
              99,
              Math.round(
                userFit
              )
            );

      /*
       * -------------------------------------------------------
       * HUMAN-READABLE REASON
       * -------------------------------------------------------
       *
       * Build the short card explanation from evidence already
       * calculated above. Do not invent missing profile data.
       */
      let reason =
        "This opportunity aligns with your Twin goals, but no verified warm path has been identified yet.";

      if (bestPerson) {
        const evidence: string[] = [];

        if (
          bestHasWarmPath &&
          bestPath.length >= 3
        ) {
          const mutualConnections =
            bestPath.length - 2;

          evidence.push(
            `reachable through ${mutualConnections} verified mutual connection${
              mutualConnections === 1
                ? ""
                : "s"
            }`
          );
        } else if (
          bestHasDirectConnection
        ) {
          evidence.push(
            "directly connected to you"
          );
        }

        if (
          bestRelationshipStrength > 0
        ) {
          evidence.push(
            `relationship strength ${bestRelationshipStrength}%`
          );
        }

        if (
          bestWantOfferCompatibility > 0
        ) {
          evidence.push(
            `Wants ↔ Offers compatibility ${bestWantOfferCompatibility}%`
          );
        }

        if (
          bestPersonScore > 0
        ) {
          evidence.push(
            `person-to-opportunity fit ${bestPersonScore}%`
          );
        }

        if (
          bestTwinSignal > 0
        ) {
          evidence.push(
            `Twin opportunity signal ${bestTwinSignal}%`
          );
        }

        const headlineEvidence =
          evidence.slice(0, 4);

        reason =
          headlineEvidence.length > 0
            ? `${bestPerson.name} was selected because ${headlineEvidence.join(
                "; "
              )}.`
            : `${bestPerson.name} has relevant professional context for this opportunity.`;
      }

      /*
       * Remove duplicate why statements while preserving
       * their original order.
       */
      const uniqueWhy =
        [
          ...new Set(
            why.filter(Boolean)
          )
        ].slice(0, 8);

    return {
        opportunity,
        score,
        reason,
        why: uniqueWhy,
        path: pathPeople,
        distance:
          pathPeople.length > 1
            ? pathPeople.length - 1
            : 0,
        bridge:
          pathPeople.length > 2
            ? pathPeople[1]
            : undefined,
        personScore:
          bestPersonScore >= 0
            ? bestPersonScore
            : undefined,
        relationshipStrength:
          selectedHasWarmPath
            ? bestRelationshipStrength
            : undefined,
        userFit
      };
    })
    .filter(
      (result): result is OpportunityPath =>
        result !== undefined
    )
    .sort(
      (a, b) =>
        b.score - a.score
    );
}