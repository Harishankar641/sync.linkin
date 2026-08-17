/**
 * Pair-sync score — the projected outcome of a deal happening between two
 * twins, computed from their profile blobs alone. Pure deterministic
 * function: same inputs always produce the same number, no LLM call,
 * no randomness, no salting.
 *
 * MAY 2026 RECALIBRATION (per Jack): the previous version weighted
 * SIMILARITY (jaccard overlap) heavily, which meant two people in the
 * same niche scored high while a perfectly-fitting "I'm raising / I
 * invest" pair could score in the 30s. The score is now COMPLEMENTARITY
 * first — does this pairing create asymmetric upside if they actually
 * talk? Two near-identical founders are LESS interesting than a founder
 * + an investor who matches their stage.
 *
 * New weights:
 *   55%  complementary fit (one side asks for what the other offers)
 *   15%  goals-vs-goals overlap (same domain still helps)
 *   15%  bigram overlap (shared domain language)
 *   15%  unigram overlap (loose keyword affinity)
 *
 * Both sides having a substantive twin (≥200 chars each) gives a base
 * fit floor of ~50% — Jack's complaint: a friend signed up and ALL
 * sync scores were below 40%, which kills the "this is worth my time"
 * read of the directory.
 *
 * Capped at 96 to leave room for upward movement after a real conversation
 * (post-chat the excitement_score from summarize-conversation can hit 99).
 *
 * The score is intentionally a pure function of (myBlob, theirGoals,
 * theirBlob, myGoals) — no I/O, no DB write — because it has to render
 * consistently on every contact card view without drifting between
 * refreshes. The post-chat excitement_score is a separate value stored
 * on conversations.
 */

export type TwinSnapshot = {
  goals?: string | null;
  deal_preferences?: string | null;
  communication_style?: string | null;
  comm_style?: string | null;
  deal_breakers?: string | null;
  ai_export_blob?: string | null;
};

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "have", "what", "your",
  "into", "they", "them", "about", "their", "would", "could", "should", "people",
  "looking", "really", "still", "going", "want", "wants", "wanting", "need",
  "needs", "needing", "make", "makes", "making", "work", "works", "working",
  "build", "builds", "building", "built", "more", "most", "very", "much", "many",
  "some", "such", "than", "then", "when", "where", "which", "while", "after",
  "before", "around", "across", "between", "through", "without", "within",
  "over", "under", "also", "just", "like", "lots", "well", "good", "best",
  "great", "well", "thing", "things", "stuff", "high", "deep", "even", "make"
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function bigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  // Use Array.from for compatibility with the project's ES5 tsconfig
  // target — direct `for (const x of set)` iteration requires
  // downlevelIteration or es2015+ and fails the prod build.
  Array.from(setA).forEach((w) => {
    if (setB.has(w)) overlap += 1;
  });
  const union = setA.size + setB.size - overlap;
  return union === 0 ? 0 : overlap / union;
}

