/**
 * Sync % — how "complete" your twin/clone is.
 *
 * Caps at 99 by design. The last 1% is reserved as a north-star: a twin
 * can always get more aligned, never fully merged.
 *
 * The score is elastic: every meaningful action (adding context, having
 * a conversation, getting an edit captured, sealing an agreement) moves
 * the needle. No single input caps the meter prematurely — pasting one
 * more paragraph or holding one more conversation always nudges it up.
 *
 * Rebalanced (2026-06): setup alone should NOT get you near 99. Profile
 * completeness caps at ~43; the rest is earned by actively syncing your
 * twin — and editing its drafts is the strongest training signal there is,
 * so it's the single biggest, steepest bucket. Jack: "I'm at 98% but I
 * haven't truly synced it — message edits and proposal edits are powerful."
 *
 * STATIC profile (max ~43):
 *   name filled                  2
 *   goals filled                 6
 *   hometown + current city      2   (1 each)
 *   deal_preferences             3
 *   comm_style                   3
 *   deal_breakers                3
 *   ai_export_blob length       18   (1 pt per 150 chars, capped)
 *   context snippets             6   (1 pt per "# X (source)" block, max 6)
 * ACTIVE syncing (max ~57 — this is where real sync lives):
 *   conversations               12   (2 pts each, max 6 convos)
 *   sealed agreements           20   (5 pts each, max 4)
 *   edits captured              25   (1 pt per 2 edits, max 50 edits)
 *   ─────────────────────────────
 *   max total                  100   → clamped to 99
 */

export type SyncInputs = {
  name?: string | null;
  goals?: string | null;
  ai_export_blob?: string | null;
  deal_preferences?: string | null;
  comm_style?: string | null;
  deal_breakers?: string | null;
  hometown?: string | null;
  current_city?: string | null;
  completed_conversations?: number;
  accepted_agreements?: number;
  edit_count?: number;
};

export type SyncBreakdown = {
  total: number; // 0..99
  parts: { label: string; points: number; max: number; done: boolean }[];
  nextStep: string | null;
};

const filled = (s?: string | null) => !!(s && s.trim().length > 0);

/**
 * Graduated fullness — return a fraction 0..1 based on how much real content
 * is in a text field, so the breakdown can show "2/4" or "3/4" instead of
 * the binary 0/4 ↔ 4/4 jump. Short-form fields (deal prefs, comm style,
 * deal breakers) should tally up as the user keeps adding detail.
 *
 * Thresholds picked so:
 *   empty               → 0
 *   one word / phrase   → 0.33
 *   a sentence          → 0.66
 *   a real paragraph    → 1.0
 *
 * Combined with the `max` for that bucket, this produces clean 2/4, 3/4
 * style sub-scores without anyone needing to count characters.
 */
function fullness(s?: string | null): number {
  const len = (s ?? "").trim().length;
  if (len === 0) return 0;
  if (len < 24) return 0.33;
  if (len < 90) return 0.66;
  return 1;
}

function scaledPoints(s: string | null | undefined, max: number): number {
  // Round to nearest integer point so the breakdown reads as
  // "2/4" / "3/4" — never a fraction.
  return Math.round(fullness(s) * max);
}

