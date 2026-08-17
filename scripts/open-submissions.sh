#!/usr/bin/env bash
# Open every directory + launchpad + backlink submission page in
# your default browser. Run from anywhere:
#   bash scripts/open-submissions.sh
#
# Pair this with SUBMISSION_PACKAGE.md (in repo root) — that file
# has every field's copy ready to paste. Each URL opens in a new tab.

set -e

URLS=(
  # Tier 1 — top AI directories (do today)
  "https://theresanaiforthat.com/submit"
  "https://www.toolify.ai/submit-new-tool"
  "https://www.futurepedia.io/submit-tool"
  "https://alternativeto.net/software/new/"
  "https://www.producthunt.com/posts/new"

  # Tier 2 — solid backlinks
  "https://topai.tools/submit"
  "https://aitools.fyi/submit"
  "https://www.aitoolhunt.com/submit-tool"
  "https://www.uneed.best/submit-a-tool"
  "https://www.saashub.com/submit-saas"
  "https://betalist.com/submit"

  # Tier 3 — community launches
  "https://news.ycombinator.com/submit"
  "https://www.indiehackers.com/post"
  "https://www.reddit.com/r/SideProject/submit"

  # Tier 4 — review platforms
  "https://my.g2.com/products/new"
  "https://www.capterra.com/vendors/"
)

echo "Opening ${#URLS[@]} submission pages…"
for url in "${URLS[@]}"; do
  open "$url"
  sleep 0.4   # tiny stagger so the browser doesn't drop tabs
done

echo ""
echo "✅ All ${#URLS[@]} tabs opened."
echo ""
echo "Copy-paste content from: SUBMISSION_PACKAGE.md"
echo "Each tab is one directory — submit, close, move to next."
echo "Expect ~30-45 min for the full pass."