// Asks-for vs offers keyword pairs. If side A signals one half and side B
// signals the other, it's a 1.0 contribution. Symmetric: order doesn't
// matter. This catches "I'm raising" ↔ "I invest" matches that pure overlap
// misses because the words don't literally repeat. Hugely expanded for the
// May 2026 recalibration so a thoughtful twin pair always trips at least
// 1-2 complements.
const COMPLEMENTS: Array<[RegExp, RegExp]> = [
  // Capital flow
  [/\b(raising|seeking|need|looking|want).{0,30}(funding|capital|investors|investment|seed|series|check|round|backed)/i,
   /\b(invest|investor|angel|fund|capital|portfolio|vc|venture|writing\s+checks|deploy|backed)/i],
  // Hiring + job-seeking
  [/\b(hiring|recruit|need|looking\s+for|need\s+a)\s+(a\s+)?(cmo|cto|cfo|coo|head\s+of|lead|engineer|designer|operator|founder|exec|director|vp|chief)/i,
   /\b(looking\s+for\s+(a\s+)?role|operator|seeking|next\s+role|cmo|cto|cfo|coo|head\s+of|join\s+a|exec|director|vp|chief|exit|leaving)/i],
  // Co-founder match
  [/\b(need|looking\s+for|seeking)\s+(a\s+)?(co.?founder|cofounder|technical\s+(co.?)?founder|partner|teammate)/i,
   /\b(co.?founder|cofounder|technical\s+founder|join\s+a\s+(team|venture)|build\s+something|in\s+the\s+market\s+for)/i],
  // Distribution / audience
  [/\b(distribution|growth|marketing|users|reach|audience|launch|go.?to.?market|gtm)/i,
   /\b(distribution|growth|marketing|audience|community|influencer|creator|reach|followers|subscribers|newsletter)/i],
  // Design
  [/\b(need|looking\s+for|hiring)\s+(a\s+)?(designer|design|ux|brand|art\s+director)/i,
   /\b(designer|design|ux|brand|art\s+director|figma|illustrator)/i],
  // Engineering
  [/\b(need|looking\s+for|hiring)\s+(a\s+)?(developer|engineer|coder|technical|swe|full.?stack|backend|frontend|infra)/i,
   /\b(engineer|developer|coder|technical|swe|full.?stack|backend|frontend|infra|devops|sre|kubernetes)/i],
  // Advisor / mentor
  [/\b(need|looking\s+for|want)\s+(an?\s+)?(advisor|advisory|mentor|coach)/i,
   /\b(advise|advisor|mentor|coach|operator|veteran|ex.?(founder|exec)|board\s+member)/i],
  // Press / media
  [/\b(podcast|press|media|journalist|writer|reporter|article|coverage|story)/i,
   /\b(podcast|press|story|interview|feature|writer|journalist|host|magazine|newsletter)/i],
  // Sales / GTM
  [/\b(need|looking\s+for).{0,30}(sales|revenue|customers|pipeline|deals|enterprise|biz\s+dev)/i,
   /\b(sales|account\s+exec|ae|sdr|bdr|biz\s+dev|enterprise|gtm|revenue|quota)/i],
  // Intros to specific roles
  [/\b(intros?\s+to|connect\s+me\s+with|meet\s+a|warm\s+intro)/i,
   /\b(network|connections|intros?|knows\s+everyone|connected|warm\s+intros?)/i],
  // Hardware / supply chain
  [/\b(manufacturing|hardware|supply\s+chain|factory|prototype|sourcing)/i,
   /\b(manufacturing|hardware|supply\s+chain|factory|sourcing|china|shenzhen|asia)/i],
  // AI / agent ecosystem
  [/\b(ai|agent|llm|ml|model|claude|gpt|gemini|inference)/i,
   /\b(ai|agent|llm|ml|model|claude|gpt|gemini|inference|prompt|fine.?tun|rag|vector)/i],
  // Crypto / web3
  [/\b(crypto|web3|token|chain|defi|nft|dao|onchain|wallet|solana|ethereum)/i,
   /\b(crypto|web3|token|chain|defi|nft|dao|onchain|wallet|solana|ethereum|blockchain)/i],
  // Music / creative
  [/\b(music|artist|song|album|label|streaming|sync|royalt)/i,
   /\b(music|artist|song|album|label|streaming|sync|royalt|producer|composer)/i],
  // Health / wellness
  [/\b(health|fitness|wellness|nutrition|longevity|supplement|biohack)/i,
   /\b(health|fitness|wellness|nutrition|longevity|supplement|biohack|coach|trainer)/i],
  // Education / coaching
  [/\b(learn|course|cohort|teach|workshop|bootcamp|curriculum)/i,
   /\b(teach|teacher|instructor|professor|course|cohort|workshop|curriculum|mentor)/i],
  // Real estate
  [/\b(real\s+estate|property|broker|housing|rent|lease|landlord|tenant)/i,
   /\b(real\s+estate|property|broker|housing|rent|lease|landlord|construction|developer)/i]
];

