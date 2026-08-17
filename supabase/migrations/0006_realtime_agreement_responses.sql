-- 0006: Realtime on agreement_responses — powers the live "Sync Moment"
-- (app/conversations/[id]/SyncMoment.tsx + lib/hooks/useAgreementRealtime.ts).
--
-- Without this, a user only learns their counterpart accepted the deal on
-- their NEXT page load or refresh (respond-agreement writes the row, but
-- nothing pushes it to the other participant's open tab). That silence is
-- exactly the moment a product should feel alive. This migration adds the
-- table to Supabase's realtime publication so both participants' browsers
-- get pushed the row the instant it's written.
--
-- Idempotent — guarded so re-running (or running on a project where this
-- was already added by hand) doesn't error.
--
-- Jack runs this once in the Supabase SQL editor, same as every other
-- migration in this folder.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'agreement_responses'
  ) then
    alter publication supabase_realtime add table public.agreement_responses;
  end if;
exception
  when undefined_object then
    -- supabase_realtime publication doesn't exist on this project yet
    -- (very old projects / non-Supabase Postgres). Realtime just won't
    -- fire; the existing refresh-based flow still works, so this is a
    -- soft no-op rather than a failed migration.
    null;
end $$;
