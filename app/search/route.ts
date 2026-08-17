import { NextResponse } from "next/server";

/**
 * Sitelinks Searchbox handler (#284).
 *
 * The WebSite JSON-LD in app/layout.tsx points Google at
 * /search?q={search_term_string}. When a user types in the Google-
 * provided search box that appears inside our SERP listing, Google
 * sends them HERE. We hand off to the dashboard's existing discovery
 * flow so they land somewhere useful instead of a dead route.
 *
 * Until we have a public site-search index, the simplest correct
 * behavior is: pass the query through to /dashboard?intent=<q> so
 * the Find People surface can run an Exa search on it. Logged-out
 * visitors get bounced to /login?next=... so the query survives auth.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.redirect(`${url.origin}/`);
  }
  // Drop the query into the dashboard discovery surface (it reads
  // ?intent= and pre-populates the Find People box).
  const target = `/dashboard?intent=${encodeURIComponent(q)}`;
  return NextResponse.redirect(
    `${url.origin}/login?next=${encodeURIComponent(target)}`
  );
}
