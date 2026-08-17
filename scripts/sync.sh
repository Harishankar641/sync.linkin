#!/usr/bin/env bash
# SyncedIn one-command deploy.
# Vercel is connected to github.com/theguysaccount/syncedin and auto-builds
# from main on every push. Syncing = deploying.
set -e
cd "$(dirname "$0")/.."

TOKEN=$(grep '^GITHUB_TOKEN=' .env.local | cut -d'=' -f2-)
REPO=$(grep '^GITHUB_REPO=' .env.local | cut -d'=' -f2-)
if [ -z "$TOKEN" ] || [ -z "$REPO" ]; then
  echo "GITHUB_TOKEN or GITHUB_REPO missing in .env.local"
  exit 1
fi
REMOTE="https://${TOKEN}@github.com/${REPO}.git"

if [ ! -d .git ]; then
  git init -b main >/dev/null
  git config user.email "jacksonjezio@gmail.com"
  git config user.name "Jack Jesionowski"
fi

if git remote | grep -q "^origin$"; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

git add -A
MSG="${1:-deploy $(date '+%Y-%m-%d %H:%M:%S')}"
if git diff --cached --quiet; then
  echo "nothing new to commit; pushing HEAD"
else
  git commit -m "$MSG"
fi

git push -u origin main
echo "pushed. vercel build: https://vercel.com/jacksonjezio-7345s-projects/stillness-mint"
