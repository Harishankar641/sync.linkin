/**
 * IndexNow key file. Bing / Yandex / Naver fetch this to verify we
 * own the key we submit with. Must return EXACTLY the key string,
 * plain text, no newline drama.
 *
 * If you ever rotate INDEXNOW_KEY in /api/indexnow/route.ts, rename
 * this directory to match the new key (the directory name IS the key)
 * and update the body below.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response("8e7c4f3a2b1d9e6f5c8a7b4d2e9f1c3a", {
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}
