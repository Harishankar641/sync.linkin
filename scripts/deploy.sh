#!/usr/bin/env bash
# SyncedIn — one-command deploy.
# Pushes all env vars from .env.local to Vercel (production/preview/development)
# then redeploys production. Designed NOT to hang: `yes |` answers any rm
# confirmation prompt, value is piped straight into `env add`.
#
#   bash scripts/deploy.sh
#
set -u
cd "$(dirname "$0")/.."

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SyncedIn deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f .env.local ]; then
  echo "✗ .env.local not found"
  exit 1
fi
if [ ! -d .vercel ]; then
  echo "✗ .vercel/ missing — run 'npx vercel' once to link the project first."
  exit 1
fi

# Prefer a global vercel binary (fast); fall back to npx (slower but works).
if command -v vercel >/dev/null 2>&1; then
  VERCEL="vercel"
else
  echo "Installing Vercel CLI globally (one-time)…"
  if npm install -g vercel >/dev/null 2>&1 && command -v vercel >/dev/null 2>&1; then
    VERCEL="vercel"
  else
    echo "  global install unavailable — using npx (slower)"
    VERCEL="npx vercel"
  fi
fi
echo "✓ vercel CLI ready"
echo ""

read_env() {
  grep -E "^${1}=" .env.local | head -n1 | sed -E "s/^${1}=//; s/^\"(.*)\"\$/\1/"
}

VARS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  ANTHROPIC_API_KEY
  NEXT_PUBLIC_APP_URL
  EXA_API_KEY
)

echo "Pushing ${#VARS[@]} env vars to Vercel…"
for v in "${VARS[@]}"; do
  val="$(read_env "$v")"
  if [ -z "$val" ]; then
    echo "  ⚠ $v not in .env.local — skipped"
    continue
  fi
  for env in production preview development; do
    # --yes skips rm's confirmation (it reads from the tty, not stdin, so a
    # piped `yes` never reaches it — that was the hang).
    $VERCEL env rm "$v" "$env" --yes >/dev/null 2>&1 </dev/null || true
    # value piped on stdin — env add takes it and exits, no prompt.
    printf '%s' "$val" | $VERCEL env add "$v" "$env" >/dev/null 2>&1 || true
  done
  echo "  ✓ $v"
done

echo ""
echo "Redeploying production…"
$VERCEL --prod

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done. Open https://syncedin.org"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
