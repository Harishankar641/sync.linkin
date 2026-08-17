-- Per-room host brief (#15).
--
-- The community/conference page shows a brief about the host. The host
-- can edit it either GLOBALLY (updates their profile.portfolio_about,
-- which shows everywhere) or JUST FOR THIS ROOM (this column, an override
-- that only applies on this one community/conference page).
--
-- Jack runs this once in the Supabase SQL editor. Idempotent. The page
-- selects conferences with `*`, so a missing column degrades gracefully
-- (host_brief is simply absent) until this runs.

alter table public.conferences
  add column if not exists host_brief text;
