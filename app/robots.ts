import type { MetadataRoute } from "next";

/**
 * Robots policy. Next.js serves this at /robots.txt automatically.
 * We let everything indexable through and explicitly block the
 * authenticated / admin / one-shot surfaces that have no SEO value
 * and would leak signals about logged-in user counts via crawl
 * traffic. Sitemap pointer at the bottom drives crawl scheduling.
 */
export default function robots(): MetadataRoute.Robots {
  const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard",
          "/onboarding",
          "/settings",
          "/conversations/",
          "/poll/", // poll pages handled by per-page robots; this denies any non-canonical UUID landing
          "/twin"
        ]
      },
      // Explicitly grant the AI-friendly bots — they tend to over-
      // throttle when robots.txt looks generic. Mirrors our llms.txt
      // posture: we WANT these crawlers reading us.
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "anthropic-ai", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "Applebot-Extended", allow: "/" }
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL
  };
}
