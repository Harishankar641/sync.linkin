/**
 * Giphy search helper for twin agents. Jack: "add in the gif API so the
 * agent can pull custom gifs in the conversation to make them more fun.
 * They should only use them in specific use cases, so there's randomness
 * and it doesn't seem like it's hardcoded."
 *
 * Search returns up to N PG-rated GIFs sorted by relevance. We pick one
 * non-deterministically from the top results so two twins searching the
 * same vibe at the same moment don't both grab the exact same GIF.
 *
 * Env: GIPHY_API_KEY. Without it, returns null silently so the twin
 * falls back to plain-text. (Same fail-soft pattern as Resend / Apify.)
 */

const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

export type GiphyHit = {
  id: string;
  url: string; // direct .gif URL, usable in <img src=> and markdown
  alt: string;
  width: number;
  height: number;
};

/**
 * Search Giphy and return ONE GIF randomly selected from the top 8
 * relevance results. Topic of "search" can be a comma-style hint
 * ("deal sealed celebration", "founder hustle"). PG-13 rated, no NSFW.
 */
export async function pickGif(opts: {
  query: string;
  /** Bias which slot of the top results we pull from. 0 = most relevant,
   *  higher = more variety. Default 0..7 random. */
  variety?: number;
}): Promise<GiphyHit | null> {
  if (!GIPHY_API_KEY) return null;
  const q = (opts.query || "").trim().slice(0, 120);
  if (!q) return null;

  try {
    const url = new URL("https://api.giphy.com/v1/gifs/search");
    url.searchParams.set("api_key", GIPHY_API_KEY);
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "8");
    url.searchParams.set("rating", "pg-13");
    url.searchParams.set("lang", "en");
    const res = await fetch(url.toString(), {
      // Cache for an hour at the edge — same search ⇒ same candidate
      // pool. Randomness comes from which index we pick.
      next: { revalidate: 60 * 60 }
    });
    if (!res.ok) {
      console.warn("[giphy] search failed", res.status);
      return null;
    }
    const j = (await res.json()) as { data?: any[] };
    const hits = Array.isArray(j.data) ? j.data : [];
    if (hits.length === 0) return null;
    // Pick variety randomly if not specified — clamp to actual length.
    const idx =
      typeof opts.variety === "number"
        ? Math.min(opts.variety, hits.length - 1)
        : Math.floor(Math.random() * Math.min(hits.length, 8));
    const g = hits[idx];
    const fixed = g?.images?.fixed_height ?? g?.images?.downsized_medium ?? {};
    const original = g?.images?.original ?? {};
    const directUrl =
      (fixed.url as string) || (original.url as string) || (g.url as string);
    if (!directUrl) return null;
    return {
      id: g.id as string,
      url: directUrl,
      alt: (g.title as string) || q,
      width: Number(fixed.width || original.width || 0) || 200,
      height: Number(fixed.height || original.height || 0) || 200
    };
  } catch (e) {
    console.warn("[giphy] threw", e);
    return null;
  }
}

/**
 * Strip GIF / image markdown and bare Giphy URLs out of any text that is
 * NOT the live conversation transcript. GIFs are a conversation-only
 * flourish (see maybeGifTrigger) — they must never appear in a proposal,
 * outcome summary, "proposed final destination", or agreement body. The
 * twin-generation loop occasionally lets the `![alt](url)` reaction syntax
 * bleed into the closing AGREEMENT text; this scrubs it at every display
 * surface so previously-stored agreements are cleaned too, not just newly
 * generated ones. Idempotent and safe on null/empty input.
 */
export function stripGifMarkdown(text: string | null | undefined): string {
  if (!text) return "";
  return text
    // ![alt](url) markdown image syntax — the GIF reaction format
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // any bare giphy.com / media*.giphy.com URL left dangling
    .replace(/https?:\/\/(?:[a-z0-9-]+\.)?giphy\.com\/\S+/gi, "")
    // tidy up the whitespace / blank lines the removal leaves behind
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Heuristic gating: should this twin reply include a GIF?
 *
 * Used by the twin-generation loop to keep GIF use SPARSE (Jack's ask:
 * "only in specific use cases, so there's randomness and it doesn't
 * seem like it's hardcoded"). Returns null when no GIF should fire,
 * or a {query, variety} hint when one is warranted.
 *
 * Trigger conditions (any one):
 *   - Message contains "sealed" / "agreed" / "we did it" / "let's go"
 *     → celebration GIF
 *   - Message contains a deal-sized number ("$1M", "200k") AND tone
 *     marker ("crazy", "wild", "insane")
 *     → big-deal GIF
 *   - Random 1-in-12 lottery on EVERY message after the third turn
 *     so even non-trigger replies sometimes surprise the user
 *     → context-derived query from the last ~80 chars
 */
export function maybeGifTrigger(
  text: string,
  turnIndex: number
): { query: string; variety?: number } | null {
  const t = text.toLowerCase();
  if (
    /\b(sealed|agreed|done deal|we did it|locked in|let'?s go|deal\b|shipping)\b/.test(
      t
    )
  ) {
    return { query: "deal sealed celebration high five" };
  }
  if (
    /\$\s?\d+[km]\b/.test(t) &&
    /\b(crazy|wild|insane|huge|massive|epic)\b/.test(t)
  ) {
    return { query: "mind blown reaction" };
  }
  // Lottery — fires sporadically after the third turn so early
  // conversations stay clean.
  if (turnIndex > 3 && Math.random() < 1 / 12) {
    const last = text.slice(-80).replace(/[^\w\s]/g, " ");
    const words = last.split(/\s+/).filter((w) => w.length > 4);
    if (words.length === 0) return null;
    const seed = words[Math.floor(Math.random() * words.length)];
    return { query: `${seed} reaction`, variety: Math.floor(Math.random() * 5) };
  }
  return null;
}
