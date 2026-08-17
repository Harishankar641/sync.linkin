import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * IndexNow URL submission endpoint. Open protocol jointly supported
 * by Bing, Yandex, Naver, Seznam — when content publishes or changes,
 * we POST the URL list to indexnow.org and every participating engine
 * gets notified instantly instead of waiting for the next crawl pass.
 *
 *   GET  /api/indexnow                → submit ALL canonical URLs
 *   GET  /api/indexnow?url=...        → submit a single URL
 *   POST /api/indexnow { urls: [...] } → submit a custom list
 *
 * Key file at /<key>.txt must contain just the key string. We host
 * that at /public/{KEY}.txt via the indexnow-key.txt route below.
 *
 * Reference: https://www.indexnow.org/documentation
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Self-generated 32-char hex key. Once committed, this stays stable —
// IndexNow validates the key by fetching https://syncedin.org/{KEY}.txt
// and confirming it contains this exact string. NOTE: Next.js 14 route.ts
// files cannot export non-handler constants (same class as #229 bug), so
// this is a module-scoped const — not exported. The key.txt file under
// /public mirrors the value independently.
const INDEXNOW_KEY = "8e7c4f3a2b1d9e6f5c8a7b4d2e9f1c3a";

const HOST = "syncedin.org";
const ENDPOINTS = [
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
  "https://searchadvisor.naver.com/indexnow"
];

async function buildAllUrls(): Promise<string[]> {
  const base = `https://${HOST}`;
  const urls: string[] = [
    `${base}/`,
    `${base}/faq`,
    `${base}/article`,
    `${base}/alternatives/linkedin`,
    `${base}/vs/lemlist`,
    `${base}/vs/clay`,
    `${base}/privacy`,
    `${base}/terms`,
    `${base}/support`,
    `${base}/careers`,
    `${base}/llms.txt`,
    `${base}/llms-full.txt`
  ];
  // Add every public portfolio with a handle set.
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("profiles")
      .select("handle")
      .not("handle", "is", null)
      .neq("is_test_persona", true)
      .limit(2000);
    for (const r of (data ?? []) as any[]) {
      if (r.handle) urls.push(`${base}/u/${r.handle}`);
    }
    // Add every poll page using the slug pattern.
    const { data: polls } = await service
      .from("polls")
      .select("id, question, status")
      .eq("status", "published")
      .limit(500);
    for (const p of (polls ?? []) as any[]) {
      const slug =
        (p.question ?? "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "poll";
      urls.push(`${base}/poll/${slug}-${String(p.id).slice(0, 8)}`);
    }
  } catch {
    /* silent — partial submission is still useful */
  }
  return urls;
}

async function pingEndpoints(urls: string[]) {
  const body = JSON.stringify({
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
    urlList: urls
  });
  return Promise.allSettled(
    ENDPOINTS.map((url) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body
      }).then((r) => ({ endpoint: url, status: r.status }))
    )
  );
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const single = u.searchParams.get("url");
    const urls = single ? [single] : await buildAllUrls();
    if (urls.length === 0) {
      return NextResponse.json(
        { error: "no_urls" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }
    const results = await pingEndpoints(urls);
    return NextResponse.json(
      {
        submitted: urls.length,
        sample_urls: urls.slice(0, 3),
        endpoints: results.map((r) =>
          r.status === "fulfilled"
            ? r.value
            : {
                endpoint: "unknown",
                status: "failed",
                reason: (r as any).reason?.message
              }
        )
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "indexnow_failed", detail: e?.message ?? String(e) },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

export async function POST(req: Request) {
  let body: { urls?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const urls = (body.urls ?? []).filter(
    (u) => typeof u === "string" && u.startsWith(`https://${HOST}/`)
  );
  if (urls.length === 0) {
    return NextResponse.json({ error: "no_valid_urls" }, { status: 400 });
  }
  const results = await pingEndpoints(urls);
  return NextResponse.json({
    submitted: urls.length,
    endpoints: results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { endpoint: "unknown", status: "failed", reason: (r as any).reason?.message }
    )
  });
}
