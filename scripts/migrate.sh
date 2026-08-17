#!/usr/bin/env bash
# Run the full schema against Supabase via the Management API.
# schema.sql is idempotent (create ... if not exists / drop policy if exists),
# so this is safe to run any time — it just brings the DB up to date.
#
#   bash scripts/migrate.sh
#
set -u
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then echo "✗ .env.local not found"; exit 1; fi

TOKEN=$(grep -E "^SUPABASE_ACCESS_TOKEN=" .env.local | head -n1 | cut -d'=' -f2-)
URL=$(grep -E "^NEXT_PUBLIC_SUPABASE_URL=" .env.local | head -n1 | cut -d'=' -f2-)
REF=$(echo "$URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')

if [ -z "$TOKEN" ] || [ -z "$REF" ]; then
  echo "✗ SUPABASE_ACCESS_TOKEN or NEXT_PUBLIC_SUPABASE_URL missing in .env.local"
  exit 1
fi

echo "→ Applying supabase/schema.sql to project $REF …"

# JSON-encode the whole schema file as the query payload.
PAYLOAD=$(python3 -c "
import json
with open('supabase/schema.sql') as f:
    print(json.dumps({'query': f.read()}))
")

RESPONSE=$(curl -sS -X POST \
  "https://api.supabase.com/v1/projects/${REF}/database/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -w "\nHTTP_STATUS:%{http_code}")

STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  echo "✓ Schema applied. agreement_responses + all tables are up to date."
else
  echo "✗ HTTP $STATUS"
  echo "$BODY"
  exit 1
fi
