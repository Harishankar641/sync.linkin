import type { SocialUrls } from "@/app/SocialIconRow";

/**
 * Extract clickable social-profile URLs for a given user from
 *   (a) their profile.{linkedin_url,x_url,instagram_url,facebook_url,
 *       website_url} columns (preferred when present), and
 *   (b) their twin_profile.ai_export_blob + goals + deal_preferences
 *       — regex-scanned for the first matching URL of each platform.
 *
 * Profile-column values take precedence; blob inference is the
 * fallback. This single helper powers the icon row on:
 *   - /dashboard (conversation cards)
 *   - /proposals (each proposal row)
 *   - /messages (each thread row)
 *
 * Returns `null` when there's nothing to render so the SocialIconRow
 * component cleanly hides itself.
 */
type ProfileLike = {
  linkedin_url?: string | null;
  x_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  website_url?: string | null;
};

type TwinLike = {
  ai_export_blob?: string | null;
  goals?: string | null;
  deal_preferences?: string | null;
};

function firstMatch(blob: string, re: RegExp): string | null {
  if (!blob) return null;
  const m = blob.match(re);
  return m && m[0] ? m[0] : null;
}

export function socialsFromBlob(
  profile: ProfileLike | null | undefined,
  twin: TwinLike | null | undefined
): SocialUrls | null {
  const blob =
    `${twin?.ai_export_blob ?? ""}\n${twin?.goals ?? ""}\n${twin?.deal_preferences ?? ""}`.trim();

  const linkedin =
    (profile?.linkedin_url ?? null) ||
    firstMatch(blob, /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-z0-9-]+\/?/i);
  const x =
    (profile?.x_url ?? null) ||
    firstMatch(blob, /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-z0-9_]+\/?/i);
  const instagram =
    (profile?.instagram_url ?? null) ||
    firstMatch(blob, /https?:\/\/(?:www\.)?instagram\.com\/[a-z0-9_.]+\/?/i);
  const facebook =
    (profile?.facebook_url ?? null) ||
    firstMatch(blob, /https?:\/\/(?:www\.)?facebook\.com\/[a-z0-9.]+\/?/i);
  // Website inference is too noisy from the blob (any random link
  // matches), so we only honor the explicit column.
  const website = profile?.website_url ?? null;

  if (!linkedin && !x && !instagram && !facebook && !website) return null;
  return {
    linkedin_url: linkedin,
    x_url: x,
    instagram_url: instagram,
    facebook_url: facebook,
    website_url: website
  };
}
