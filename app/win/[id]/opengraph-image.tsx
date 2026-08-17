import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs"; // service client needs node runtime
export const alt = "A real win-win, negotiated by two AI twins on SyncedIn.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Per-win OG card. Follows the same "branded background art + overlaid
 * personalization" pattern as app/[slug]/opengraph-image.tsx (the invite
 * card) so a shared win looks like it belongs to the same product, not a
 * bolted-on afterthought.
 */
export default async function WinOgImage({
  params
}: {
  params: { id: string };
}) {
  const SITE_URL =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";

  let partyA = "A SyncedIn member";
  let partyB = "A SyncedIn member";
  let outcome = "Two twins found a win-win.";
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("win_receipts")
      .select("party_a, party_b, outcome_text")
      .eq("id", params.id)
      .maybeSingle();
    if (data) {
      partyA = (data as any).party_a || partyA;
      partyB = (data as any).party_b || partyB;
      outcome = ((data as any).outcome_text || outcome).slice(0, 180);
    }
  } catch {
    /* fall through with defaults so the card never 500s */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "60px 80px",
          fontFamily: "Inter, system-ui, sans-serif"
        }}
      >
        <img
          src={`${SITE_URL}/synced-background.png`}
          width={1200}
          height={630}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            maxWidth: 920,
            background: "rgba(255,255,255,0.55)",
            borderRadius: 28,
            padding: "34px 40px"
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#3a3060",
              display: "flex"
            }}
          >
            WIN RECEIPT
          </div>
          <div
            style={{
              fontSize: 46,
              fontWeight: 900,
              color: "#1a1530",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              marginTop: 10,
              display: "flex"
            }}
          >
            {partyA} × {partyB}
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 500,
              color: "#3a3060",
              lineHeight: 1.35,
              marginTop: 16,
              display: "flex"
            }}
          >
            {outcome}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
