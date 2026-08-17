-- Funnel instrumentation + win receipts (strategy items: instrumentation
-- and proof-of-outcome).
--
-- funnel_events: one row per front-door event (page view, prompt copied,
-- decode started/finished, claim clicked, share clicked) so we can see
-- which of the five front doors converts. Written by /api/track via the
-- service role. The route silently no-ops until this table exists, so
-- the code ships before the migration runs.
--
-- win_receipts: the public proof-of-outcome system. A row is created
-- ONLY when a participant of a conversation with an accepted agreement
-- explicitly clicks publish. /wins renders ONLY rows from this table.
-- No fake receipts, ever.
--
-- Jack runs this once in the Supabase SQL editor. Idempotent.

create table if not exists public.funnel_events (
  id uuid primary key default uuid_generate_v4(),
  -- view | prompt_copied | decode_started | decode_done | decode_failed |
  -- claim_clicked | share_clicked | generate_started | generate_done |
  -- people_chip_clicked | ghost_prefill_used | win_published
  event text not null,
  path text,
  meta jsonb,
  -- Random localStorage token so anonymous funnels can be stitched
  -- across steps without accounts. Not a fingerprint.
  anon_id text,
  user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists funnel_events_event_idx
  on public.funnel_events (event, created_at desc);
create index if not exists funnel_events_path_idx
  on public.funnel_events (path, created_at desc);
create index if not exists funnel_events_anon_idx
  on public.funnel_events (anon_id, created_at desc);

alter table public.funnel_events enable row level security;
-- No public policies on purpose: only the service role (API) writes,
-- reads happen in the SQL editor / admin tooling.

create table if not exists public.win_receipts (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null,
  published_by uuid not null,
  outcome_text text not null,
  party_a text not null,
  party_b text not null,
  anonymized boolean not null default true,
  created_at timestamptz not null default now()
);

-- One receipt per conversation; republishing updates instead of duping.
create unique index if not exists win_receipts_conversation_uidx
  on public.win_receipts (conversation_id);

alter table public.win_receipts enable row level security;
drop policy if exists "win_receipts_public_read" on public.win_receipts;
create policy "win_receipts_public_read"
  on public.win_receipts for select using (true);
-- Inserts/updates go through /api/wins/publish with the service role
-- after participant checks. No direct client writes.
