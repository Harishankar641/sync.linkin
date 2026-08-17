#!/usr/bin/env bash
# Capacitor one-shot bootstrap: installs deps, generates ios/ + android/.
# Run this once on a Mac with Xcode + Android Studio installed.
# After this, `npm run cap:open:ios` opens Xcode and you Archive → Upload.
set -e
cd "$(dirname "$0")/.."

echo "→ installing capacitor + plugins"
npm install

if [ ! -d ios ]; then
  echo "→ adding iOS project (ios/)"
  npx cap add ios
fi

if [ ! -d android ]; then
  echo "→ adding Android project (android/)"
  npx cap add android
fi

echo "→ syncing web bundle into native"
npx cap sync

cat <<EOF

Capacitor scaffolded.

Next steps:
  npm run cap:open:ios       # Xcode → set signing team → Archive → Upload
  npm run cap:open:android   # Android Studio → Build → Generate Signed Bundle

App config:
  appId:   org.syncedin.app
  appName: SyncedIn
  url:     https://syncedin.org  (changes ship via your normal Vercel push)

Stores:
  iOS:     developer.apple.com  (\$99/yr, 24-48h approval)
  Android: play.google.com/console  (\$25 one-time)

For native push + contacts you'll also need:
  - Apple: APNs auth key (download from Apple Developer → Keys)
  - Google: FCM service account JSON (from Firebase Console)
EOF
