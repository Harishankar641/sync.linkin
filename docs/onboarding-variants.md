# Onboarding variants — A/B/C/D options to test

> Live decision: **Variant A** is current default for invite-claim flow as of May 19 2026. Real-user feedback ("I feel like I'm getting interrogated by the FBI") drove the pivot away from wizard-first. Below is the playbook for testing alternatives once we have enough new-user volume to measure win-rate per variant.

The metric to watch: **full-onboarding completion rate** — percentage of invited signups who (a) read the inviter's opener, (b) send at least one reply, (c) come back within 7 days. Each variant should be served to ~25% of new invited users so we can compare conversion within 30-day cohorts.

---

## Variant A — drop straight into conversation (CURRENT DEFAULT)

**Flow:**
1. User clicks `/<slug>` invite landing.
2. Signs up via magic link → `/auth/callback?next=/claim/<slug>`.
3. `/claim/<slug>` creates conversation, pre-fills profile + twin from scrape, then redirects to `/conversations/<id>?seeded=1`.
4. User lands inside a real, populated thread — the inviter's opener is message 1. No form, no wizard, no welcome page.
5. Conversation UI nudges them to reply through their twin. Editing the draft reply is the moment of value.

**Why this is the default:**
- Time-to-value is seconds, not minutes.
- The pre-filled twin (from scrape) is good enough for the first reply. Refinement is incremental.
- Matches Jack's directive: "drop them into the conversation but push them to edit the message."

**Risks to watch:**
- User may bounce if the seeded twin reply is poor quality and they can't tell how to improve it.
- No "wow we already know you" reveal — the recognition happens silently inside the reply draft.

---

## Variant B — `/welcome` page first

**Flow:**
1. Same up to `/claim/<slug>`.
2. `/claim/<slug>` redirects to `/welcome?conv=<id>&from=<slug>` instead of straight to the conversation.
3. `/welcome` (built, file at `app/welcome/page.tsx`) shows:
   - Hero with the user's real name + scraped photo. "First-Name, your twin is already half-built."
   - Card showing the scraped data (bio + recent posts) — proof of recognition.
   - Three explainer cards: how the twin works, how negotiation happens, what they'll see.
   - One CTA: "Open my conversation with [Inviter] →".
4. User clicks CTA → conversation.

**Why this might win:**
- The "we already know you" moment is explicit, not buried in a draft reply.
- Three explainer cards demystify the protocol before they have to act.

**Risks:**
- One extra click between signup and value.
- If the explainer cards feel marketing-y, they break trust.

**To enable:** in `app/claim/[slug]/route.ts`, change the final redirect from `/conversations/<id>?seeded=1` to `/welcome?conv=<id>&from=<slug>`.

---

## Variant C — one-question modal before conversation

**Flow:**
1. Same up to `/claim/<slug>` → creates conversation.
2. Redirect to `/conversations/<id>?firstrun=1`.
3. Conversation page sees the `firstrun=1` param, shows a single-question modal BEFORE rendering the chat: "In one sentence — what are you working on right now?"
4. User types or skips. Either way the modal closes and the conversation appears.
5. The answer (if given) is appended to `twin_profiles.ai_export_blob`.

**Why this might win:**
- One question is bearable. Five is interrogation.
- The answer is the single most useful signal for a twin to start representing them well.
- Skip is one tap away — no guilt.

**Risks:**
- Even one modal feels like a tax on a brand-new user.
- The answer may be low-quality without follow-up prompts.

**To build:** add a `FirstRunModal` client component to `app/conversations/[id]/page.tsx` that reads the `firstrun` query param and renders a single-input prompt.

---

## Variant D — progressive coachmark after first reply

**Flow:**
1. Same up to `/claim/<slug>` → conversation.
2. User reads the inviter's opener and either:
   - Clicks the draft to edit → conversation flows as normal.
   - Clicks send-as-is → conversation flows as normal.
3. AFTER the first reply is sent, a coachmark slides in from the right: "Want your twin to sound more like you? Add a paragraph about yourself in 30 seconds." with two buttons: "yes, refine" → opens `/onboarding` with the AI memory step pre-focused; "later" → dismisses.
4. Coachmark sets a `localStorage.setItem("seen_refine_coachmark", "1")` so it never reappears.

**Why this might win:**
- Refinement is asked for AFTER the user has experienced the value (their twin replied successfully).
- Friction is delayed to a moment when motivation is highest.

**Risks:**
- Adds a state machine the conversation UI doesn't currently have.
- Coachmark could be missed entirely.

**To build:** add a `RefineCoachmark` client component to `app/conversations/[id]/ChatUI.tsx` that mounts on the first message-send and shows the offer.

