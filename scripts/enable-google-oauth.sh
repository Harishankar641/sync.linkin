#!/usr/bin/env bash
# Enable Google sign-in on Supabase via the Management API.
# You still have to create the OAuth client in Google Cloud Console first
# (that part can't be automated) — then run:
#
#   bash scripts/enable-google-oauth.sh "<CLIENT_ID>" "<CLIENT_SECRET>"
#
set -u
cd "$(dirname "$0")/.."

CLIENT_ID="${1:-}"
CLIENT_SECRET="${2:-}"
# Fall back to .env.local so ship-it.sh can call this with no args.
if [ -z "$CLIENT_ID" ] && [ -f .env.local ]; then
  CLIENT_ID=$(grep -E "^GOOGLE_OAUTH_CLIENT_ID=" .env.local | head -n1 | cut -d'=' -f2-)
  CLIENT_SECRET=$(grep -E "^GOOGLE_OAUTH_CLIENT_SECRET=" .env.local | head -n1 | cut -d'=' -f2-)
fi
if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  echo "⚠  Google OAuth creds not provided and not in .env.local — skipping Google."
  exit 0
fi

TOKEN=$(grep -E "^SUPABASE_ACCESS_TOKEN=" .env.local | head -n1 | cut -d'=' -f2-)
URL=$(grep -E "^NEXT_PUBLIC_SUPABASE_URL=" .env.local | head -n1 | cut -d'=' -f2-)
REF=$(echo "$URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')

if [ -z "$TOKEN" ] || [ -z "$REF" ]; then
  echo "✗ SUPABASE_ACCESS_TOKEN or NEXT_PUBLIC_SUPABASE_URL missing in .env.local"
  exit 1
fi

echo "→ Enabling Google provider on project $REF …"

RESPONSE=$(curl -sS -X PATCH \
  "https://api.supabase.com/v1/projects/${REF}/config/auth" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"external_google_enabled\": true,
    \"external_google_client_id\": \"${CLIENT_ID}\",
    \"external_google_secret\": \"${CLIENT_SECRET}\"
  }" \
  -w "\nHTTP_STATUS:%{http_code}")

STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
if [ "$STATUS" = "200" ]; then
  echo "✓ Google sign-in is live. Test it on the /login page."
else
  echo "✗ HTTP $STATUS"
  echo "$RESPONSE" | sed '/HTTP_STATUS:/d'
  exit 1
fi
