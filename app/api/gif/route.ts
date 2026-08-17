import { NextResponse } from "next/server";
import { pickGif } from "@/lib/giphy";

/**
 * Public GIF picker — wraps lib/giphy's pickGif so client code (twin
 * loop, future ChatUI inline picker) can fetch without leaking the
 * GIPHY_API_KEY to the browser.
 *
 * GET /api/gif?q=deal+sealed&variety=2
 *
 * Returns { hit: { id, url, alt, width, height } | null }.
 * Always 200; absence of a hit just means "no GIF this time" so
 * callers can degrade to plain text.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const varietyParam = url.searchParams.get("variety");
  const variety =
    varietyParam !== null && !Number.isNaN(parseInt(varietyParam, 10))
      ? parseInt(varietyParam, 10)
      : undefined;
  const hit = await pickGif({ query: q, variety });
  return NextResponse.json({ hit });
}
