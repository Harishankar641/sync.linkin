/**
 * Public-profile scraper chain.
 *
 * Strategy: try Exa first (cheap, works for most LinkedIn / Substack / blogs),
 * then fall back to Apify actors for X / Instagram which Exa can't reach
 * because those sites require auth or block headless browsers.
 *
 * Env vars (optional — each tier degrades gracefully if missing):
 *   EXA_API_KEY      — already used by lib/exa
 *   APIFY_TOKEN      — for the Apify run-sync-get-dataset-items endpoint
 *
 * Apify actors used (run-sync-get-dataset-items hits them by slug):
 *   - apify/twitter-scraper           (X / Twitter, public timelines + profile)
 *   - apify/instagram-profile-scraper (Instagram public profiles)
 *
 * If everything fails we surface the raw error so the UI can fall back to
 * the manual paste path.
 */

import { exaGetContents } from "@/lib/exa";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
// ScrapingDog: a fully separate provider with dedicated IG + X profile
// endpoints. Used as a second vendor (real cross-provider redundancy, not
// just a different Apify actor). Sign up at scrapingdog.com → copy API key
// → set SCRAPINGDOG_API_KEY in Vercel env. If the key is unset, this whole
// branch is skipped silently and we fall back to Apify alone.
const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;

function isXUrl(url: string): boolean {
  return /(?:^|\/\/)(?:www\.)?(?:twitter|x)\.com\//i.test(url);
}
function isInstagramUrl(url: string): boolean {
  return /(?:^|\/\/)(?:www\.)?instagram\.com\//i.test(url);
}
function isLinkedInUrl(url: string): boolean {
  return /(?:^|\/\/)(?:www\.)?linkedin\.com\/in\//i.test(url);
}

function linkedInHandleFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/in\/([^/?#]+)/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function handleFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/").filter(Boolean);
    return segs[0] || null;
  } catch {
    return null;
  }
}

/**
 * ScrapingDog Instagram profile endpoint — independent vendor (not Apify).
 * Docs: https://docs.scrapingdog.com/instagram-scraper/instagram-profile
 *
 * Returns the profile + recent posts as one JSON blob. We flatten the
 * useful bits (bio, follower count, external_url, post captions, profile
 * image URL) into a single text payload for the LLM.
 */
