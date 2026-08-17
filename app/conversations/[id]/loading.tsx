/**
 * Conversation route loading — intentionally returns null.
 *
 * We previously rendered a bubble-shimmer skeleton here, but on desktop
 * with router.prefetch + sidewide prefetch + ConversationPrefetch working,
 * the real page paints in well under 100ms — and the skeleton was actually
 * making it feel slower because it would flash in and then immediately
 * swap to real content. The user feedback was "weird loading screen on
 * desktop when clicking into messages."
 *
 * Returning null means Next.js shows the previous page until the new one
 * is ready (the standard App Router behavior when no loading file exists).
 * Combined with prefetching, the perceived navigation is now effectively
 * instant.
 *
 * If we ever hit a slow-network case where this matters, prefer a tiny
 * top-of-page progress bar over a full-page skeleton.
 */
export default function ConversationLoading() {
  return null;
}
