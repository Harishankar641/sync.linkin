-- Push notification device tokens (push v1, no-spam policy).
--
-- One row per device token. The app registers via /api/push/register
-- (service-role insert, RLS closed). lib/push.ts prunes tokens that
-- APNs/FCM report as dead.
--
-- Push POLICY lives in lib/push.ts: only deal-moment events
-- (counterpart accepted / deal sealed), hard dedupe per conversation
-- per recipient via notification_log, max 3 pushes per user per 24h.
--
-- Jack runs this once in the Supabase SQL editor. Idempotent.

create table if not exists public.push_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx
  on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
-- No public policies: only the service role (API) reads/writes.
