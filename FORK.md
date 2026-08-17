# Fork SyncedIn

This codebase is a working AI-twin networking platform. You've been
invited to fork it and run your own version — with your own brand,
your own users, and your own API keys.

Everything you need to clone, configure, and ship a live app is below.
End-to-end takes ~15 minutes if you already have GitHub + Vercel +
Supabase + Anthropic accounts. Otherwise budget an hour.

---

## 1. Get the code

You should have already received a GitHub invitation to this repo. If
not, ping the maintainer.

```bash
git clone https://github.com/theguysaccount/syncedin.git my-fork
cd my-fork
npm install
```

If you'd rather start a clean repo you own outright (recommended for
heavy customization), use GitHub's **Use this template** button at the
top of the repo page. That creates a new repo under your account with
the full codebase but a fresh git history.

---

## 2. Create the infrastructure

You need three accounts. Each one's free tier is plenty for testing.

### Supabase (database + auth)
1. Go to [supabase.com](https://supabase.com) → New project. Pick any
   region close to your users.
2. Wait ~2 minutes for it to provision.
3. SQL Editor → New Query → paste the entire contents of
   `supabase/schema.sql` from this repo → Run. This creates every
   table, index, RLS policy, and trigger the app needs.
4. Settings → API → copy three values:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

### Anthropic (twin AI)
1. [console.anthropic.com](https://console.anthropic.com) → API Keys →
   Create Key.
2. Copy the key into `ANTHROPIC_API_KEY`.

### Vercel (hosting — optional for local dev)
1. [vercel.com](https://vercel.com) → New Project → Import your repo.
2. Skip "Configure" for now — we'll add env vars after first deploy.

---

## 3. Local dev

```bash
cp .env.example .env.local
# open .env.local in your editor and paste the keys from step 2
npm run dev
```

App lives at `http://localhost:3000`. Sign up with magic-link (it'll
use Supabase's built-in email until you wire Resend).

---

## 4. Deploy to production

1. Push your code to your fork's GitHub.
2. In Vercel → your project → Settings → Environment Variables → add
   every variable from `.env.local`. Use your real production
   `NEXT_PUBLIC_APP_URL` (your Vercel domain).
3. Deployments → Redeploy.

That's it. Your fork is live.

---

## 5. Optional integrations

The base app works with just Supabase + Anthropic. These keys unlock
more features:

| Key | What it unlocks | Get it at |
|-----|-----------------|-----------|
| `APIFY_TOKEN` | X / Instagram profile scraping for invite personalization | [apify.com](https://apify.com) |
| `SCRAPINGDOG_API_KEY` | LinkedIn scraping + 2nd-vendor fallback | [scrapingdog.com](https://scrapingdog.com) |
| `EXA_API_KEY` | "Find people" semantic search + SelfDiscovery auto-bio | [exa.ai](https://exa.ai) |
| `RESEND_API_KEY` | Branded transactional email (otherwise Supabase default) | [resend.com](https://resend.com) |
| `GIPHY_API_KEY` | Twin chats can drop the occasional contextual GIF | [developers.giphy.com](https://developers.giphy.com) |
| `NOTIFY_HMAC_SECRET` | Required if you ship email — signs unsubscribe-link tokens (Gmail Feb-2024 List-Unsubscribe-Post) | `openssl rand -hex 32` |
| `CRON_SECRET` | Vercel weekly-digest cron auth — same value set in `vercel.json` + Vercel env vars | `openssl rand -hex 32` |
| `NOTIFICATION_FROM_EMAIL` | The "from" header on every email — defaults to `SyncedIn <hello@syncedin.org>` | your verified sending domain |

All of these gracefully degrade if missing — the app still works,
just with less rich data.

### Supabase Storage buckets

Some features write to Supabase Storage. Create these buckets manually
in Supabase → Storage → New bucket:

| Bucket | Public? | What goes in it |
|--------|---------|-----------------|
| `chat-attachments` | yes (public) | Files + videos members upload in conversation chat |

Without `chat-attachments`, the chat file/video upload feature returns
a `bucket_missing` error — everything else continues to work.

---

## 6. Make it yours

The most important file for any forker is `CLAUDE.md` at the repo
root. It gives Claude (Cursor, Claude Code, Cowork) a full memory
transplant: architecture, file map, conventions, what's done, what's
pending. Open Claude on your fork and it'll be productive in minutes.

To rebrand:
- Replace `public/syncedin-wordmark-tight.png` with your own wordmark
- Find-and-replace "SyncedIn" across the codebase (keep `syncedin.org`
  references in env-var defaults — those don't ship to your fork)
- `app/page.tsx` is the landing page — that's where your brand voice
  lives

To extend:
- Every API route in `app/api/` is self-contained. Add new generators
  by copying `app/api/personal-intelligence/generate/route.ts` as a
  template.
- New nav items: add to `app/Sidebar.tsx`'s `items` array.

---

## 7. Weekly digest cron (optional)

If you set `RESEND_API_KEY` + `CRON_SECRET`, the app will send a weekly
"proposals waiting on you" digest every Monday at 14:00 UTC. The cron is
declared in `vercel.json` — Vercel handles auth by sending
`Authorization: Bearer <CRON_SECRET>` to `/api/cron/weekly-digest`.

To disable: delete the `crons` block in `vercel.json`.

To change the schedule: edit the `schedule` field (5-field cron syntax).

---

## 8. Stay in sync (optional)

If you want to pull in upstream improvements from the canonical repo:

```bash
git remote add upstream https://github.com/theguysaccount/syncedin.git
git fetch upstream
git merge upstream/main
```

PRs the other way are welcome — open one against `main`.

---

## Questions

The maintainer (Jack — `jacksonjezio@gmail.com`) is the fastest path.
Bug reports → use the in-app `/feedback` widget; they land in the
admin reports inbox automatically.
