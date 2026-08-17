#!/usr/bin/env bash
# Configures Supabase Auth (Site URL, redirect URLs, email templates) via the
# Supabase Management API. Run this any time you want to update auth config
# without clicking around the dashboard.
#
# Requires SUPABASE_ACCESS_TOKEN in .env.local. Grab one at:
#   https://supabase.com/dashboard/account/tokens
#
# Run from project root:
#   bash scripts/configure-supabase.sh

set -u
cd "$(dirname "$0")/.."

# Load .env.local
if [ ! -f .env.local ]; then
  echo "✗ .env.local not found"
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env.local
set +a

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "✗ SUPABASE_ACCESS_TOKEN not set in .env.local."
  echo ""
  echo "  Grab one at: https://supabase.com/dashboard/account/tokens"
  echo "  Then add this line to .env.local:"
  echo "    SUPABASE_ACCESS_TOKEN=sbp_..."
  exit 1
fi

# Extract project ref from NEXT_PUBLIC_SUPABASE_URL
# Format: https://<ref>.supabase.co
REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')
if [ -z "$REF" ] || [ "$REF" = "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "✗ Could not extract project ref from NEXT_PUBLIC_SUPABASE_URL"
  exit 1
fi
echo "→ Configuring project: $REF"

APP_URL="${NEXT_PUBLIC_APP_URL:-https://twinlink-three.vercel.app}"
APP_URL="${APP_URL%/}"

# Read the branded magic link email template
EMAIL_TEMPLATE_PATH="supabase/email-template-magic-link.html"
if [ ! -f "$EMAIL_TEMPLATE_PATH" ]; then
  echo "✗ Email template not found at $EMAIL_TEMPLATE_PATH"
  exit 1
fi

# JSON-escape the template content (escape backslashes, double quotes, newlines)
EMAIL_TEMPLATE_JSON=$(python3 -c "
import json, sys
with open('$EMAIL_TEMPLATE_PATH', 'r') as f:
    print(json.dumps(f.read()))
")

# Build redirect allow-list (comma separated)
URI_ALLOW_LIST="${APP_URL}/auth/callback,http://localhost:3000/auth/callback"

echo "→ Site URL:           ${APP_URL}"
echo "→ Redirect allow-list: ${URI_ALLOW_LIST}"
echo "→ Magic-link template: ${EMAIL_TEMPLATE_PATH}"

# Build PATCH payload.
# mailer_autoconfirm: true → password signups are active immediately with no
# confirmation email. This makes password a true redundancy that does NOT
# depend on email delivery (which is the whole point). Magic links still work
# — the link itself is the verification.
PAYLOAD=$(cat <<EOF
{
  "site_url": "${APP_URL}",
  "uri_allow_list": "${URI_ALLOW_LIST}",
  "mailer_autoconfirm": true,
  "mailer_subjects_magic_link": "Sign in to SyncedIn",
  "mailer_templates_magic_link_content": ${EMAIL_TEMPLATE_JSON}
}
EOF
)

RESPONSE=$(curl -sS -X PATCH \
  "https://api.supabase.com/v1/projects/${REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}" \
  -w "\nHTTP_STATUS:%{http_code}")

STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
  echo "✓ Auth config updated"
else
  echo "✗ HTTP $STATUS"
  echo "$BODY"
  exit 1
fi

echo ""
echo "Done. Verify at: https://supabase.com/dashboard/project/${REF}/auth/url-configuration"
