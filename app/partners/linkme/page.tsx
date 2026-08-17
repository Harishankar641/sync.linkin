import type { Metadata } from "next";
import { LinkmePartnerDemo } from "./LinkmePartnerDemo";

/**
 * Standalone partnership demo page for the Link.me founder pitch.
 *
 * Mirrors Link.me's actual sidebar UI (Search / Profile / Messages /
 * Analytics / Agency / Post + Make Money block + Linkme AI footer)
 * and inserts SyncedIn features as if they were native sections
 * inside the Link.me product. The point: show him exactly what the
 * integration looks like LIVING on his subdomain, not slide-deck
 * mockups.
 *
 * Lives at /partners/linkme. Not linked from any nav — only Jack
 * sends the URL directly to the founder.
 */
export const metadata: Metadata = {
  title: "Linkme × SyncedIn — partnership preview",
  description:
    "Preview of how SyncedIn AI twin features would live natively inside Linkme's product.",
  robots: { index: false, follow: false }
};

export default function LinkmePartnerPage() {
  return <LinkmePartnerDemo />;
}
