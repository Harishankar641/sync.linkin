#!/usr/bin/env bash
# ios-clean-archive.sh
#
# Nukes every cache that could cause Xcode to ship a stale archive,
# then re-runs the Capacitor + Pods stack so the next Product → Archive
# in Xcode actually picks up the patched Info.plist (NSContactsUsageDescription
# + 11 other purpose strings) and the bumped CFBundleVersion (1 → 2).
#
# Run from anywhere; the script cd's into the repo root.
#
#   bash ~/twinlink/scripts/ios-clean-archive.sh
#
# After it finishes, open Xcode → SyncedIn project → Product → Archive.
# DO NOT open Xcode while this is running.

set -euo pipefail

REPO="$HOME/twinlink"
cd "$REPO"

echo "==> 1/6  Killing any running Xcode (so caches are released)"
osascript -e 'tell application "Xcode" to quit' >/dev/null 2>&1 || true
sleep 1

echo "==> 2/6  Wiping Xcode DerivedData + ModuleCache (stale archives live here)"
rm -rf "$HOME/Library/Developer/Xcode/DerivedData"
rm -rf "$HOME/Library/Developer/Xcode/Archives/.tmp"*  2>/dev/null || true
rm -rf "$HOME/Library/Caches/com.apple.dt.Xcode"

echo "==> 3/6  Removing existing Pods + lock so we get a fresh resolve"
rm -rf ios/App/Pods
rm -f  ios/App/Podfile.lock

echo "==> 4/6  Re-running Capacitor sync (copies plugin assets into ios/)"
npx --yes cap sync ios

echo "==> 5/6  Installing CocoaPods (Capacitor pod for each plugin)"
cd ios/App
pod install --repo-update
cd "$REPO"

echo "==> 6/6  Verifying the privacy keys actually landed in Info.plist"
NUM_KEYS=$(grep -c "UsageDescription" ios/App/App/Info.plist || echo 0)
echo "    Info.plist now contains $NUM_KEYS *UsageDescription keys (expect ≥ 12)"

BUILD_NUM=$(grep -m1 "CURRENT_PROJECT_VERSION" ios/App/App.xcodeproj/project.pbxproj | awk '{print $3}' | tr -d ';')
echo "    CFBundleVersion (build number) is now: $BUILD_NUM (expect 2)"

cat <<'NEXT'

==================================================================
DONE. Now in Xcode:

  1. Open  ios/App/App.xcworkspace          (NOT the .xcodeproj)
  2. Top bar: select  Any iOS Device (arm64)
  3. Product → Clean Build Folder           (Shift + Cmd + K)
  4. Product → Archive
  5. Once Organizer opens →
       Distribute App → Custom → App Store Connect
       Manual signing → profile "SyncedIn App Store"
       Upload
  6. App Store Connect → TestFlight → wait ~10 min for processing

If Apple's validator complains about ANOTHER missing privacy key
(different from NSContactsUsageDescription), copy that exact key
name back to Claude and I'll add it to Info.plist instantly.
==================================================================
NEXT
