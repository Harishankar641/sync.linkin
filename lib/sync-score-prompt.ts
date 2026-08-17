/**
 * Default natural-language description of the sync-score algorithm.
 * Lives in /lib (not the route file) because Next.js App Router rejects
 * non-handler exports from `route.ts` modules at build time —
 * exporting a plain const from the route was what blocked the build
 * past commit e18c0ee.
 */
export const DEFAULT_SYNC_PROMPT = `Sync score blends FOUR signals into a single number 0–96. Higher = your twin is more likely to find a real win-win with this person.

  • Complementary fit (55%) — does one side ASK for what the other OFFERS? "Raising a seed" ↔ "I invest at pre-seed" trips this. "Need a CTO" ↔ "Senior engineer looking for next role" trips this. The strongest signal.

  • Goals overlap (15%) — do your one-line goals share keywords?

  • Domain language (15%) — do you both use the same bigrams ("AI agents", "creator economy", "growth marketing")?

  • Keyword affinity (15%) — loose token overlap across your full profiles.

A floor of ~30–45% applies once both sides have substantive twin profiles (≥80 chars of context), so two real users never look like a dead match.

The score is deterministic — same inputs always produce the same number. The post-conversation EXCITEMENT score (which can hit 99) is separate and reflects what actually happened in the chat.`;
