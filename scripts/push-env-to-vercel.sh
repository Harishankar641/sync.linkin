#!/usr/bin/env bash
# Push the 5 TwinLink env vars from .env.local up to the linked Vercel project,
# across production / preview / development. Idempotent — re-running replaces
# any existing values.
#
# Run from the project root:
#   bash scripts/push-env-to-vercel.sh

set -u
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "✗ .env.local not found at $(pwd)/.env.local"
  exit 1
fi

if [ ! -d .vercel ]; then
  echo "✗ .vercel/ not found — run 'npx vercel' once first to link the project."
  exit 1
fi

VARS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  ANTHROPIC_API_KEY
  NEXT_PUBLIC_APP_URL
  EXA_API_KEY
)

# Read a value from .env.local by key, stripping optional surrounding quotes.
read_env() {
  local key="$1"
  grep -E "^${key}=" .env.local \
    | head -n1 \
    | sed -E "s/^${key}=//; s/^\"(.*)\"$/\1/; s/^'(.*)'\$/\1/"
}

for var in "${VARS[@]}"; do
  value=$(read_env "$var")
  if [ -z "$value" ]; then
    echo "⚠  $var not set in .env.local — skipping"
    continue
  fi

  echo "→ $var"
  for env in production preview development; do
    # Remove any existing value silently (so add doesn't conflict).
    npx --no vercel env rm "$var" "$env" --yes >/dev/null 2>&1 || true
    # Add new value via stdin.
    printf "%s" "$value" | npx --no vercel env add "$var" "$env" >/dev/null 2>&1 \
      && echo "   ✓ $env" \
      || echo "   ✗ $env failed"
  done
done

echo ""
echo "Done. Redeploy with:"
echo "  npx vercel --prod"
