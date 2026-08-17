import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../../Wordmark";
import { TrackBeacon } from "../../TrackBeacon";

/**
 * /win/[id] — a single win receipt with its own permalink + OG preview
 * card (see ./opengraph-image.tsx). /wins is the browsable feed of every
 * receipt; this is the one-off, shareable version of a single receipt —
 * the link SyncMoment hands back after publishing, meant to be dropped
 * into a text thread or tweeted, so the "who's it for" answer in the
 * founder's own positioning doc ("every accepted intro creates a viral
 * loop") has an actual link behind it instead of just /wins as a whole.
 */
export const dynamic = "force-dynamic";

type Receipt = {
  id: string;
  outcome_text: string;
  party_a: string;
  party_b: string;
  anonymized: boolean;
  created_at: string;
};

async function loadReceipt(id: string): Promise<Receipt | null> {
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("win_receipts")
      .select("id, outcome_text, party_a, party_b, anonymized, created_at")
      .eq("id", id)
      .maybeSingle();
    return (data as Receipt) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params
}: {
  params: { id: string };
}): Promise<Metadata> {
  const receipt = await loadReceipt(params.id);
  if (!receipt) {
    return { title: "Win receipt · SyncedIn" };
  }
  const title = `${receipt.party_a} × ${receipt.party_b} synced · SyncedIn`;
  const description = receipt.outcome_text.slice(0, 200);
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description }
  };
}

export default async function WinPage({
  params
}: {
  params: { id: string };
}) {
  const receipt = await loadReceipt(params.id);
  if (!receipt) notFound();

  return (
    <main className="max-w-2xl mx-auto px-5 py-6">
      <TrackBeacon meta={{ door: "win_permalink", win_id: receipt.id }} />
      <div className="flex items-center justify-between">
        <Wordmark size="md" />
        <Link href="/wins" className="retro-dim text-sm hover:text-white">
          all wins
        </Link>
      </div>

      <section className="mt-10 text-center">
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--amber-bright)"
          }}
        >
          Win receipt
        </div>
        <h1
          className="retro-h1"
          style={{
            fontSize: "clamp(26px, 5vw, 38px)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            marginTop: 10
          }}
        >
          {receipt.party_a} × {receipt.party_b}
        </h1>
      </section>

      <section
        className="retro-panel"
        style={{
          marginTop: 28,
          maxWidth: 560,
          marginLeft: "auto",
          marginRight: "auto",
          padding: 24
        }}
      >
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--text)" }}>
          {receipt.outcome_text}
        </p>
        <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-dim)" }}>
          accepted {new Date(receipt.created_at).toLocaleDateString()}
          {receipt.anonymized ? " · published anonymously" : ""}
        </div>
      </section>

      <section
        className="mt-10 text-center"
        style={{ maxWidth: 480, marginInline: "auto" }}
      >
        <p style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.5 }}>
          This is a real outcome from a twin-negotiated match on SyncedIn.
          Build your own twin and let it find yours.
        </p>
        <Link
          href="/ai-knows-me"
          className="retro-btn retro-btn-primary"
          style={{
            display: "inline-block",
            marginTop: 14,
            padding: "10px 20px",
            textDecoration: "none",
            fontWeight: 800
          }}
        >
          Build your twin →
        </Link>
      </section>
    </main>
  );
}