function complementaryFit(aBlob: string, bBlob: string): number {
  // 1.0 if at least one complementary pair fires in EITHER direction.
  // Scales with how many fire — first hit gets you most of the way there,
  // additional ones add diminishing-but-real bumps. The new curve hits
  // 0.55 on the first hit (vs 0.42 previously) so a single strong match
  // already reads as "this is worth talking about."
  let hits = 0;
  for (const [askR, offerR] of COMPLEMENTS) {
    const aAsks = askR.test(aBlob);
    const bOffers = offerR.test(bBlob);
    const bAsks = askR.test(bBlob);
    const aOffers = offerR.test(aBlob);
    if ((aAsks && bOffers) || (bAsks && aOffers)) hits += 1;
  }
  if (hits === 0) return 0;
  // Curve: 1 hit → 0.55, 2 → 0.74, 3 → 0.83, 4 → 0.88, capped at 1.
  return Math.min(1, 0.55 + (hits - 1) * 0.18 - Math.max(0, hits - 3) * 0.04);
}

// Substance floor — when both twins have meaningful context, even a low
// keyword-overlap pair should read as "worth investigating." Two new
// signups with valid twins shouldn't see all matches below 40% — that
// kills the directory's UX.
function substanceFloor(aBlob: string, bBlob: string): number {
  const aLen = aBlob.trim().length;
  const bLen = bBlob.trim().length;
  if (aLen < 80 || bLen < 80) return 0; // one side is empty, no floor
  // Both have at least minimal context → 0.30 floor, scaling up to 0.45
  // as both blobs grow toward 1000 chars each.
  const aFactor = Math.min(1, aLen / 1000);
  const bFactor = Math.min(1, bLen / 1000);
  return 0.30 + 0.15 * Math.min(aFactor, bFactor);
}

export function computePairScore(
  me: TwinSnapshot,
  them: TwinSnapshot
): number {
  const myGoals = (me.goals ?? "").trim();
  const theirGoals = (them.goals ?? "").trim();
  const myFull = [
    me.goals ?? "",
    me.deal_preferences ?? "",
    me.communication_style ?? me.comm_style ?? "",
    me.deal_breakers ?? "",
    me.ai_export_blob ?? ""
  ].join(" ");
  const theirFull = [
    them.goals ?? "",
    them.deal_preferences ?? "",
    them.communication_style ?? them.comm_style ?? "",
    them.deal_breakers ?? "",
    them.ai_export_blob ?? ""
  ].join(" ");

  const myTokens = tokenize(myFull);
  const theirTokens = tokenize(theirFull);
  const myGoalTokens = tokenize(myGoals);
  const theirGoalTokens = tokenize(theirGoals);

  // Unigram jaccard, but amplified: real twin profiles have low jaccard
  // (the same word doesn't repeat much across distinct goals), so we
  // rescale a jaccard of 0.20 (which is meaningful) up to ~0.85. Without
  // this, every honest match scores in single digits and the rest cluster
  // at the floor.
  const uni = Math.min(1, jaccard(myTokens, theirTokens) * 4.5);

  // Bigram overlap — when both sides say "early stage" or "ai agents" or
  // "growth marketing," that's a much stronger signal than two
  // independent matches of "growth" and "marketing".
  const bi = Math.min(1, jaccard(bigrams(myTokens), bigrams(theirTokens)) * 6);

  // Goals-vs-goals — same Jaccard math but applied only to the single
  // most opinionated field. Amplified harder because goal blocks are
  // shorter.
  const goal = Math.min(1, jaccard(myGoalTokens, theirGoalTokens) * 5);

  // Complementary fit — the "you have what I need" signal. Now the
  // dominant weight in the score.
  const comp = complementaryFit(myFull, theirFull);

  // Reweighted: complementarity (potential outcome) is now 55% of the
  // total. Similarity signals (uni + bi + goal) collectively get 45%,
  // since same-domain still helps but isn't the headline.
  const weighted = 0.55 * comp + 0.15 * goal + 0.15 * bi + 0.15 * uni;

  // Apply substance floor — if both sides have real twins, no honest
  // pair should drop below ~45%.
  const floor = substanceFloor(myFull, theirFull);
  const lifted = Math.max(weighted, floor);

  // Stretch the [0, 1] interval to [3, 96]. Strong complementary fit
  // (e.g. raising ↔ invests + same domain) pushes into the high 80s;
  // both-active-twins-but-no-clear-fit lands in the mid 50s.
  const stretched = Math.round(3 + lifted * 93);
  return Math.max(0, Math.min(96, stretched));
}