async function scrapingDogInstagram(handle: string): Promise<string> {
  if (!SCRAPINGDOG_API_KEY) throw new Error("SCRAPINGDOG_API_KEY missing");
  const url = `https://api.scrapingdog.com/instagram/profile?api_key=${encodeURIComponent(
    SCRAPINGDOG_API_KEY
  )}&username=${encodeURIComponent(handle)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(
      `ScrapingDog IG ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`
    );
  }
  // Defensive JSON parse — see scrapingDogX comment.
  const rawText = await res.text().catch(() => "");
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    throw new Error(
      `ScrapingDog IG returned non-JSON for @${handle} (likely captcha or rate-limited): ${rawText
        .slice(0, 160)
        .replace(/\s+/g, " ")}`
    );
  }
  // ScrapingDog wraps the actual profile under various keys depending on
  // API version — try them all defensively.
  const p =
    (j.profile as Record<string, unknown>) ||
    (j.data as Record<string, unknown>) ||
    (j.user as Record<string, unknown>) ||
    j;
  const fullName =
    (p.full_name as string) || (p.fullName as string) || handle;
  const biography = (p.biography as string) || (p.bio as string) || "";
  // Follower counts are intentionally NOT extracted — Jack's instruction
  // is that openers should never reference follower count.
  const externalUrl =
    (p.external_url as string) ||
    (p.externalUrl as string) ||
    (p.website as string) ||
    "";
  const bioLinks = Array.isArray(p.bio_links)
    ? (p.bio_links as any[])
        .map((b) => (typeof b === "string" ? b : b?.url))
        .filter(Boolean)
    : [];
  const profilePic =
    (p.profile_pic_url_hd as string) ||
    (p.profile_pic_url as string) ||
    (p.profilePicUrl as string) ||
    "";
  const posts =
    (p.posts as any[]) ||
    (p.recent_posts as any[]) ||
    (p.latestPosts as any[]) ||
    [];
  const captions = posts
    .slice(0, 8)
    .map((post) =>
      typeof post?.caption === "string"
        ? post.caption
        : typeof post?.text === "string"
        ? post.text
        : ""
    )
    .filter(Boolean);

  if (!biography && captions.length === 0 && !fullName) {
    throw new Error("ScrapingDog IG returned empty payload");
  }
  return flatten(
    {
      handle: `@${handle}`,
      fullName,
      biography,
      external_url: externalUrl,
      bio_links: bioLinks,
      profile_image: profilePic,
      latestPosts: captions
    },
    0
  );
}

/**
 * ScrapingDog X / Twitter profile endpoint.
 */
/**
 * ScrapingDog LinkedIn profile endpoint. Docs:
 *   https://docs.scrapingdog.com/linkedin-scraper/linkedin-profile
 * The `linkId` query param is the slug from linkedin.com/in/<linkId>.
 * Returns headline, summary/about, current/past positions, education,
 * skills. Far more substance than Exa's SEO-meta scrape of a LinkedIn
 * profile page (which is just a hashed title because the rest is
 * auth-walled).
 */
/**
 * Deep LinkedIn scrape. Per Jack: "the linkedin scrape isnt deep enough."
 *
 * Strategy changes (May 2026):
 *  - DEFAULT premium=true. ScrapingDog's premium tier returns the FULL
 *    profile JSON (vs. a thin meta payload on the free tier) — recent
 *    activity, full experience descriptions, certifications, awards,
 *    volunteer history, projects, publications. The credit cost is ~5x
 *    but the data is ~10x. Without premium, the scrape would fall back
 *    to a one-line headline and we'd lose every signal that makes the
 *    twin's opener actually personal. If premium fails (rare 5xx), we
 *    fall through to a non-premium retry as a safety net.
 *  - Lifted EVERY artificial cap:
 *      about         1,500 → 6,000 chars
 *      experience    6 entries → 20, per-role desc 240 → 2,000 chars
 *      education     4 → 10
 *      skills        10 → 60
 *  - Pull every field LinkedIn surfaces and ScrapingDog returns:
 *      certifications, courses, languages, honors_and_awards, projects,
 *      publications, organizations, volunteer_experience, recommendations,
 *      activities (recent posts), articles, featured items.
 *    These are the "what is this person actually doing right now /
 *    what are they proud of" signals — exactly what the opener needs
 *    to feel like the inviter actually read the profile.
 */
async function scrapingDogLinkedIn(handle: string): Promise<string> {
  if (!SCRAPINGDOG_API_KEY) throw new Error("SCRAPINGDOG_API_KEY missing");

  async function callOnce(premium: boolean): Promise<Response> {
    const url = `https://api.scrapingdog.com/linkedin?api_key=${encodeURIComponent(
      SCRAPINGDOG_API_KEY!
    )}&type=profile&linkId=${encodeURIComponent(handle)}&premium=${
      premium ? "true" : "false"
    }`;
    return fetch(url, { method: "GET" });
  }

  // Premium-first. The free tier on ScrapingDog's LinkedIn endpoint
  // returns sparse data; premium is what unlocks the full record. If
  // premium fails (5xx), retry non-premium as a fallback so we still
  // get SOMETHING back rather than throwing.
  let res = await callOnce(true);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(
      `[scrape] LinkedIn ${handle} premium call failed (${res.status}), retrying non-premium`
    );
    res = await callOnce(false);
    if (!res.ok) {
      const body2 = await res.text().catch(() => "");
      throw new Error(
        `ScrapingDog LinkedIn ${res.status}: ${(body || body2).slice(0, 200)}`
      );
    }
  }
  // Defensive JSON parse — ScrapingDog sometimes returns HTML for
  // rate-limit / captcha errors. Direct .json() throws SyntaxError that
  // leaks to the UI.
  const rawText = await res.text().catch(() => "");
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    throw new Error(
      `ScrapingDog LinkedIn returned non-JSON for ${handle} (likely captcha): ${rawText
        .slice(0, 160)
        .replace(/\s+/g, " ")}`
    );
  }
  // Response is sometimes an array (one item per requested profile), sometimes
  // a single object. Normalize to a single record.
  const p = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  if (!p || typeof p !== "object") {
    throw new Error("ScrapingDog LinkedIn returned no usable record");
  }

  // Helper: pluck the first non-empty string from a list of candidate
  // field names. ScrapingDog drifts between snake_case / camelCase /
  // PascalCase across response versions; this normalizes it.
  function pick(...keys: string[]): string {
    for (const k of keys) {
      const v = (p as any)[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  }
  function pickArray(...keys: string[]): Array<Record<string, unknown>> {
    for (const k of keys) {
      const v = (p as any)[k];
      if (Array.isArray(v) && v.length > 0)
        return v as Array<Record<string, unknown>>;
    }
    return [];
  }

  const name =
    pick("fullName", "full_name") ||
    `${pick("first_name", "firstName")} ${pick("last_name", "lastName")}`.trim() ||
    handle;
  const headline = pick("headline", "title", "current_position");
  const about = pick("about", "summary", "description");
  const location = pick("location", "geo_location", "city", "country");
  // ScrapingDog returns the LinkedIn profile photo under wildly
  // different keys depending on the response version + whether premium
  // was used. Catch every variant we've observed in production — Jack:
  // "The profile photo extraction from LinkedIn isn't working properly."
  const profilePhoto = pick(
    "profile_photo",
    "profilePhoto",
    "profile_photo_url",
    "profilePhotoUrl",
    "profile_image",
    "profileImage",
    "profile_image_url",
    "profileImageUrl",
    "profile_pic",
    "profile_pic_url",
    "profilePicUrl",
    "profile_picture",
    "profile_picture_url",
    "profilePictureUrl",
    "picture",
    "picture_url",
    "pictureUrl",
    "image",
    "image_url",
    "imageUrl",
    "image_link",
    "imageLink",
    "avatar",
    "avatar_url",
    "avatarUrl",
    "headshot",
    "headshot_url",
    "photo",
    "photo_url",
    "photoUrl"
  );
  // Public website/portfolio links surfaced on the profile (the "contact
  // info" section). Useful for the twin to reference the recipient's
  // real work, not just the LinkedIn snippet.
  const websiteUrl = pick("website", "websiteUrl", "personal_website");

  // === EXPERIENCE — lifted cap (6 → 20), full descriptions (240 → 2000) ===
  const expRows = pickArray("experience", "positions", "experiences", "work_experience");
  const experiences = expRows
    .slice(0, 20)
    .map((e) => {
      const role =
        (e.title as string) ||
        (e.position as string) || (e.role as string) ||
        (e.position_title as string) || "";
      const company =
        (e.company as string) ||
        (e.companyName as string) ||
        (e.company_name as string) ||
        (e.organization as string) || "";
      const duration =
        (e.duration as string) ||
        (e.dateRange as string) ||
        (e.date_range as string) ||
        `${(e.start_date as string) || ""}${
          (e.end_date as string) ? ` – ${e.end_date}` : ""
        }`;
      const locRow =
        (e.location as string) || (e.company_location as string) || "";
      // Full description — was being chopped to 240 chars which lost the
      // bullet-pointed accomplishments that make a profile interesting.
      const desc =
        typeof e.description === "string"
          ? (e.description as string).slice(0, 2000)
          : "";
      const parts = [
        role,
        company && `at ${company}`,
        duration && `(${duration})`,
        locRow && `[${locRow}]`
      ]
        .filter(Boolean)
        .join(" ");
      return desc ? `${parts}.\n${desc}` : parts;
    })
    .filter(Boolean);

  // === EDUCATION — 4 → 10 ===
  const eduRows = pickArray("education", "educations");
  const education = eduRows
    .slice(0, 10)
    .map((e) => {
      const school =
        (e.school as string) ||
        (e.institution as string) ||
        (e.college_name as string) ||
        (e.name as string) || "";
      const degree =
        (e.degree as string) ||
        (e.college_degree as string) || "";
      const field =
        (e.field as string) ||
        (e.field_of_study as string) ||
        (e.college_degree_field as string) || "";
      const dates =
        (e.duration as string) ||
        (e.date_range as string) ||
        `${(e.start_year as string) || ""}${
          (e.end_year as string) ? ` – ${e.end_year}` : ""
        }`;
      const desc =
        typeof e.description === "string"
          ? (e.description as string).slice(0, 600)
          : "";
      const parts = [school, [degree, field].filter(Boolean).join(", "), dates]
        .filter(Boolean)
        .join(" — ");
      return desc ? `${parts}. ${desc}` : parts;
    })
    .filter(Boolean);

  // === SKILLS — 10 → 60 ===
  const skills = Array.isArray((p as any).skills)
    ? ((p as any).skills as Array<unknown>)
        .map((s) =>
          typeof s === "string"
            ? s
            : (s as any)?.name || (s as any)?.skill || (s as any)?.title
        )
        .filter(Boolean)
        .slice(0, 60)
    : [];

  // === CERTIFICATIONS ===
  const certs = pickArray("certifications", "certification", "licenses")
    .slice(0, 15)
    .map((c) => {
      const title = (c.name as string) || (c.title as string) || "";
      const issuer =
        (c.issuer as string) ||
        (c.organization as string) ||
        (c.company_name as string) || "";
      const year =
        (c.year as string) ||
        (c.issue_date as string) ||
        (c.date as string) || "";
      return [title, issuer && `(${issuer})`, year].filter(Boolean).join(" ");
    })
    .filter(Boolean);

  // === LANGUAGES ===
  const languages = pickArray("languages")
    .slice(0, 10)
    .map((l) => {
      const lang = (l.name as string) || (l.language as string) || "";
      const prof = (l.proficiency as string) || (l.fluency as string) || "";
      return prof ? `${lang} (${prof})` : lang;
    })
    .filter(Boolean);

  // === HONORS / AWARDS ===
  const awards = pickArray("honors", "awards", "honors_and_awards", "accomplishments")
    .slice(0, 12)
    .map((a) => {
      const title = (a.title as string) || (a.name as string) || "";
      const issuer = (a.issuer as string) || (a.organization as string) || "";
      const desc =
        typeof a.description === "string"
          ? (a.description as string).slice(0, 400)
          : "";
      const head = [title, issuer && `— ${issuer}`].filter(Boolean).join(" ");
      return desc ? `${head}. ${desc}` : head;
    })
    .filter(Boolean);

  // === PROJECTS ===
  const projects = pickArray("projects", "project")
    .slice(0, 10)
    .map((pr) => {
      const title = (pr.title as string) || (pr.name as string) || "";
      const desc =
        typeof pr.description === "string"
          ? (pr.description as string).slice(0, 800)
          : "";
      return desc ? `${title}: ${desc}` : title;
    })
    .filter(Boolean);

  // === PUBLICATIONS ===
  const publications = pickArray("publications", "publication")
    .slice(0, 10)
    .map((pub) => {
      const title = (pub.title as string) || (pub.name as string) || "";
      const publisher = (pub.publisher as string) || (pub.publication as string) || "";
      const year = (pub.date as string) || (pub.year as string) || "";
      const desc =
        typeof pub.description === "string"
          ? (pub.description as string).slice(0, 600)
          : "";
      const head = [title, publisher && `(${publisher})`, year].filter(Boolean).join(" ");
      return desc ? `${head}. ${desc}` : head;
    })
    .filter(Boolean);

  // === VOLUNTEER ===
  const volunteer = pickArray("volunteer", "volunteer_experience", "volunteering")
    .slice(0, 10)
    .map((v) => {
      const role = (v.role as string) || (v.title as string) || "";
      const org = (v.organization as string) || (v.company as string) || "";
      const dates = (v.duration as string) || (v.date_range as string) || "";
      const desc =
        typeof v.description === "string"
          ? (v.description as string).slice(0, 600)
          : "";
      const head = [role, org && `at ${org}`, dates && `(${dates})`].filter(Boolean).join(" ");
      return desc ? `${head}. ${desc}` : head;
    })
    .filter(Boolean);

  // === ORGANIZATIONS ===
  const organizations = pickArray("organizations")
    .slice(0, 10)
    .map((o) => {
      const name = (o.name as string) || (o.title as string) || "";
      const role = (o.position as string) || (o.role as string) || "";
      return role ? `${name} — ${role}` : name;
    })
    .filter(Boolean);

  // === COURSES ===
  const courses = pickArray("courses")
    .slice(0, 15)
    .map((c) => {
      const name = (c.name as string) || (c.title as string) || "";
      const provider = (c.provider as string) || (c.institution as string) || "";
      return provider ? `${name} (${provider})` : name;
    })
    .filter(Boolean);

  // === RECENT ACTIVITY / POSTS — the strongest "what is this person
  // actually thinking about right now" signal. Many openers improve
  // dramatically with even ONE recent post quoted. ===
  const activities = pickArray("activities", "recent_posts", "posts", "updates", "activity")
    .slice(0, 12)
    .map((a) => {
      const text =
        (a.text as string) ||
        (a.content as string) ||
        (a.title as string) ||
        (a.activity as string) || "";
      const link =
        (a.url as string) ||
        (a.link as string) ||
        (a.permalink as string) || "";
      return link ? `${text.slice(0, 800)} (${link})` : text.slice(0, 800);
    })
    .filter(Boolean);

  // === ARTICLES (LinkedIn long-form) ===
  const articles = pickArray("articles", "long_form")
    .slice(0, 8)
    .map((a) => {
      const title = (a.title as string) || (a.name as string) || "";
      const link = (a.url as string) || (a.link as string) || "";
      const desc =
        typeof a.description === "string"
          ? (a.description as string).slice(0, 500)
          : "";
      const head = link ? `${title} (${link})` : title;
      return desc ? `${head}. ${desc}` : head;
    })
    .filter(Boolean);

  // === RECOMMENDATIONS — what others say about them. Pure gold for
  // openers because it's third-party validation. ===
  const recommendations = pickArray("recommendations", "recommendation")
    .slice(0, 8)
    .map((r) => {
      const author = (r.name as string) || (r.author as string) || "";
      const role =
        (r.position as string) ||
        (r.title as string) ||
        (r.relationship as string) || "";
      const text =
        typeof r.text === "string"
          ? (r.text as string).slice(0, 800)
          : typeof r.description === "string"
          ? (r.description as string).slice(0, 800)
          : "";
      const head = [author, role && `(${role})`].filter(Boolean).join(" ");
      return text ? `${head}: ${text}` : head;
    })
    .filter(Boolean);

  // Substance check — broader now that we extract more. Need at least
  // ONE of headline / about / experience / education / activity, OR
  // a real name (≥2 chars, distinct from the handle).
  const hasRealName =
    typeof name === "string" &&
    name.trim().length > 2 &&
    name.replace(/[\s-]/g, "").toLowerCase() !==
      handle.replace(/[\s-]/g, "").toLowerCase();
  if (
    !headline &&
    !about &&
    experiences.length === 0 &&
    eduRows.length === 0 &&
    activities.length === 0 &&
    !hasRealName
  ) {
    throw new Error(
      `ScrapingDog LinkedIn returned only metadata for ${handle} (no headline, about, experience, education, or activity).`
    );
  }

  // Build the rich payload. Empty arrays are dropped by the JSON
  // flattener so the prompt stays focused on what's actually there.
  return flatten(
    {
      handle: `linkedin.com/in/${handle}`,
      name,
      headline,
      location,
      website: websiteUrl,
      about: about ? about.slice(0, 6000) : "",
      profile_image: profilePhoto,
      experience: experiences,
      education,
      skills,
      certifications: certs,
      languages,
      honors_and_awards: awards,
      projects,
      publications,
      volunteer_experience: volunteer,
      organizations,
      courses,
      recent_activity: activities,
      articles,
      recommendations
    },
    0
  );
}

async function scrapingDogX(handle: string): Promise<string> {
  if (!SCRAPINGDOG_API_KEY) throw new Error("SCRAPINGDOG_API_KEY missing");
  const url = `https://api.scrapingdog.com/twitter/profile?api_key=${encodeURIComponent(
    SCRAPINGDOG_API_KEY
  )}&handle=${encodeURIComponent(handle)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(
      `ScrapingDog X ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`
    );
  }
  // Defensive JSON parse — ScrapingDog returns HTML for some failure modes
  // (rate-limit, captcha, account suspended). The previous direct
  // `await res.json()` threw an "Unexpected token" SyntaxError that
  // leaked to the UI. Read as text first, then parse, so we can convert
  // a non-JSON response into a clean error instead.
  const rawText = await res.text().catch(() => "");
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    throw new Error(
      `ScrapingDog X returned non-JSON for @${handle} (likely captcha or suspended account): ${rawText
        .slice(0, 160)
        .replace(/\s+/g, " ")}`
    );
  }
  const p =
    (j.profile as Record<string, unknown>) ||
    (j.user as Record<string, unknown>) ||
    (j.data as Record<string, unknown>) ||
    j;
  const name = (p.name as string) || (p.fullName as string) || handle;
  const bio = (p.description as string) || (p.bio as string) || "";
  // Follower count intentionally NOT extracted.
  const tweets =
    (j.tweets as any[]) ||
    (p.tweets as any[]) ||
    (p.recent_tweets as any[]) ||
    [];
  const tweetTexts = tweets
    .slice(0, 20)
    .map((t) => (t?.text as string) || (t?.full_text as string) || "")
    .filter(Boolean);

  if (!bio && tweetTexts.length === 0 && !name) {
    throw new Error("ScrapingDog X returned empty payload");
  }
  return flatten(
    {
      handle: `@${handle}`,
      name,
      bio,
      recent_tweets: tweetTexts
    },
    0
  );
}

