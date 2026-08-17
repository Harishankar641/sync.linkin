// Build-time version stamp. Vercel auto-injects VERCEL_GIT_COMMIT_SHA
// at build time but ONLY exposes it to server code. The Footer is a
// client component so it needs the NEXT_PUBLIC_ prefixed variant — which
// Vercel mirrors automatically. Without this prefix the client bundle
// reads `undefined` and falls back to "dev" forever, which is why every
// successful build kept showing the same stale SHA in the footer.
const SHA =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  "";

export const BUILD_SHA = SHA.slice(0, 7) || "dev";

export const BUILD_DATE =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_DATE ||
  process.env.VERCEL_GIT_COMMIT_AUTHOR_DATE ||
  new Date().toISOString();
