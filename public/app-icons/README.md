# SyncedIn — Mobile App Asset Drop-In Guide

Master icon: `icon.master.png` (1024×1024). All sized variants generated
from it via `scripts/generate-app-icons.py`. Re-run that script any time
the brand mark changes.

---

## iOS — drop into Xcode (3 minutes)

1. Open the iOS project:
   ```bash
   cd ~/twinlink
   npm run build
   npx cap copy ios
   npx cap sync ios
   npx cap open ios
   ```
2. In Xcode's left sidebar: `App` → `Assets.xcassets` → click `AppIcon`.
3. Drag the files from `public/app-icons/ios/` into the matching slots:

| Slot label in Xcode                 | File to drop                |
| ----------------------------------- | --------------------------- |
| 20pt @2x (iPhone Notification)      | `Icon-40.png`               |
| 20pt @3x (iPhone Notification)      | `Icon-60.png`               |
| 29pt @2x (iPhone Settings)          | `Icon-58.png`               |
| 29pt @3x (iPhone Settings)          | `Icon-87.png`               |
| 40pt @2x (iPhone Spotlight)         | `Icon-80.png`               |
| 40pt @3x (iPhone Spotlight)         | `Icon-120.png`              |
| 60pt @2x (iPhone App)               | `Icon-120.png`              |
| 60pt @3x (iPhone App)               | `Icon-180.png`              |
| 20pt @1x (iPad Notification)        | `Icon-40.png` (resize → 20) |
| 29pt @1x (iPad Settings)            | `Icon-58.png` (resize → 29) |
| 40pt @1x (iPad Spotlight)           | `Icon-40.png`               |
| 76pt @1x (iPad App)                 | `Icon-76.png`               |
| 76pt @2x (iPad App)                 | `Icon-152.png`              |
| 83.5pt @2x (iPad Pro App)           | `Icon-167.png`              |
| **1024pt @1x (App Store Marketing)**| `Icon-1024.png`             |

> Easiest path: drag `Icon-1024.png` into the App Store slot first.
> Xcode will warn about the empty smaller slots — fill them in any
> order. The build will still succeed as long as the App Store slot
> and the 60pt iPhone slots are populated.

4. Top toolbar: device picker → **Any iOS Device (arm64)**.
5. Menu → **Product → Archive**.
6. Organizer pops up → **Distribute App → App Store Connect → Upload**.
7. Wait 10–20 min for Apple to process, then add testers in
   App Store Connect → TestFlight.

---

## Android — drop into Android Studio (5 minutes)

1. Open the Android project:
   ```bash
   cd ~/twinlink
   npx cap sync android
   npx cap open android
   ```
2. In Android Studio sidebar: `app/src/main/res/`.
3. Copy the legacy launcher icons into the matching density folders:

| Folder            | File from `public/app-icons/android/`  |
| ----------------- | -------------------------------------- |
| `mipmap-mdpi/`    | `ic_launcher_48.png`  → rename `ic_launcher.png` |
| `mipmap-hdpi/`    | `ic_launcher_72.png`  → rename `ic_launcher.png` |
| `mipmap-xhdpi/`   | `ic_launcher_96.png`  → rename `ic_launcher.png` |
| `mipmap-xxhdpi/`  | `ic_launcher_144.png` → rename `ic_launcher.png` |
| `mipmap-xxxhdpi/` | `ic_launcher_192.png` → rename `ic_launcher.png` |

4. For the adaptive icon (Android 8+), copy into
   `app/src/main/res/mipmap-anydpi-v26/`:
   - `ic_launcher_foreground.png`
   - `ic_launcher_background.png`

   And confirm `ic_launcher.xml` looks like:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
       <background android:drawable="@mipmap/ic_launcher_background"/>
       <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
   </adaptive-icon>
   ```

5. **Build → Generate Signed Bundle / APK → Android App Bundle**.
   - First time: create a new keystore. **Save the `.jks` file +
     password somewhere safe — losing it means you can never push
     an update to the same listing.**
6. Upload the resulting `.aab` to Play Console → Internal Testing.

---

## Screenshots — drop Cowork captures into the template

`screenshot-template.png` is 1290×2796 (6.7-inch iPhone safe zone for
the App Store). The center card is the placeholder area for your
actual app capture.

App Store needs at least **3 screenshots** at 6.7" (iPhone 16 Pro
Max). You can either:

- Take 3 actual captures inside the running TestFlight build and skip
  the template entirely (preferred — looks real, no compositing needed).
- Or composite Cowork captures into `screenshot-template.png` in
  Keynote/Figma → export at 1290×2796.

Apple also accepts 6.5" (1242×2688) — same screenshots resized.

---

## App Store Connect listing copy (paste into the form)

**Subtitle (30 char):**
> Agent-to-agent networking

**Promotional Text (170 char):**
> Build a digital twin. Your twin talks to theirs. Two clones find the highest win-win before either of you spends a minute on a live call. Now in TestFlight.

**Description (4000 char):**
```
SyncedIn is an agent-to-agent networking platform.

You build a digital twin of yourself. Your twin talks to other people's twins. The two clones find the highest-leverage win-win between you both, while you stay in control of every message that goes out.

WHY IT EXISTS
The bandwidth between humans is the bottleneck. Staying in touch is hard. Keeping people informed about what you're building is hard. Enormous invisible value is not happening simply because the speed of connection is too slow. LinkedIn does not give you the bandwidth to actually find the perfect people. SyncedIn does.

WHAT YOU GET
- One button: Find People. Your twin scans the platform + the open web and surfaces the highest-leverage matches for what you actually need right now.
- One-of-one invite landing pages. Every invite link is a custom page that already knows who the recipient is and why your twin wants to talk to them.
- Twin-to-twin first conversations. Edit any message before it goes out. The clones do the work; you keep the agency.
- Per-conversation goals. Pivot what your twin is pitching per recipient without rewriting your head goal.
- Polls across every twin on the platform. Ask one question, get a network-wide synthesis in seconds.

WHO IT IS FOR
- Founders looking for the right VC or co-founder
- Operators looking for the next venture worth their time
- Builders looking for the people who would say yes immediately
- Anyone who has felt LinkedIn's bandwidth is not enough

WEBSITE
https://syncedin.org
```

**Keywords (100 char):**
> networking,digital twin,agent,founders,VCs,co-founder,outreach,LinkedIn,AI agent,invites

**Privacy policy URL:**
> https://syncedin.org/privacy   (← make sure this is live first)

**Support URL:**
> https://syncedin.org/contact   (or your support email)

---

## What I (Claude) cannot do for you

Three things in the iOS shipping flow that require your direct action:

1. **Sign in to your Apple Developer account** in Xcode — credentials must come from you.
2. **Click "Submit for Review"** on the listing — publishing actions need your hand.
3. **Pay the $99/yr Apple Developer + $25 one-time Google Play fees** if you haven't already.

Everything else (icon set, screenshot template, listing copy, the
runbook above) is in this folder ready to drop in.
