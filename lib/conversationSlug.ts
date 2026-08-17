/**
 * Short, meaningful conversation slugs (#69).
 *
 * Jack: "Short, meaningful conversation slugs (first-name based, same
 * for both sides)."
 *
 * A conversation between Jack and Alex resolves at /c/jack-alex-7k4q9p,
 * regardless of which side opens it. Both participants see the SAME
 * slug — derived deterministically from the conversation UUID plus
 * both participants' first names.
 *
 * Why include a uuid-derived suffix at all: name collisions. Jack →
 * Alex appears multiple times across the platform; slugs need to stay
 * 1:1 with the conversation row.
 *
 * The slug column is unique-indexed in conversations. Backfill happens
 * lazily on first slug-resolve.
 */

export type SlugInput = {
  conversationId: string;
  nameA?: string | null;
  nameB?: string | null;
};

function firstNameOf(s: string | null | undefined): string {
  const raw = (s ?? "").trim();
  if (!raw) return "";
  // Take token before first space/comma/@; lowercase; strip non-az0-9.
  const head = raw.split(/[\s,@]+/)[0] || raw;
  const cleaned = head.toLowerCase().replace(/[^a-z0-9]+/g, "");
  // Cap at 12 chars to avoid runaway URLs from long display names.
  return cleaned.slice(0, 12);
}

function suffixOf(conversationId: string): string {
  // Deterministic 6-char base36 derived from the UUID. Drops dashes
  // and stable-hashes via a tiny fnv variant so different UUIDs land
  // at different suffixes even when the prefix collides.
  const id = (conversationId || "").replace(/-/g, "");
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, "0").slice(0, 6);
}

export function buildConversationSlug(input: SlugInput): string {
  const a = firstNameOf(input.nameA);
  const b = firstNameOf(input.nameB);
  // Sort the two names so both participants get the SAME slug regardless
  // of which side is participant_a in the row.
  const pair = [a, b].filter(Boolean).sort();
  const stem = pair.length ? pair.join("-") : "convo";
  return `${stem}-${suffixOf(input.conversationId)}`;
}

/**
 * Pull the best human-name for slug construction out of a profile row.
 * Falls back to email-local-part if display_name is missing.
 */
export function profileSlugName(p: {
  display_name?: string | null;
  email?: string | null;
  handle?: string | null;
}): string {
  return (
    p.display_name?.trim() ||
    p.handle?.trim() ||
    (p.email ?? "").split("@")[0] ||
    ""
  );
}
