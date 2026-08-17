/**
 * Edit-magnitude metric (twin updater v2, stage 1).
 *
 * The edit delta between the twin's `original_draft` and the user's
 * `final_text` is, at once, the training signal, the eval metric, and the
 * product value. Stage 1 is pure measurement: compute and log this so we
 * finally have a baseline. No model behavior changes here.
 *
 *   editMagnitude: 0.0 = sent unchanged (a win) -> 1.0 = fully rewritten.
 *   classifyChange: the KIND of correction (what later consolidates into
 *                   durable voice rules).
 *
 * TS port of the validated prototype (twin_updater.py). Magnitude uses a
 * token-level longest-common-subsequence ratio (Ratcliff/Obershelp-style),
 * matching the prototype's `1 - SequenceMatcher.ratio`.
 */

const HEDGE = [
  "synergies",
  "mutually beneficial",
  "explore potential",
  "circle back",
  "touch base",
  "at the end of the day",
  "love to",
  "excited to",
  "going forward",
  "leverage",
  "ecosystem",
  "path forward",
  "reach out"
];

const DAYS =
  /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|this week|next week)/i;
const NOT_X_ITS_Y = /\bnot .+?,?\s+it'?s\b/i;

function toks(s: string): string[] {
  return (s.toLowerCase().match(/\w+|[^\w\s]/g) ?? []);
}

/** Length of the longest common subsequence of two token arrays. */
function lcsLen(a: string[], b: string[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return 0;
  // Rolling 1-D DP to keep memory at O(min(n,m)).
  let prev = new Array<number>(m + 1).fill(0);
  let curr = new Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1] + 1
          : Math.max(prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

/**
 * 0.0 = identical (draft sent unchanged), 1.0 = no overlap.
 * ratio = 2*LCS / (len(a)+len(b)); magnitude = 1 - ratio.
 */
export function editMagnitude(draft: string, final: string): number {
  const a = toks(draft ?? "");
  const b = toks(final ?? "");
  if (a.length === 0 && b.length === 0) return 0;
  const ratio = (2 * lcsLen(a, b)) / (a.length + b.length);
  return Math.round((1 - ratio) * 1000) / 1000;
}

function hasNumber(s: string): boolean {
  return /\$?\d/.test(s);
}

function hedgeCount(s: string): number {
  const lc = s.toLowerCase();
  return HEDGE.reduce((n, p) => n + (lc.includes(p) ? 1 : 0), 0);
}

/**
 * The kind(s) of correction the user made. Used (later, stage 2) to
 * consolidate recurring corrections into durable voice rules; logged now so
 * the baseline shows WHICH edit types dominate.
 */
export function classifyChange(draft: string, final: string): string[] {
  const tags: string[] = [];
  const dl = (draft ?? "").toLowerCase();
  const fl = (final ?? "").toLowerCase();
  if (hasNumber(final) && !hasNumber(draft)) tags.push("add_number");
  if (hedgeCount(final) < hedgeCount(draft)) tags.push("remove_hedging");
  if (toks(final).length <= 0.7 * toks(draft).length) tags.push("shorten");
  if (draft.includes("—") && !final.includes("—"))
    tags.push("remove_em_dash");
  if (DAYS.test(fl) && !DAYS.test(dl)) tags.push("add_next_step");
  if (NOT_X_ITS_Y.test(dl) && !NOT_X_ITS_Y.test(fl))
    tags.push("remove_not_x_its_y");
  return tags;
}
