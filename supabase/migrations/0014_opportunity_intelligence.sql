/*
  SyncedIn — Opportunity Intelligence Layer

  Adds:
    1. Persistent opportunities
    2. Relationship memory
    3. Opportunity actions
    4. Introduction workflow
    5. Outcome tracking
    6. Twin learning events
*/


-- ============================================================
-- 1. OPPORTUNITIES
-- ============================================================

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),

  opportunity_type text not null,
  title text not null,
  company text,
  description text,

  skills text[] not null default '{}',

  source text,
  source_url text,

  location text,

  status text not null default 'active',

  created_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint opportunities_status_check
    check (
      status in (
        'active',
        'paused',
        'closed',
        'archived'
      )
    )
);


-- ============================================================
-- 2. RELATIONSHIP MEMORY
-- ============================================================

create table if not exists public.relationship_memory (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  person_id uuid not null
    references auth.users(id)
    on delete cascade,

  relationship_type text
    default 'professional',

  relationship_strength numeric
    not null default 0,

  trust_score numeric
    not null default 0,

  interaction_count integer
    not null default 0,

  last_interaction_at timestamptz,

  shared_context text[] not null default '{}',

  shared_topics text[] not null default '{}',

  successful_introductions integer
    not null default 0,

  failed_introductions integer
    not null default 0,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    user_id,
    person_id
  ),

  constraint relationship_memory_not_self
    check (
      user_id <> person_id
    )
);


-- ============================================================
-- 3. OPPORTUNITY ACTIONS
-- ============================================================

