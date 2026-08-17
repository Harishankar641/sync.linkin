/**
 * User-handle helpers. The handle is what shows up at /u/<handle> for a
 * user's public portfolio page. It's distinct from the invite slug
 * (/<slug>) which is per-recipient. The handle is per-USER and stable.
 *
 * Rules:
 *   - lowercase, alphanumeric + hyphens only
 *   - 2-40 chars
 *   - reserved set (api, dashboard, etc) is rejected so we don't collide
 *     with top-level routes
 *   - falls back to "twin-<6 hex>" if the source name is empty / all
 *     punctuation
 */

const RESERVED = new Set([
  "api",
  "auth",
  "dashboard",
  "onboarding",
  "login",
  "conversations",
  "privacy",
  "terms",
  "support",
  "favicon.ico",
  "icon",
  "apple-icon",
  "manifest.json",
  "robots.txt",
  "sitemap.xml",
  "admin",
  "messages",
  "invite",
  "hypernetwork",
  "communities",
  "conference",
  "claim",
  "settings",
  "founders-vc",
  "founders-cofounder",
  "careers",
  "welcome",
  "u"
]);

export function slugifyHandle(input: string): string {
  const base = (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!base || base.length < 2 || RESERVED.has(base)) {
    // Random fallback so /u/<handle> always resolves to something.
    const rand = Math.random().toString(36).slice(2, 8);
    return `twin-${rand}`;
  }
  return base;
}

export function handleIsReserved(handle: string): boolean {
  return RESERVED.has(handle.toLowerCase());
}