async function apifyRun(
  actor: string,
  input: Record<string, unknown>,
  timeoutSec = 45
): Promise<unknown[]> {
  if (!APIFY_TOKEN) {
    throw new Error("APIFY_TOKEN missing");
  }
  // run-sync-get-dataset-items: kicks off the actor and waits for output in
  // one HTTP call. Slug must be the dotless form (org~name).
  const slug = actor.replace("/", "~");
  const url =
    `https://api.apify.com/v2/acts/${slug}/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(APIFY_TOKEN)}` +
    `&timeout=${timeoutSec}&memory=1024&format=json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Apify ${actor} failed (HTTP ${res.status}): ${detail.slice(0, 200)}`
    );
  }
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? data : [];
}

function flatten(value: unknown, depth = 0): string {
  if (depth > 4) return "";
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => flatten(v, depth + 1)).join("\n");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${flatten(v, depth + 1)}`)
      .join("\n");
  }
  return "";
}

/**
 * Multi-actor X scraper with redundancy. Tries apidojo/tweet-scraper first
 * (most popular, but its output shape drifts between revisions), then
 * apify/twitter-scraper-lite, then quacker/twitter-scraper. Whichever
 * returns usable tweets wins. If all three return empty/garbage, throws.
 */
async function scrapeXProfile(url: string): Promise<string> {
  const handle = handleFromUrl(url);
  if (!handle) throw new Error("Could not parse X handle from URL");

  const actors: Array<{
    slug: string;
    input: Record<string, unknown>;
  }> = [
    {
      slug: "apidojo/tweet-scraper",
      input: { twitterHandles: [handle], maxItems: 25, sort: "Latest" }
    },
    {
      slug: "apify/twitter-scraper-lite",
      input: {
        searchTerms: [`from:${handle}`],
        maxItems: 25,
        sortBy: "Latest"
      }
    },
    {
      slug: "quacker/twitter-scraper",
      input: {
        handles: [handle],
        tweetsDesired: 25,
        addUserInfo: true
      }
    }
  ];

  let items: unknown[] = [];
  let triedActors: string[] = [];
  for (const a of actors) {
    triedActors.push(a.slug);
    try {
      const got = await apifyRun(a.slug, a.input, 50);
      if (got.length > 0) {
        items = got;
        console.log(
          `[scrape:x] actor ${a.slug} returned ${got.length} items for @${handle}`
        );
        break;
      }
      console.warn(`[scrape:x] actor ${a.slug} returned 0 items for @${handle}`);
    } catch (e) {
      console.warn(`[scrape:x] actor ${a.slug} threw:`, e);
    }
  }
  if (items.length === 0) {
    throw new Error(
      `All X actors returned empty for @${handle}. Tried: ${triedActors.join(", ")}.`
    );
  }
  // Field shapes drift between actor revisions: tweets may live under
  // text / fullText / full_text / tweet, author/user under author / user /
  // tweetBy. Read them all defensively and fall back to flattening the
  // raw item if structured extraction whiffs entirely.
  const tweets: string[] = [];
  for (const t of items as Array<Record<string, unknown>>) {
    const txt =
      (t?.text as string) ??
      (t?.fullText as string) ??
      (t?.full_text as string) ??
      (t?.tweet as string) ??
      "";
    if (typeof txt === "string" && txt.trim()) tweets.push(txt.trim());
  }
  const a0 =
    ((items[0] as any)?.author as Record<string, unknown>) ||
    ((items[0] as any)?.user as Record<string, unknown>) ||
    ((items[0] as any)?.tweetBy as Record<string, unknown>) ||
    {};
  const bio =
    (a0.description as string) ||
    (a0.bio as string) ||
    (a0.profile_description as string) ||
    "";
  const name =
    (a0.name as string) ||
    (a0.fullName as string) ||
    (a0.displayName as string) ||
    handle;
  // Follower count intentionally NOT extracted.

  // SUBSTANCE CHECK — same idea as the IG version. If we only have a
  // handle (no real name, no bio, fewer than 2 substantive tweets), we
  // produce "@jackjayio on X\n\nRecent posts:\n• rt" which gives the
  // LLM nothing to work with and the opener ends up just mentioning
  // the handle. Throw so the outer chain falls through to ScrapingDog.
  const hasRealName =
    typeof name === "string" &&
    name.trim().length > 1 &&
    name.toLowerCase() !== handle.toLowerCase();
  const hasBio = typeof bio === "string" && bio.trim().length > 5;
  // Substantive tweets: >20 chars AND not just an @mention or RT marker.
  const substantiveTweets = tweets.filter(
    (t) =>
      t.trim().length > 20 &&
      !/^(rt\s+@|@\w+\s*$)/i.test(t.trim())
  );
  const hasUsableTweets = substantiveTweets.length >= 2;

  if (!hasRealName && !hasBio && !hasUsableTweets) {
    // Last-ditch: dump the first item's raw flattened shape if it's
    // got SOMETHING beyond just the handle. Otherwise throw and let
    // the outer chain try a different vendor.
    const raw = flatten(items[0]).slice(0, 2000);
    if (raw.trim().length > 80 && !/^handle:\s*@?\w+\s*$/i.test(raw.trim())) {
      return raw;
    }
    throw new Error(
      `Apify X returned only metadata for @${handle} (no bio, no real name, no substantive tweets). Falling through to next vendor.`
    );
  }

  const lines: string[] = [];
  lines.push(`${name} (@${handle}) on X`);
  if (bio) lines.push(`Bio: ${bio}`);
  if (substantiveTweets.length > 0) {
    lines.push("Recent posts:");
    lines.push("• " + substantiveTweets.slice(0, 15).join("\n• "));
  }
  return lines.join("\n\n");
}

/**
 * Multi-actor Instagram scraper with redundancy. Tries apify/instagram-scraper
 * first (free tier, directUrls input), falls back to apify/instagram-api-scraper
 * (faster, returns profile JSON), then dtrungtin/instagram-profile-scraper
 * (community alternative). Whichever returns usable profile data wins.
 */
async function scrapeInstagramProfile(url: string): Promise<string> {
  const handle = handleFromUrl(url);
  if (!handle) throw new Error("Could not parse Instagram handle from URL");

  const actors: Array<{
    slug: string;
    input: Record<string, unknown>;
  }> = [
    // Variant 1: details mode — should return profile + recent posts in
    // one shot. Free-tier-compatible. When it works this is everything
    // we need in a single call.
    {
      slug: "apify/instagram-scraper",
      input: {
        directUrls: [url],
        resultsType: "details",
        resultsLimit: 10,
        addParentData: false
      }
    },
    // Variant 2: posts mode — explicitly request post objects with
    // captions. Use this if the details mode came back light on posts.
    {
      slug: "apify/instagram-scraper",
      input: {
        directUrls: [url],
        resultsType: "posts",
        resultsLimit: 12,
        addParentData: false
      }
    },
    {
      slug: "apify/instagram-api-scraper",
      input: { usernames: [handle] }
    },
    {
      slug: "dtrungtin/instagram-profile-scraper",
      input: { usernames: [handle] }
    }
  ];

  let items: unknown[] = [];
  let triedActors: string[] = [];
  for (const a of actors) {
    triedActors.push(a.slug);
    try {
      const got = await apifyRun(a.slug, a.input, 60);
      if (got.length > 0) {
        items = got;
        console.log(
          `[scrape:ig] actor ${a.slug} returned ${got.length} items for @${handle}`
        );
        break;
      }
      console.warn(`[scrape:ig] actor ${a.slug} returned 0 items for @${handle}`);
    } catch (e) {
      console.warn(`[scrape:ig] actor ${a.slug} threw:`, e);
    }
  }
  if (items.length === 0) {
    throw new Error(
      `All Instagram actors returned empty for @${handle}. Tried: ${triedActors.join(", ")}.`
    );
  }

  // Heuristically locate the profile row (has biography or fullName) and
  // any post rows (have caption or shortCode). Some actor revisions return
  // a single profile object with latestPosts inline — handle both.
  let profile: Record<string, unknown> | null = null;
  const posts: Array<Record<string, unknown>> = [];
  for (const it of items as Array<Record<string, unknown>>) {
    if (it && (it.biography !== undefined || it.fullName !== undefined)) {
      profile = it;
      if (Array.isArray(it.latestPosts)) {
        for (const lp of it.latestPosts as Array<Record<string, unknown>>) {
          posts.push(lp);
        }
      }
    } else if (it && (it.caption !== undefined || it.shortCode !== undefined)) {
      posts.push(it);
    }
  }
  if (!profile) {
    profile = items[0] as Record<string, unknown>;
  }
  const captions = posts
    .map((p) => (typeof p.caption === "string" ? p.caption : ""))
    .filter(Boolean)
    .slice(0, 8);

  // Enrich extraction: pull profile image, bio links, and external URL.
  // For an IG profile the image + bio + first few captions + any links in
  // the bio give the LLM enough specific signal to write a real opener.
  const profilePic =
    (profile.profile_pic_url_hd as string) ||
    (profile.profilePicUrl as string) ||
    (profile.profile_pic_url as string) ||
    "";
  const bioLinks = Array.isArray((profile as any).biographyExternalUrls)
    ? ((profile as any).biographyExternalUrls as any[])
        .map((b) =>
          typeof b === "string" ? b : b?.url || b?.external_url || ""
        )
        .filter(Boolean)
    : Array.isArray((profile as any).bio_links)
    ? ((profile as any).bio_links as any[])
        .map((b) =>
          typeof b === "string" ? b : b?.url || b?.external_url || ""
        )
        .filter(Boolean)
    : [];

  // SUBSTANCE CHECK — if we got a profile row back but it has NO bio,
  // NO real name, AND no captions, the scrape is functionally empty
  // and we should throw so the caller can fall through to a different
  // vendor (ScrapingDog). Before this check, scrapeInstagramProfile
  // would return a thin "handle: @ethos" string that passed the chain's
  // success path — opener ended up just mentioning the username.
  const hasRealName =
    typeof profile.fullName === "string" &&
    (profile.fullName as string).trim().length > 1;
  const hasBio =
    typeof profile.biography === "string" &&
    (profile.biography as string).trim().length > 5;
  const hasCaptions = captions.length > 0;
  if (!hasRealName && !hasBio && !hasCaptions) {
    throw new Error(
      `Apify IG returned only metadata for @${handle} (no bio, no captions). Falling through to next vendor.`
    );
  }

  return flatten(
    {
      handle: `@${handle}`,
      fullName: profile.fullName,
      biography: profile.biography,
      external_url: profile.externalUrl ?? (profile as any).external_url,
      bio_links: bioLinks,
      profile_image: profilePic,
      posts: profile.postsCount,
      latestPosts: captions
    },
    0
  );
}

/**
 * scrapePublicProfile — the chain.
 *
 * CRITICAL FIX (May 2026): for X / Instagram / Facebook URLs we now SKIP
 * Exa entirely and go straight to Apify. The previous chain called Exa
 * first, and Exa just returned the page <title> for those auth-walled
 * platforms (e.g. "Jack Jay (@jackjay.io) · Instagram photos and videos",
 * ~100 chars) which passed our `length > 80` gate, so Apify never ran
 * and the LLM got only the title to work with — producing the substance-
 * less openers Jack reported.
 *
 * The new order:
 *   - Social URL → Apify multi-actor chain only. If all actors fail,
 *     throw (don't silently return the Exa title).
 *   - Non-social URL (LinkedIn public posts, blogs, Substack, Crunchbase) →
 *     Exa first (it works there), Apify fallback isn't applicable.
 */
export async function scrapePublicProfile(url: string): Promise<string> {
  // SOCIAL URLs — auth-walled, Exa can't reach past the page title.
  //
  // True cross-provider redundancy: try Apify first (we have a token,
  // multiple actors), then ScrapingDog (different vendor entirely with
  // dedicated IG + X endpoints). Whichever returns substance wins. Each
  // vendor is independently configurable via env var — if a key is
  // missing, that vendor is silently skipped.
  if (isXUrl(url)) {
    const handle = handleFromUrl(url) || "";
    const errors: string[] = [];
    if (APIFY_TOKEN) {
      try {
        return await scrapeXProfile(url);
      } catch (e: any) {
        errors.push(`apify: ${e?.message ?? e}`);
      }
    }
    if (SCRAPINGDOG_API_KEY && handle) {
      try {
        return await scrapingDogX(handle);
      } catch (e: any) {
        errors.push(`scrapingdog: ${e?.message ?? e}`);
      }
    }
    throw new Error(
      `Couldn't scrape @${handle} on X from any vendor. ${errors.join(" | ")}`
    );
  }
  if (isInstagramUrl(url)) {
    const handle = handleFromUrl(url) || "";
    const errors: string[] = [];
    if (APIFY_TOKEN) {
      try {
        return await scrapeInstagramProfile(url);
      } catch (e: any) {
        errors.push(`apify: ${e?.message ?? e}`);
      }
    }
    if (SCRAPINGDOG_API_KEY && handle) {
      try {
        return await scrapingDogInstagram(handle);
      } catch (e: any) {
        errors.push(`scrapingdog: ${e?.message ?? e}`);
      }
    }
    if (!APIFY_TOKEN && !SCRAPINGDOG_API_KEY) {
      throw new Error(
        "Instagram profiles can't be scraped without APIFY_TOKEN or SCRAPINGDOG_API_KEY — set one in env or paste a few sentences manually."
      );
    }
    throw new Error(
      `Couldn't scrape @${handle} on Instagram from any vendor. ${errors.join(" | ")}`
    );
  }

  // LINKEDIN URLs — Exa CAN reach the public meta but it's usually just
  // an SEO title ("Lucas Chu | LinkedIn"), which gave the LLM nothing to
  // work with and produced generic "noticed your professional path"
  // openers. Bypass Exa for LinkedIn unless the response actually
  // contains the headline + about text. If we have a ScrapingDog key,
  // prefer it — its LinkedIn endpoint returns the full headline +
  // about + experience.
  if (isLinkedInUrl(url)) {
    const handle = linkedInHandleFromUrl(url) || "";
    const errors: string[] = [];

    // 1. ScrapingDog LinkedIn — full headline + about + experience.
    if (SCRAPINGDOG_API_KEY && handle) {
      try {
        return await scrapingDogLinkedIn(handle);
      } catch (e: any) {
        errors.push(`scrapingdog: ${e?.message ?? e}`);
      }
    }

    // 2. Exa fallback — accept ONLY if substance is real (>300 chars
    //    AND not just the page title). Otherwise throw so the caller
    //    knows there's no usable scrape and can warn the LLM.
    let exa = "";
    try {
      exa = await exaGetContents(url);
    } catch {
      /* fall through */
    }
    if (exa) {
      const trimmed = exa.trim();
      const looksLikeTitleOnly =
        trimmed.length < 300 &&
        /\| linkedin/i.test(trimmed) &&
        !/(experience|about|headline|summary|education)/i.test(trimmed);
      if (trimmed.length > 80 && !looksLikeTitleOnly) {
        return trimmed;
      }
      errors.push(`exa: thin (${trimmed.length} chars, title-like)`);
    }

    // Log the provider-level reasons for the eng team, but surface a
    // user-friendly message — never leak ScrapingDog/Exa JSON to the UI.
    // Earlier version showed `{"message":"This profile is either premium
    // or does not exist..."}` directly in the onboarding card, which
    // looked like a broken app.
    console.warn(
      `[scrape] linkedin all-fallbacks-failed for ${handle}:`,
      errors.join(" | ")
    );
    throw new Error(
      `We couldn't pull this LinkedIn profile automatically. It might be a private/premium-only profile our scraper can't reach. Paste a paragraph from the profile into the text box below and your twin will still personalize from that.`
    );
  }

  // Everything else (blogs, Substack, Crunchbase, etc.) — Exa handles
  // these well since they're public HTML pages.
  let exaText = "";
  try {
    exaText = await exaGetContents(url);
  } catch {
    /* fall through */
  }
  if (exaText && exaText.trim().length > 80) {
    return exaText;
  }
  if (exaText && exaText.trim().length > 0) {
    return exaText;
  }

  throw new Error(
    "Couldn't fetch that URL. Paste a few sentences manually instead."
  );
}
