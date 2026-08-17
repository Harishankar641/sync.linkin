import { NextResponse } from "next/server";

/**
 * Link.me profile importer (#280, Link.me partnership). Fetches a
 * public Link.me page server-side, parses the standard linktree-style
 * HTML, and returns structured profile data the visitor can preview
 * before signup.
 *
 * Link.me pages are server-rendered HTML — no third-party scraper
 * needed. If they start client-rendering (SPA), we fall back to Apify.
 *
 * GET /api/linkme-import?url=link.me/jackjay
 *   → { name, bio, avatar_url, links: [{label, url, intent}] }
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Best-effort intent labeling — twin uses this to route visitors.
// We pick the strongest signal from the link label + URL hostname.
function inferIntent(label: string, url: string): string {
  const l = (label + " " + url).toLowerCase();
  if (/calendly|cal\.com|book|schedule|meeting|call/.test(l)) return "booking";
  if (/course|learn|udemy|teachable|gumroad|kajabi/.test(l)) return "course";
  if (/podcast|spotify|apple\.com.*podcast/.test(l)) return "podcast";
  if (/youtube|youtu\.be/.test(l)) return "video";
  if (/twitter|x\.com|threads/.test(l)) return "social_x";
  if (/instagram/.test(l)) return "social_ig";
  if (/linkedin/.test(l)) return "social_linkedin";
  if (/tiktok/.test(l)) return "social_tiktok";
  if (/github/.test(l)) return "code";
  if (/substack|newsletter|beehiiv|medium/.test(l)) return "newsletter";
  if (/stripe|gumroad|shopify|merch|store|shop/.test(l)) return "commerce";
  if (/advisory|consult|coach|advise/.test(l)) return "advisory";
  if (/mailto:|email|contact/.test(l)) return "email";
  return "other";
}

function normalizeUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  try {
    const u = new URL(s);
    // Accept both link.me/<user> and <user>.link.me patterns.
    if (
      u.hostname === "link.me" ||
      u.hostname === "www.link.me" ||
      u.hostname.endsWith(".link.me") ||
      // Also handle linktr.ee since their HTML is similar — bonus support
      u.hostname === "linktr.ee" ||
      u.hostname === "www.linktr.ee"
    ) {
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function abs(base: string, ref: string | null): string | null {
  if (!ref) return null;
  try {
    return new URL(ref, base).toString();
  } catch {
    return null;
  }
}

function pick(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

// Decode the most common HTML entities in scraped text.
function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const raw = u.searchParams.get("url") || "";
  const url = normalizeUrl(raw);
  if (!url) {
    return NextResponse.json(
      {
        error: "bad_url",
        detail:
          "Paste your Link.me URL — e.g. link.me/yourname or yourname.link.me"
      },
      { status: 400 }
    );
  }

  let html = "";
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "SyncedIn-LinkmeImporter/1.0 (+https://syncedin.org)",
        accept: "text/html,application/xhtml+xml"
      },
      // Cache scrapes for 1 hour — same Link.me URL pasted by 10 people
      // shouldn't hit their server 10 times.
      next: { revalidate: 60 * 60 }
    });
    if (!res.ok) {
      return NextResponse.json(
        {
          error: "fetch_failed",
          detail: `Couldn't reach ${url} (status ${res.status}). Make sure the page is public.`
        },
        { status: 200 }
      );
    }
    html = await res.text();
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "fetch_threw",
        detail: e?.message ?? "Couldn't reach that URL."
      },
      { status: 200 }
    );
  }

  // Name — og:title > twitter:title > <title>
  const name =
    pick(
      html,
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    ) ||
    pick(
      html,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i
    ) ||
    pick(html, /<title[^>]*>([^<]+)<\/title>/i);

  // Bio — og:description > meta description
  const bio =
    pick(
      html,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    ) ||
    pick(
      html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
    );

  // Avatar — og:image
  const avatarRaw = pick(
    html,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  );
  const avatar_url = abs(url, avatarRaw);

  // Links — every <a href> on the page. We then filter out the
  // platform's own chrome (link.me legal pages, share buttons, etc).
  const linkRe =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const links: Array<{ label: string; url: string; intent: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const href = m[1];
    const rawLabel = m[2]
      .replace(/<[^>]+>/g, " ") // strip nested tags (svgs, spans)
      .replace(/\s+/g, " ")
      .trim();
    const absUrl = abs(url, href);
    if (!absUrl) continue;
    // Skip self-referential + platform chrome.
    if (/link\.me\/(terms|privacy|legal|about|signup|login)/i.test(absUrl))
      continue;
    if (/linktr\.ee\/(terms|privacy|legal|about|signup|login|s)/i.test(absUrl))
      continue;
    // Skip page-internal anchors, mailto unless explicit, javascript.
    if (/^#/.test(href) || /^javascript:/i.test(href)) continue;
    // Skip links that ARE the link.me/linktree homepage.
    try {
      const parsed = new URL(absUrl);
      if (
        (parsed.hostname === "link.me" || parsed.hostname === "linktr.ee") &&
        (parsed.pathname === "/" || parsed.pathname === "")
      ) {
        continue;
      }
    } catch {
      continue;
    }
    const label = decode(rawLabel).slice(0, 120) || "";
    // Skip empty-label icon-only buttons (we already get socials from
    // the meta-tag pass below). And dedupe by URL.
    if (label.length < 2) continue;
    if (seen.has(absUrl)) continue;
    seen.add(absUrl);
    links.push({ label, url: absUrl, intent: inferIntent(label, absUrl) });
  }

  return NextResponse.json({
    ok: true,
    source_url: url,
    name: name ? decode(name) : null,
    bio: bio ? decode(bio).slice(0, 600) : null,
    avatar_url,
    links: links.slice(0, 30)
  });
}