create table if not exists public.opportunity_actions (
  id uuid primary key default gen_random_uuid(),

  opportunity_id uuid not null
    references public.opportunities(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  action_type text not null,

  notes text,

  created_at timestamptz not null default now(),

  constraint opportunity_actions_type_check
    check (
      action_type in (
        'viewed',
        'saved',
        'dismissed',
        'approved',
        'request_introduction',
        'withdraw_request'
      )
    )
);


-- ============================================================
-- 4. INTRODUCTION REQUESTS
-- ============================================================

create table if not exists public.opportunity_introductions (
  id uuid primary key default gen_random_uuid(),

  opportunity_id uuid not null
    references public.opportunities(id)
    on delete cascade,

  requester_id uuid not null
    references auth.users(id)
    on delete cascade,

  connector_id uuid not null
    references auth.users(id)
    on delete cascade,

  target_id uuid not null
    references auth.users(id)
    on delete cascade,

  status text not null default 'requested',

  requester_message text,

  connector_message text,

  requested_at timestamptz not null default now(),

  responded_at timestamptz,

  introduced_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint opportunity_introductions_status_check
    check (
      status in (
        'requested',
        'approved',
        'declined',
        'cancelled',
        'introduced'
      )
    ),

  constraint opportunity_introductions_no_self_connector
    check (
      requester_id <> connector_id
    ),

  constraint opportunity_introductions_no_self_target
    check (
      requester_id <> target_id
    ),

  constraint opportunity_introductions_connector_target
    check (
      connector_id <> target_id
    )
);


-- ============================================================
-- 5. OPPORTUNITY OUTCOMES
-- ============================================================

create table if not exists public.opportunity_outcomes (
  id uuid primary key default gen_random_uuid(),

  opportunity_id uuid not null
    references public.opportunities(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  introduction_id uuid
    references public.opportunity_introductions(id)
    on delete set null,

  outcome_type text not null,

  result text,

  notes text,

  occurred_at timestamptz not null default now(),

  created_at timestamptz not null default now(),

  constraint opportunity_outcomes_type_check
    check (
      outcome_type in (
        'discovered',
        'saved',
        'introduction_requested',
        'introduced',
        'replied',
        'meeting',
        'opportunity_created',
        'won',
        'lost',
        'not_interested'
      )
    )
);


-- ============================================================
-- 6. TWIN LEARNING EVENTS
-- ============================================================

create table if not exists public.twin_learning_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  opportunity_id uuid
    references public.opportunities(id)
    on delete set null,

  outcome_id uuid
    references public.opportunity_outcomes(id)
    on delete set null,

  event_type text not null,

  signal text,

  signal_value text,

  weight numeric
    not null default 1,

  metadata jsonb
    not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);


-- ============================================================
-- 7. INDEXES
-- ============================================================

create index if not exists opportunities_status_idx
  on public.opportunities(status);

create index if not exists opportunities_type_idx
  on public.opportunities(opportunity_type);

create index if not exists opportunities_created_by_idx
  on public.opportunities(created_by);

create index if not exists relationship_memory_user_idx
  on public.relationship_memory(user_id);

create index if not exists relationship_memory_person_idx
  on public.relationship_memory(person_id);

create index if not exists relationship_memory_strength_idx
  on public.relationship_memory(
    relationship_strength desc
  );

create index if not exists opportunity_actions_user_idx
  on public.opportunity_actions(user_id);

create index if not exists opportunity_actions_opportunity_idx
  on public.opportunity_actions(opportunity_id);

create index if not exists opportunity_introductions_requester_idx
  on public.opportunity_introductions(requester_id);

create index if not exists opportunity_introductions_connector_idx
  on public.opportunity_introductions(connector_id);

create index if not exists opportunity_introductions_target_idx
  on public.opportunity_introductions(target_id);

create index if not exists opportunity_introductions_status_idx
  on public.opportunity_introductions(status);

create index if not exists opportunity_outcomes_user_idx
  on public.opportunity_outcomes(user_id);

create index if not exists opportunity_outcomes_opportunity_idx
  on public.opportunity_outcomes(opportunity_id);

create index if not exists twin_learning_events_user_idx
  on public.twin_learning_events(user_id);


-- ============================================================
-- 8. UPDATED_AT TRIGGER FUNCTION
-- ============================================================

create or replace function public.set_opportunity_intelligence_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================================

drop trigger if exists opportunities_updated_at
on public.opportunities;

create trigger opportunities_updated_at
before update on public.opportunities
for each row
execute function public.set_opportunity_intelligence_updated_at();


drop trigger if exists relationship_memory_updated_at
on public.relationship_memory;

create trigger relationship_memory_updated_at
before update on public.relationship_memory
for each row
execute function public.set_opportunity_intelligence_updated_at();


drop trigger if exists opportunity_introductions_updated_at
on public.opportunity_introductions;

create trigger opportunity_introductions_updated_at
before update on public.opportunity_introductions
for each row
execute function public.set_opportunity_intelligence_updated_at();


-- ============================================================
-- 10. RLS
-- ============================================================

alter table public.opportunities
enable row level security;

alter table public.relationship_memory
enable row level security;

alter table public.opportunity_actions
enable row level security;

alter table public.opportunity_introductions
enable row level security;

alter table public.opportunity_outcomes
enable row level security;

alter table public.twin_learning_events
enable row level security;


-- ============================================================
-- 11. OPPORTUNITIES POLICIES
-- ============================================================

drop policy if exists
  "opportunities_select_authenticated"
on public.opportunities;

create policy
  "opportunities_select_authenticated"
on public.opportunities
for select
to authenticated
using (
  status = 'active'
  or created_by = auth.uid()
);


drop policy if exists
  "opportunities_insert_authenticated"
on public.opportunities;

create policy
  "opportunities_insert_authenticated"
on public.opportunities
for insert
to authenticated
with check (
  created_by = auth.uid()
);


drop policy if exists
  "opportunities_update_owner"
on public.opportunities;

create policy
  "opportunities_update_owner"
on public.opportunities
for update
to authenticated
using (
  created_by = auth.uid()
)
with check (
  created_by = auth.uid()
);


-- ============================================================
-- 12. RELATIONSHIP MEMORY POLICIES
-- ============================================================

drop policy if exists
  "relationship_memory_select_own"
on public.relationship_memory;

create policy
  "relationship_memory_select_own"
on public.relationship_memory
for select
to authenticated
using (
  user_id = auth.uid()
  or person_id = auth.uid()
);


drop policy if exists
  "relationship_memory_insert_own"
on public.relationship_memory;

create policy
  "relationship_memory_insert_own"
on public.relationship_memory
for insert
to authenticated
with check (
  user_id = auth.uid()
);


drop policy if exists
  "relationship_memory_update_own"
on public.relationship_memory;

create policy
  "relationship_memory_update_own"
on public.relationship_memory
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


-- ============================================================
-- 13. OPPORTUNITY ACTION POLICIES
-- ============================================================

drop policy if exists
  "opportunity_actions_select_own"
on public.opportunity_actions;

create policy
  "opportunity_actions_select_own"
on public.opportunity_actions
for select
to authenticated
using (
  user_id = auth.uid()
);


drop policy if exists
  "opportunity_actions_insert_own"
on public.opportunity_actions;

create policy
  "opportunity_actions_insert_own"
on public.opportunity_actions
for insert
to authenticated
with check (
  user_id = auth.uid()
);


-- ============================================================
-- 14. INTRODUCTION POLICIES
-- ============================================================

drop policy if exists
  "opportunity_introductions_select_participants"
on public.opportunity_introductions;

create policy
  "opportunity_introductions_select_participants"
on public.opportunity_introductions
for select
to authenticated
using (
  requester_id = auth.uid()
  or connector_id = auth.uid()
  or target_id = auth.uid()
);


drop policy if exists
  "opportunity_introductions_insert_requester"
on public.opportunity_introductions;

create policy
  "opportunity_introductions_insert_requester"
on public.opportunity_introductions
for insert
to authenticated
with check (
  requester_id = auth.uid()
);


drop policy if exists
  "opportunity_introductions_update_participants"
on public.opportunity_introductions;

create policy
  "opportunity_introductions_update_participants"
on public.opportunity_introductions
for update
to authenticated
using (
  requester_id = auth.uid()
  or connector_id = auth.uid()
  or target_id = auth.uid()
)
with check (
  requester_id = auth.uid()
  or connector_id = auth.uid()
  or target_id = auth.uid()
);


-- ============================================================
-- 15. OUTCOME POLICIES
-- ============================================================

drop policy if exists
  "opportunity_outcomes_select_own"
on public.opportunity_outcomes;

create policy
  "opportunity_outcomes_select_own"
on public.opportunity_outcomes
for select
to authenticated
using (
  user_id = auth.uid()
);


drop policy if exists
  "opportunity_outcomes_insert_own"
on public.opportunity_outcomes;

create policy
  "opportunity_outcomes_insert_own"
on public.opportunity_outcomes
for insert
to authenticated
with check (
  user_id = auth.uid()
);


-- ============================================================
-- 16. TWIN LEARNING POLICIES
-- ============================================================

drop policy if exists
  "twin_learning_events_select_own"
on public.twin_learning_events;

create policy
  "twin_learning_events_select_own"
on public.twin_learning_events
for select
to authenticated
using (
  user_id = auth.uid()
);


drop policy if exists
  "twin_learning_events_insert_own"
on public.twin_learning_events;

create policy
  "twin_learning_events_insert_own"
on public.twin_learning_events
for insert
to authenticated
with check (
  user_id = auth.uid()
);


-- ============================================================
-- 17. SEED THE INITIAL OPPORTUNITY CATEGORIES
-- ============================================================

insert into public.opportunities (
  opportunity_type,
  title,
  description,
  skills,
  status
)
select
  'career',
  'Career opportunity',
  'A career opportunity aligned with the user''s Twin goals, skills, and professional direction.',
  array[
    'career growth',
    'professional development',
    'technology'
  ],
  'active'
where not exists (
  select 1
  from public.opportunities
  where opportunity_type = 'career'
    and title = 'Career opportunity'
);


insert into public.opportunities (
  opportunity_type,
  title,
  description,
  skills,
  status
)
select
  'technical collaboration',
  'Technical collaboration opportunity',
  'A technical collaboration opportunity where complementary skills and professional interests can create a useful project or working relationship.',
  array[
    'software',
    'engineering',
    'AI',
    'collaboration'
  ],
  'active'
where not exists (
  select 1
  from public.opportunities
  where opportunity_type = 'technical collaboration'
    and title = 'Technical collaboration opportunity'
);


insert into public.opportunities (
  opportunity_type,
  title,
  description,
  skills,
  status
)
select
  'mentorship',
  'Mentorship opportunity',
  'A mentorship opportunity connecting complementary experience, goals, and professional development needs.',
  array[
    'mentorship',
    'career development',
    'knowledge sharing'
  ],
  'active'
where not exists (
  select 1
  from public.opportunities
  where opportunity_type = 'mentorship'
    and title = 'Mentorship opportunity'
);


insert into public.opportunities (
  opportunity_type,
  title,
  description,
  skills,
  status
)
select
  'referral network',
  'Referral and network opportunity',
  'A referral or network opportunity where an existing relationship may provide a useful introduction or professional connection.',
  array[
    'networking',
    'referrals',
    'professional relationships'
  ],
  'active'
where not exists (
  select 1
  from public.opportunities
  where opportunity_type = 'referral network'
    and title = 'Referral and network opportunity'
);

create or replace function public.record_relationship_introduction(
  p_user_id uuid,
  p_person_id uuid,
  p_successful boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.relationship_memory (
    user_id,
    person_id,
    relationship_strength,
    interaction_count,
    successful_introductions,
    failed_introductions,
    last_interaction_at
  )
  values (
    p_user_id,
    p_person_id,
    case
      when p_successful then 70
      else 35
    end,
    1,
    case
      when p_successful then 1
      else 0
    end,
    case
      when p_successful then 0
      else 1
    end,
    now()
  )
  on conflict (
    user_id,
    person_id
  )
  do update set
    interaction_count =
      public.relationship_memory.interaction_count + 1,

    successful_introductions =
      public.relationship_memory.successful_introductions +
      case
        when p_successful then 1
        else 0
      end,

    failed_introductions =
      public.relationship_memory.failed_introductions +
      case
        when p_successful then 0
        else 1
      end,

    relationship_strength =
      least(
        100,
        greatest(
          0,
          public.relationship_memory.relationship_strength +
          case
            when p_successful then 5
            else -5
          end
        )
      ),

    last_interaction_at =
      now(),

    updated_at =
      now();
end;
$$;
-- ============================================================
-- END
-- ============================================================