---

## Variant E — exclusive 2-invite gate (Clubhouse model)

**Flow:**
1. Same up to `/claim/<slug>` → conversation.
2. Every new user receives 2 invite "seats" displayed prominently in the sidebar: "You have 2 invites to share. Each one carries the SyncedIn protocol to someone you actually want to coordinate with."
3. Inviting someone consumes a seat. Inviting can be deferred indefinitely — there's no gate.
4. After 2 successful claims by their invitees, the user earns 2 more seats.

**Why this might win:**
- Scarcity creates a sense that each invite matters.
- Aligns with Clubhouse's network-graph mechanic Jack referenced.
- Self-perpetuating growth loop without forced friction.

**Risks:**
- Scarcity can also feel exclusionary if seats run out and the user wants to invite more.
- Adding seat accounting is more state to track than "free invites."

**To build:** add `invite_seats` integer column to `profiles`, default 2; decrement on successful pending_invite creation; increment by 2 when an invitee claims.

---

## Variant G — edit-triggered refine (Jack's pick — likely peak)

**Flow:**
1. Same up to `/claim/<slug>` → conversation (Variant A baseline).
2. User reads the inviter's opener. Their twin auto-drafts a reply using the scraped seed data.
3. User edits the draft. First edit: nothing happens, just sends.
4. **Second edit on the same conversation** triggers a soft inline prompt above the message composer:
   `"Your twin needed two corrections — want to finish setting it up so it sounds more like you the first time?"` with `[finish setting up clone →]` and `[later]` buttons.
5. Click `finish setting up clone` → opens `/onboarding` with the AI Memory step pre-focused, BUT the wizard knows you came from this trigger and shows a one-paragraph prompt: "Drop a paragraph about how you actually talk, what you're working on, what you'd say yes to." Two textareas max, save button always visible, no required fields.
6. Click `later` → dismiss for this session. After 4 edits total (across any conversations), re-prompt once more, then permanently dismiss until the user manually visits `/onboarding`.

**The visual hook — animated low-sync clone in the right rail:**
While sync is low (< 60%), the conversation page's right rail shows the SyncMeter (sci-fi-upload variant) at its actual sync level — barely filled, dim glow, faint pulse. Underneath, a small CTA: `[finish setting up clone for better answers]`. The visual is the prompt — the user SEES that their twin is operating at 30% and the implied path is to top it up.

**Why this is likely peak:**
- Zero forced friction at signup. Time-to-first-value is seconds (matches Variant A).
- The refine ask is timed to the moment of MAXIMUM motivation — the user just had to fix their twin twice, they know exactly why this matters.
- The right-rail SyncMeter is honest signaling: low sync = low power, visually obvious, no nag copy needed.
- A/B can compare: did Variant G users complete more of the AI Memory step than Variant A users who never see the prompt?

**To build:**
- Track edit counts per conversation in `messages` (already have `edited` boolean — promote to integer count, or store separately).
- Client-side: `ChatUI` mounts a `<RefineNudge edits={editCount} />` that renders the prompt when `editCount >= 2 && !sessionStorage.getItem("refine_dismissed")`.
- Right rail: when `total_sync < 60`, mount the existing `<SyncMeter inputs={...} size={140} />` plus the "finish setting up" link below it.
- Route `/onboarding?from=edit-trigger` so the wizard can render the simplified one-paragraph variant.

---

## Variant F — wizard-first (the OLD default)

**Flow:** the original 4-step `/onboarding` wizard. Build twin from form fields. AI Memory step asks the user to copy-paste a deeply personal prompt into ChatGPT.

**Why this was abandoned:**
- Real user said it felt like an FBI interrogation.
- Time-to-value was minutes, not seconds.
- Drop-off was concentrated at the AI Memory step (too invasive).

Kept here only so we have a baseline for any future experiment.

---

## Testing plan

1. Ship Variant A as default (done).
2. Once 100+ new invited signups have flowed through Variant A, measure full-onboarding completion at 7 days.
3. Add a feature-flag rollout (env var `ONBOARDING_VARIANT` per cookie hash → A/B/C/D split).
4. Compare variants over 30-day cohorts. Statistical significance probably needs ~50 users per variant for a 7-day completion rate to be readable.
5. Winner becomes default. Losers archive.

## Data points to capture per signup

- Variant served.
- Time from signup to first reply.
- Did they send the first reply unedited, lightly edited, or rewritten entirely?
- Did they return within 24h / 7d / 30d?
- Did they invite anyone in their first session?
- Did they fill out any `/onboarding` field beyond what claim pre-seeded?
