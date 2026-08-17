"use client";

import { BrandLogo, type BrandKey } from "./BrandLogo";

/**
 * Small horizontal row of clickable platform icons. Renders inline
 * next to a user's name in messaging surfaces (conversation header,
 * /messages rows, conversation rail, /u/<handle> portfolio) so the
 * counterpart can click straight out to verify who they're dealing
 * with. Skips silently if no URLs are provided — never renders an
 * empty container.
 *
 * Client component: each anchor stops click propagation so a parent
 * row <Link> (messages rows wrap the name in a conversation link)
 * can't hijack the click and route into the app instead of out to
 * the platform. Each link opens in a new tab.
 */
export type SocialUrls = {
  linkedin_url?: string | null;
  x_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  website_url?: string | null;
};

const ORDER: Array<{ field: keyof SocialUrls; brand: BrandKey; label: string }> = [
  { field: "linkedin_url", brand: "linkedin", label: "LinkedIn" },
  { field: "x_url", brand: "x", label: "X / Twitter" },
  { field: "instagram_url", brand: "instagram", label: "Instagram" },
  { field: "facebook_url", brand: "facebook", label: "Facebook" },
  { field: "website_url", brand: "website", label: "Website" }
];

export function SocialIconRow({
  urls,
  size = 16,
  gap = 6,
  className
}: {
  urls: SocialUrls | null | undefined;
  size?: number;
  gap?: number;
  className?: string;
}) {
  if (!urls) return null;
  const present = ORDER.filter((o) => {
    const v = urls[o.field];
    return typeof v === "string" && v.trim().length > 0;
  });
  if (present.length === 0) return null;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap,
        verticalAlign: "middle"
      }}
    >
      {present.map((o) => {
        const href = urls[o.field] as string;
        return (
          <a
            key={o.field}
            href={href.startsWith("http") ? href : `https://${href}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={o.label}
            aria-label={`${o.label} profile`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: size + 8,
              height: size + 8,
              borderRadius: 999,
              background: "var(--panel-2)",
              border: "1px solid var(--border)",
              textDecoration: "none",
              transition: "transform 0.12s ease, border-color 0.12s ease",
              lineHeight: 0
            }}
            className="social-icon-pill"
          >
            <BrandLogo brand={o.brand} size={size} />
          </a>
        );
      })}
      <style>{`
        .social-icon-pill:hover {
          transform: translateY(-1px);
          border-color: #1f8bff;
        }
      `}</style>
    </span>
  );
}
