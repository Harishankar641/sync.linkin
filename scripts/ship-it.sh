#!/usr/bin/env bash
# SyncedIn — the ONE command. Everything that turns the codebase into a live,
# working production app, in order:
#   1. migrate    — apply schema.sql (new tables/columns) to Supabase
#   2. supabase   — Site URL, redirect allow-list, email template, autoconfirm
#   3. google     — enable Google OAuth from creds in .env.local
#   4. deploy     — push every env var to Vercel + build + ship to production
#
# Every step is idempotent and safe to re-run. If a step fails it stops so you
# see exactly where. Run:
#
#   bash scripts/ship-it.sh
#
set -u
cd "$(dirname "$0")/.."

line() { echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

line
echo "  SyncedIn — ship it  (4 steps)"
line

echo ""
echo "[1/4] Applying database schema…"
bash scripts/migrate.sh || {
  echo "✗ migrate failed — stopping."
  exit 1
}

echo ""
echo "[2/4] Configuring Supabase auth + email template…"
bash scripts/configure-supabase.sh || {
  echo "✗ Supabase config failed — stopping."
  exit 1
}

echo ""
echo "[3/4] Enabling Google sign-in…"
bash scripts/enable-google-oauth.sh
# non-fatal: if Google creds aren't in .env.local it just skips.

echo ""
echo "[4/4] Pushing env vars + deploying to production…"
# deploy.sh has the hang-proof env-push loop + the prod deploy.
bash scripts/deploy.sh || {
  echo "✗ deploy failed — stopping."
  exit 1
}

echo ""
line
echo "  Done. Open https://syncedin.org and sign in."
line