export function computeSyncScore(inp: SyncInputs): SyncBreakdown {
  const blob = inp.ai_export_blob ?? "";
  const blobLen = blob.length;
  // Lower threshold (80 chars per pt) so each added paragraph visibly moves
  // the meter. Caps at 30.
  const blobPts = Math.min(18, Math.floor(blobLen / 150));

  // Count "# Label (source)" snippet headers in the blob — every added
  // source (LinkedIn / X / IG / Any URL) is a discrete +1.
  const snippetMatches = blob.match(/^#\s+.+?\s+\(.+?\)\s*$/gm);
  const snippetCount = snippetMatches ? snippetMatches.length : 0;
  const snippetPts = Math.min(6, snippetCount);

  const completed = inp.completed_conversations ?? 0;
  const accepted = inp.accepted_agreements ?? 0;
  const edits = inp.edit_count ?? 0;

  // 2 pts per conversation, max 12 (6 convos).
  const convPts = Math.min(12, completed * 2);
  // 5 pts per sealed agreement, max 20 (4 agreements).
  const agrPts = Math.min(20, accepted * 5);
  // EDITS ARE THE STRONGEST SIGNAL. 1 pt per 2 edits, max 25 (50 edits).
  // This is the biggest single bucket — truly syncing your twin means
  // correcting its drafts over and over. Jack: "message edits and proposal
  // edits are powerful."
  const editPts = Math.min(25, Math.floor(edits / 2));

  // Goals + the short-form fields scale with content depth. A one-word goal
  // gets 33% credit; a sentence gets 66%; a real paragraph fills the bucket.
  // Name / location stay binary because there's no "deeper name" — you
  // either have it or you don't.
  const goalsPoints = scaledPoints(inp.goals, 6);
  const dealPrefsPoints = scaledPoints(inp.deal_preferences, 3);
  const commStylePoints = scaledPoints(inp.comm_style, 3);
  const dealBreakersPoints = scaledPoints(inp.deal_breakers, 3);

  const parts: SyncBreakdown["parts"] = [
    {
      label: "Name",
      points: filled(inp.name) ? 2 : 0,
      max: 2,
      done: filled(inp.name)
    },
    {
      label: "Goals",
      points: goalsPoints,
      max: 6,
      done: goalsPoints >= 6
    },
    {
      label: "Where you live",
      points: filled(inp.current_city) ? 1 : 0,
      max: 1,
      done: filled(inp.current_city)
    },
    {
      label: "Where you're from",
      points: filled(inp.hometown) ? 1 : 0,
      max: 1,
      done: filled(inp.hometown)
    },
    {
      label: "Deal preferences",
      points: dealPrefsPoints,
      max: 3,
      done: dealPrefsPoints >= 3
    },
    {
      label: "Communication style",
      points: commStylePoints,
      max: 3,
      done: commStylePoints >= 3
    },
    {
      label: "Deal breakers",
      points: dealBreakersPoints,
      max: 3,
      done: dealBreakersPoints >= 3
    },
    {
      label: "Voice / context blob",
      points: blobPts,
      max: 18,
      done: blobPts >= 18
    },
    {
      label: "Context sources",
      points: snippetPts,
      max: 6,
      done: snippetPts >= 6
    },
    {
      label: "Conversations had",
      points: convPts,
      max: 12,
      done: convPts >= 12
    },
    {
      label: "Sealed agreements",
      points: agrPts,
      max: 20,
      done: agrPts >= 20
    },
    {
      label: "Edits captured (your twin learning you)",
      points: editPts,
      max: 25,
      done: editPts >= 25
    }
  ];

  const total = Math.min(99, parts.reduce((acc, p) => acc + p.points, 0));

  // Suggest the single highest-leverage next step.
  let nextStep: string | null = null;
  const undone = parts.find((p) => !p.done);
  if (undone) {
    switch (undone.label) {
      case "Voice / context blob":
        nextStep =
          "Paste more personal context (~80 chars per +1%)";
        break;
      case "Context sources":
        nextStep =
          "Connect another source (LinkedIn / X / Instagram / any URL)";
        break;
      case "Conversations had":
        nextStep = "Have another conversation with someone's twin";
        break;
      case "Sealed agreements":
        nextStep = "Reach a win-win agreement with someone";
        break;
      case "Edits captured (your twin learning you)":
        nextStep =
          "Edit your twin's drafts — this is what truly syncs it. Every 2 edits = +1%.";
        break;
      default:
        nextStep = `Fill in ${undone.label.toLowerCase()}`;
    }
  }

  return { total, parts, nextStep };
}
