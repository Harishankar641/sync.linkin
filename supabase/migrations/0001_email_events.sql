-- Email engagement tracking (#22).
--
-- Records raw Resend webhook events so the admin dashboard can compute
-- real open / click / bounce rates. Decoupled from notification_log on
-- purpose: this table just logs whatever Resend reports, keyed by the
-- Resend message id + recipient, so NO send-site code has to change.
--
-- Jack runs this once in the Supabase SQL editor. Idempotent.

create table if not exists public.email_events (
  id uuid primary key default uuid_generate_v4(),
  -- Resend's email id (data.email_id on the webhook payload). Join key
  -- back to a specific send when we capture it.
  provider_message_id text,
  email_address text,
  -- email.sent | email.delivered | email.opened | email.clicked |
  -- email.bounced | email.complained | email.delivery_delayed
  event_type text not null,
  occurred_at timestamptz not null default now(),
  -- Full event payload for forensic/debug; safe to drop later.
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_events_addr_idx
  on public.email_events (email_address);
create index if not exists email_events_type_time_idx
  on public.email_events (event_type, occurred_at);
create index if not exists email_events_msg_idx
  on public.email_events (provider_message_id);

-- Dedupe guard: Resend can re-deliver a webhook. A (message, type)
-- pair is unique enough for our rate math (we count distinct opens per
-- message, not every re-fire).
create unique index if not exists email_events_msg_type_uniq
  on public.email_events (provider_message_id, event_type)
  where provider_message_id is not null;
