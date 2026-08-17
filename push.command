#!/bin/bash
# Double-click in Finder to push every queued commit AND any pending edits.
# Clears stuck git locks, commits anything staged with a default message,
# then pushes to GitHub. Vercel auto-deploys after the push.
cd "$(dirname "$0")" || exit 1
rm -f .git/HEAD.lock .git/index.lock 2>/dev/null

# Commit any pending file changes (skipped if working tree is clean).
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "=== auto-committing pending edits ==="
  git add -A
  git commit -m "wip: edits from claude session $(date +%Y-%m-%d_%H-%M)"
fi

echo ""
echo "=== local commits ahead of origin ==="
git log --oneline origin/main..main 2>/dev/null || git log --oneline -5
echo ""
echo "=== pushing ==="
git push 2>&1
echo ""
echo "=== done — close this window when ready ==="
read -n 1 -s -r -p "Press any key to close..."
