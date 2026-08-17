# Mobile CI/CD — GitHub Secrets Setup

One-time setup. After this, every `git push` to `main` that touches
`ios/`, `android/`, or `capacitor.config.ts` automatically:

1. Bumps the build number to the next available
2. Builds the iOS archive + uploads to TestFlight (Public Beta group)
3. Builds the Android AAB + uploads to Play Console Internal Testing

You also get a manual trigger: GitHub → Actions → "Mobile Release" → Run
workflow (lets you pick iOS only, Android only, or both).

---

## Required GitHub Secrets

Go to: **GitHub repo → Settings → Secrets and variables → Actions → New
repository secret**. Paste each value in. **Eleven secrets total** —
six for iOS, five for Android.

### iOS (six secrets)

| Secret name | What it is | How to get it |
|---|---|---|
| `APP_STORE_CONNECT_API_KEY_ID` | 10-char key ID | App Store Connect → Users and Access → Integrations → App Store Connect API → click your key → "Key ID" field |
| `APP_STORE_CONNECT_API_KEY_ISSUER_ID` | UUID | Same page → "Issuer ID" at the top |
| `APP_STORE_CONNECT_API_KEY_CONTENT` | Contents of the .p8 file | Same page → "Generate API Key" if you don't have one → download the .p8 (one-time) → `cat AuthKey_XXX.p8` → paste the whole text including BEGIN/END lines |
| `IOS_DIST_CERTIFICATE_BASE64` | Your Apple Distribution .p12, base64 | Keychain → My Certificates → "Apple Distribution: Full Body Zen LLC" → right-click → Export → save as `dist.p12` → set a password → `base64 -i dist.p12 \| pbcopy` |
| `IOS_DIST_CERTIFICATE_PASSWORD` | Password you just set on the .p12 | Whatever you typed when exporting |
| `IOS_PROVISIONING_PROFILE_BASE64` | The `SyncedIn App Store` provisioning profile, base64 | developer.apple.com → Profiles → "SyncedIn App Store" → Download → `base64 -i SyncedIn_App_Store.mobileprovision \| pbcopy` |

### Android (five secrets)

| Secret name | What it is | How to get it |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | Your signing keystore (.jks), base64 | `base64 -i android/app/syncedin.keystore \| pbcopy` (or wherever your keystore lives) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | The one you set when you created the keystore |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore | Usually `syncedin` or whatever you chose at `keytool -genkey` time |
| `ANDROID_KEY_PASSWORD` | Key password (often same as keystore password) | Same as above |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Service account JSON for Play API access | Play Console → Setup → API access → "Create new service account" → goes to Google Cloud → create service account with role "Service Account User" → Keys tab → Add Key → JSON → download. Then back in Play Console click "Grant access" on the new account → give it "Release manager" → Save. Paste the entire JSON file contents as the secret value. |

---

## Verifying it works

After all eleven secrets are in:

1. Make any trivial change to `capacitor.config.ts` (e.g. a comment edit)
2. `git commit && git push origin main`
3. Open GitHub → Actions tab → "Mobile Release" run should be green
4. iOS build lands in TestFlight in ~8 min, Android build lands in Play
   Console Internal Testing in ~4 min

If a run fails, the GitHub Actions log shows exactly which step broke and
which secret is missing or wrong.

---

## When this skips (most of the time)

Pure web changes (UI, copy, API routes, components) do **not** trigger
this workflow because Capacitor's `server.url` points at
`https://syncedin.org` — those changes ride to mobile via Vercel
automatically. The workflow only fires when one of these paths changes:

- `ios/**`
- `android/**`
- `capacitor.config.ts`
- `package.json`
- `.github/workflows/mobile-release.yml`

So most days you ship to mobile by doing nothing.
