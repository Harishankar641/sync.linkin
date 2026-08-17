/**
 * Shared copy helpers for the invite landing page + OG card.
 *
 * Both surfaces (the static social-preview PNG and the live HTML hero)
 * pull the same observation snippet from the personalized Claude-generated
 * landing message AND wrap it in the same "Recipient, it's time to get
 * SyncedIn." template. Centralizing here means the two never drift out
 * of sync — change the template once, both surfaces update.
 */

/**
 * Pull the most specific observation snippet out of the personalized
 * landing-page opener so the OG card and animated hero can both read like
 * a real cold reach instead of generic "my twin already drafted an
 * opener for yours" filler.
 *
 * Heuristic:
 *   1. Drop a leading "Hey {name} — {sender} here." greeting if present.
 *   2. Take the first remaining sentence.
 *   3. Normalize first-person voice into third-person noun-phrase form
 *      ("Your founding engineer work caught my eye" → "your founding
 *      engineer work").
 *   4. Truncate at a word boundary around 110 chars.
 *   5. Strip trailing punctuation so the template can chain into ", and..."
 */
export function observationSnippet(
  starter: string | null | undefined
): string {
  const s = (starter ?? "").trim();
  if (!s) return "";
  const noGreeting = s.replace(
    /^hey\s+[A-Za-z][A-Za-z'.-]*\s*[—–-]\s*[^.!?]+[.!?]\s*/i,
    ""
  );
  const noComma = noGreeting.replace(/^[A-Za-z][A-Za-z'.-]+,\s+/, "");
  const sentences = noComma.split(/(?<=[.!?])\s+/);
  let first = (sentences[0] ?? "").trim();
  if (!first) return "";
  first = first
    .replace(/^(i\s+(noticed|saw|love|loved|like|liked)\s+(that\s+)?)/i, "")
    .replace(/^(what\s+caught\s+my\s+eye\s+is\s+(that\s+)?)/i, "")
    .replace(/\s+caught\s+my\s+eye\.?$/i, "")
    .trim();
  if (first.length > 0 && /[A-Z]/.test(first[0])) {
    first = first[0].toLowerCase() + first.slice(1);
  }
  if (!/^(your|the|how)\b/i.test(first)) {
    first = "your " + first;
  }
  const HARD = 130;
  if (first.length > HARD) {
    const cut = first.slice(0, HARD);
    const lastSpace = cut.lastIndexOf(" ");
    first = (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim();
  }
  first = first.replace(/[.,;:!?…\s]+$/g, "");
  return first;
}

export function buildInviteCopy(opts: {
  inviterFullName: string;
  recipientShortName: string;
  snippet: string;
}): { headline: string; body: string } {
  const { inviterFullName, recipientShortName, snippet } = opts;
  const headline = `${recipientShortName}, it's time to get SyncedIn.`;

  // Quality gate on the snippet so we never emit broken phrases like
  // "saw your jackson here" (Jack's bug — the AI starter mentioned
  // himself by name and that bled into the snippet). Reject any snippet
  // that:
  //  - contains the inviter's first name (would create "Jack saw your jack...")
  //  - is shorter than 12 chars (too thin to be specific)
  //  - is essentially just demonstrative ("your work", "your post")
  const inviterFirst = (inviterFullName || "").split(/\s+/)[0] ?? "";
  const recipientFirst = (recipientShortName || "").split(/\s+/)[0] ?? "";
  const lowSnippet = (snippet || "").toLowerCase();
  const looksBroken =
    !snippet ||
    snippet.length < 12 ||
    (inviterFirst &&
      lowSnippet.includes(inviterFirst.toLowerCase()) &&
      inviterFirst.length > 2) ||
    (recipientFirst &&
      lowSnippet.includes(recipientFirst.toLowerCase()) &&
      recipientFirst.length > 2) ||
    /^your\s+(work|post|profile|page|stuff|thing|background|here)\.?$/i.test(
      snippet.trim()
    );

  // Gender-neutral pronoun — "his" was assuming. "their" works for any
  // inviter and reads naturally.
  const body = looksBroken
    ? `${inviterFullName} thinks your twin is worth a conversation with theirs. Spin yours up and let the two clones find the win-win. Let's stay SyncedIn, together.`
    : `${inviterFullName} saw ${snippet} — and is ready to have their agent find a plan with yours. Let's stay SyncedIn, together.`;
  return { headline, body };
}
