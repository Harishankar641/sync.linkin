import { NextResponse } from "next/server";

/**
 * Scrape brand info (logo, primary color, name, blurb) from a community
 * or conference's website URL. Used to auto-fill the room create/edit
 * form so the host gets a polished page without uploading anything.
 *
 * Jack: "Community/Conference custom branding via website URL — scrape
 * logo, colors, generate OG image."
 *
 * GET /api/scrape-room-brand?url=https://example.com
 * → { name, blurb, logo_url, theme_color, og_image_url }
 *
 * Best-effort: any field can be null. Caller renders what's there.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function abs(base: string, ref: string | null): string | null {
  if (!ref) return null;
  try {
    return new URL(ref, base).toString();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const url = u.searchParams.get("url") || "";
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "bad_url" }, { status: 400 });
  }

  let html = "";
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        // Many sites block bots without a real UA; this one is honest.
        "user-agent":
          "SyncedIn-RoomBrandBot/1.0 (+https://syncedin.org/article)",
        accept: "text/html,application/xhtml+xml"
      },
      next: { revalidate: 60 * 60 * 24 }
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "fetch_failed", status: res.status },
        { status: 200 }
      );
    }
    html = await res.text();
  } catch (e: any) {
    return NextResponse.json(
      { error: "fetch_threw", detail: e?.message ?? null },
      { status: 200 }
    );
  }

  // Cheap regex parsing — heavy DOM libs would balloon the function size
  // and we only need 4 specific meta tags.
  const pick = (re: RegExp): string | null => {
    const m = html.match(re);
    return m ? m[1].trim() : null;
  };

  const ogTitle = pick(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  );
  const twTitle = pick(
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i
  );
  const titleTag = pick(/<title[^>]*>([^<]+)<\/title>/i);
  const name = ogTitle || twTitle || titleTag;

  const ogDesc = pick(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
  );
  const metaDesc = pick(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
  );
  const blurb = (ogDesc || metaDesc || "").slice(0, 280) || null;

  const ogImage = pick(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  );
  const twImage = pick(
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
  );
  const og_image_url = abs(url, ogImage || twImage);

  // Logo: prefer apple-touch-icon (typically 180×180+) → og:image →
  // shortcut icon → first <link rel="icon">. Mark size so caller can
  // upgrade later.
  const appleIcon = pick(
    /<link[^>]+rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["'][^>]+href=["']([^"']+)["']/i
  );
  const icon = pick(
    /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i
  );
  const logo_url =
    abs(url, appleIcon) || og_image_url || abs(url, icon) || null;

  // Theme color: <meta name="theme-color"> → site's brand color hint.
  const themeColor = pick(
    /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i
  );
  const theme_color =
    themeColor && /^#[0-9a-fA-F]{3,8}$/.test(themeColor.trim())
      ? themeColor.trim()
      : null;

  return NextResponse.json({
    name,
    blurb,
    logo_url,
    theme_color,
    og_image_url
  });
}
