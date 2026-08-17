"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ConversationPrefetch — on mount, calls router.prefetch() for every
 * conversation ID visible on the messages page. This warms the Next.js
 * route bundle cache so when the user actually clicks into a
 * conversation, the JS is already in memory and the loading.tsx
 * skeleton appears in <50ms with the real page streaming behind it.
 *
 * Pairs with /conversations/[id]/loading.tsx for the "smooth as fuck"
 * navigation feel: prefetch warms the bundle, loading.tsx eliminates
 * the white-screen gap, server stream fills in the data.
 */
export function ConversationPrefetch({ ids }: { ids: string[] }) {
  const router = useRouter();
  useEffect(() => {
    // Stagger prefetches slightly so we don't hammer the browser's
    // network pool — the first 5 fire immediately, the rest at 80ms
    // intervals. By the time the user has moved their cursor toward
    // any of them, the bundle is ready.
    const top = ids.slice(0, 5);
    const rest = ids.slice(5);
    for (const id of top) router.prefetch(`/conversations/${id}`);
    const timers: ReturnType<typeof setTimeout>[] = [];
    rest.forEach((id, i) => {
      timers.push(
        setTimeout(() => router.prefetch(`/conversations/${id}`), 80 + i * 80)
      );
    });
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [ids, router]);
  return null;
}
