# SyncedIn

An agent-to-agent protocol between people. Each user builds a digital twin from their goals, deal preferences, communication style, and a personal-intelligence dump (from another AI, chat exports, sent emails). When two users open a conversation, their twins generate messages on each side. Every generated draft is editable before it sends. Every edit is logged as training signal for that user's meta-model — so the twin gets closer to the human's voice with every correction. Users can also chat with a small set of pre-built sample twins to stress-test their own twin solo before bringing real humans in.

## Stack
- Next.js 14 (App Router, TypeScript, server actions, server components)
- Tailwind CSS
- Supabase (Postgres + magic-link auth + row-level security)
- Anthropic Claude API (twin generation)
- PWA-installable on iOS and Android day one

## What's in v1
- Universal onboarding — any email can sign up via magic link
- Rich twin profile intake with collapsible extraction guides for ChatGPT/Claude/Gemini, WhatsApp, iMessage, Telegram, LinkedIn, and sent email
- Live "data richness" indicator that tells the user how much fidelity they've fed the twin
- Sample twins (test personas) — solo test mode with 5 pre-built twins (Seed VC, technical co-founder, B2B partnerships, recruiter, angel) that auto-reply so any new user can validate their twin without needing a partner
- Manual pairing for real users — start a conversation by entering another SyncedIn user's email
- Two-twin chat surface with generate / edit / regenerate / send
- Edit-delta logging — the proprietary training corpus that compounds per user
- Few-shot meta-model — recent edit deltas are injected into the system prompt on every generation
- PWA installable for iOS/Android

## What's not in v1 (intentional)
- Automatic matching / "highest win-win" surfacing across the network
- Contract drafting
- Native iOS/Android shells (PWA covers it for now)
- Real-time push (refresh-based)
- Fine-tuning on edit deltas (stored + few-shotted; fine-tune comes later)

## Setup (≈ 30 min)

### 1. Supabase project
1. Create a project at https://supabase.com.
2. Open SQL Editor and paste the full contents of `supabase/schema.sql`. Run it. (It's idempotent — safe to re-run.)
3. Project Settings → API. Copy URL, anon, service_role keys.
4. Authentication → URL Configuration:
   - Site URL: `http://localhost:3000` for dev; replace with your Vercel domain in prod
   - Additional Redirect URLs: `http://localhost:3000/auth/callback` and your prod equivalent

### 2. Anthropic API key
Get one at https://console.anthropic.com → API Keys.

### 3. Env vars
```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
```

### 4. Install + seed test personas + run
```bash
npm install
npm run seed:personas      # creates 5 sample twins so users can solo-test
npm run dev
```
Open http://localhost:3000.

The `seed:personas` step is idempotent — re-running just updates existing personas in place. Use it whenever you tweak the persona definitions in `scripts/seed-test-personas.mjs`.

## Deploy to Vercel (so real users can sign up)

The fastest path. Takes about 5 minutes once your local app is working.

```bash
# from the project root
npx vercel
```

First time, it'll ask you to log in (browser pops open), then a few setup questions:
- Set up and deploy "twinlink"? **Y**
- Which scope? Pick your personal account.
- Link to existing project? **N**
- What's your project's name? **twinlink** (or anything)
- In which directory is your code located? **./**
- Want to modify settings? **N**

It'll deploy a preview URL. To promote to production:
```bash
npx vercel --prod
```

After the first deploy:

1. **Add env vars in Vercel**: Project → Settings → Environment Variables. Add every var from `.env.local` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY). Set `NEXT_PUBLIC_APP_URL` to your Vercel URL (e.g. `https://twinlink.vercel.app`).
2. **Redeploy** so the new env vars take effect: `npx vercel --prod`.
3. **Update Supabase Auth URLs**: Supabase → Authentication → URL Configuration. Add your Vercel domain to Site URL and add `https://your-domain.com/auth/callback` to Additional Redirect URLs. Otherwise magic links from production will fail.
4. **Re-run the seed against production** (it reads `NEXT_PUBLIC_SUPABASE_URL` from `.env.local`, so the same `npm run seed:personas` works as long as `.env.local` points at the same Supabase project).

Share the Vercel URL. Anyone can sign in with their own email, get a magic link, complete onboarding, chat with sample twins to test their own twin, and start real conversations with anyone else who has signed up.

## Testing the loop

### Solo (sample twins)
1. Sign up with magic link.
2. Complete onboarding (use the extraction guides — at minimum paste a ChatGPT/Claude context dump).
3. Dashboard → click a sample twin (e.g. "Sam Chen — Seed VC").
4. Hit Generate, edit the draft, send. The sample twin auto-replies.
5. Repeat. Each edit logs an entry in `edit_deltas` — your meta-model corpus.

### Real two-twin (you + a friend)
1. Both sign up + complete onboarding.
2. From your side: Dashboard → New → enter their email.
3. Take turns: generate → edit → send. Refresh to see the other side's messages until realtime is added.

## Architecture map

```
app/
  page.tsx                                 Landing
  login/                                   Magic-link sign-in
  auth/callback/                           Session exchange
  onboarding/
    page.tsx                               Twin profile intake (server)
    actions.ts                             Save twin
    ExtractionGuides.tsx                   Collapsible data-source guides (client)
    DumpTextarea.tsx                       Live richness indicator (client)
  dashboard/
    page.tsx                               Real + test conversations, sample twins
    actions.ts                             Start a test conversation
  conversations/
    new/                                   Start a conversation by email
    [id]/
      page.tsx                             Server-loaded conversation
      ChatUI.tsx                           Generate / edit / regenerate / send;
                                           auto-trigger dummy reply for samples
  api/
    generate-message/                      Twin draft for the current user
    regenerate-message/                    Re-draft using user's edit as signal
    send-message/                          Commit message + log delta if edited
    generate-dummy-reply/                  Generate + auto-insert as a test persona

lib/
  supabase/{client,server}.ts              Auth + service clients
  anthropic.ts                             SDK + model id
  twin-prompt.ts                           System prompt builder (CORE IP)
  types.ts                                 Shared types

scripts/
  seed-test-personas.mjs                   Idempotent seeder for sample twins

supabase/
  schema.sql                               Tables, indexes, RLS, auth trigger

middleware.ts                              Redirects unauthed users to /login
```

## Where the moat lives

`lib/twin-prompt.ts` — every generation pulls the user's 5 most recent edit deltas and includes them as few-shot examples. This is the meta-model. Once a user accumulates enough deltas (probably ~5k–10k), you can:
1. Train a LoRA adapter on the corpus, or
2. Use the deltas for DPO / preference fine-tuning
3. Swap `TWIN_MODEL` in `lib/anthropic.ts` to the user-specific snapshot

The corpus is RLS-scoped per user. *Cross-user* patterns — what consensus-producing conversations look like — are the platform-level moat.

## Next things to build (priority order)

1. **Realtime updates** in the conversation view (Supabase Realtime subscription).
2. **Match suggestions** — when two twins have compatible deal preferences, surface a suggested intro to both users for one-click acceptance. This is the "highest win-win" feature.
3. **Consensus detection + contract drafting** — when the conversation reaches a deal shape, generate the term sheet / SAFE / MOU draft and stage it for both sides to approve.
4. **Auto-enrich twin from connected sources** (LinkedIn OAuth, calendar, Notion, Gmail) to skip the manual paste.
5. **Capacitor wrap** for App Store + Play Store distribution.
