-- The 19th Hole: an optional, per-trip feature for fun trip statistics
-- (drinks, birdies, three-putts, lost balls, water balls, mulligans, and
-- any trip-specific counters the captain adds). Deliberately separate
-- from scores/games/expenses -- nothing here feeds handicaps, standings,
-- or money. See src/components/nineteenth-hole/ for the UI.

-- One settings row per trip, created the first time a captain turns the
-- feature on. Its absence means "never configured" -- the app treats
-- that identically to enabled = false.
create table public.nineteenth_hole_settings (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  enabled boolean not null default false,
  who_can_record text not null default 'everyone' check (who_can_record in ('everyone', 'captains_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_nineteenth_hole_settings_updated_at
  before update on public.nineteenth_hole_settings
  for each row execute function public.set_updated_at();

comment on table public.nineteenth_hole_settings is
  'Per-trip on/off switch and recording policy for The 19th Hole. One row per trip, upserted by the trip captain -- see enable/disable/setWhoCanRecord actions in src/actions/nineteenth-hole.ts.';

-- The counters a trip tracks -- the six defaults (seeded by the enable
-- action, not by this migration, so a trip's counter list only exists
-- once a captain actually turns the feature on) plus any custom ones a
-- captain adds. A default counter can be deactivated but not deleted
-- (see the delete policy below); a custom counter can be fully removed.
create table public.nineteenth_hole_counters (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  key text not null,
  label text not null check (char_length(trim(label)) between 1 and 40),
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (trip_id, key)
);

create index idx_nineteenth_hole_counters_trip_id on public.nineteenth_hole_counters(trip_id);

comment on table public.nineteenth_hole_counters is
  'Active/inactive counter definitions per trip (Drinks, Birdies, ... plus custom). key is a stable slug used by nineteenth_hole_activity; label is what the captain sees and can rename.';

-- One row per individual +1/-1 tap -- never just a running total -- so
-- the Activity list, Undo, and captain/golfer corrections all have a
-- real record to act on. quantity is signed (+1 add, -1 remove); a
-- corrected/undone row is soft-deleted (deleted_at/deleted_by set) so
-- it drops out of totals and the default activity view without
-- destroying the audit trail.
create table public.nineteenth_hole_activity (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  round_id uuid references public.rounds(id) on delete set null,
  trip_member_id uuid not null references public.trip_members(id) on delete cascade,
  counter_id uuid not null references public.nineteenth_hole_counters(id) on delete cascade,
  quantity smallint not null check (quantity <> 0),
  recorded_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_nineteenth_hole_activity_trip_id on public.nineteenth_hole_activity(trip_id, created_at desc);
create index idx_nineteenth_hole_activity_round_id on public.nineteenth_hole_activity(round_id);
create index idx_nineteenth_hole_activity_counter_id on public.nineteenth_hole_activity(counter_id);
create index idx_nineteenth_hole_activity_trip_member_id on public.nineteenth_hole_activity(trip_member_id);

comment on table public.nineteenth_hole_activity is
  'Append-mostly log of every 19th Hole +1/-1. Never update quantity/counter/golfer on an existing row -- correcting an entry means soft-deleting it (deleted_at/deleted_by) and, if needed, recording a fresh one.';

-- Whether the CURRENT USER may record 19th Hole activity for p_trip_id
-- right now: the feature must be enabled, and either the caller is the
-- trip captain (always allowed once enabled) or the trip's recording
-- policy is 'everyone' and the caller is an active trip member.
create or replace function public.nineteenth_hole_can_record(p_trip_id uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_enabled boolean;
  v_who text;
begin
  select enabled, who_can_record into v_enabled, v_who
  from public.nineteenth_hole_settings
  where trip_id = p_trip_id;

  if v_enabled is not true then
    return false;
  end if;

  if public.is_trip_captain(p_trip_id) then
    return true;
  end if;

  return v_who = 'everyone' and public.is_trip_member(p_trip_id);
end;
$$;

-- Keeps every activity row internally consistent: the counter and the
-- credited golfer must belong to the same trip as the activity row, the
-- counter must currently be active, and an attached round (if any) must
-- also belong to that trip. Mirrors validate_side_game_participant()'s
-- role for side_game_participants.
create or replace function public.validate_nineteenth_hole_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_counter_trip_id uuid;
  v_counter_active boolean;
  v_member_trip_id uuid;
  v_round_trip_id uuid;
begin
  select trip_id, is_active into v_counter_trip_id, v_counter_active
  from public.nineteenth_hole_counters where id = new.counter_id;

  if v_counter_trip_id is null or v_counter_trip_id != new.trip_id then
    raise exception 'nineteenth_hole_activity.counter_id must belong to the same trip';
  end if;
  if not v_counter_active then
    raise exception 'This counter is not active for this trip';
  end if;

  select trip_id into v_member_trip_id
  from public.trip_members where id = new.trip_member_id;
  if v_member_trip_id is null or v_member_trip_id != new.trip_id then
    raise exception 'nineteenth_hole_activity.trip_member_id must belong to the same trip';
  end if;

  if new.round_id is not null then
    select trip_id into v_round_trip_id from public.rounds where id = new.round_id;
    if v_round_trip_id is null or v_round_trip_id != new.trip_id then
      raise exception 'nineteenth_hole_activity.round_id must belong to the same trip';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_nineteenth_hole_activity_trigger
  before insert on public.nineteenth_hole_activity
  for each row execute function public.validate_nineteenth_hole_activity();

alter table public.nineteenth_hole_settings enable row level security;
alter table public.nineteenth_hole_counters enable row level security;
alter table public.nineteenth_hole_activity enable row level security;

-- Settings: any trip member can see whether/how the feature is
-- configured; only the captain can turn it on/off or change who can
-- record.
create policy nineteenth_hole_settings_select_members on public.nineteenth_hole_settings
  for select using (public.is_trip_member(trip_id));

create policy nineteenth_hole_settings_insert_captain on public.nineteenth_hole_settings
  for insert with check (public.is_trip_captain(trip_id));

create policy nineteenth_hole_settings_update_captain on public.nineteenth_hole_settings
  for update using (public.is_trip_captain(trip_id)) with check (public.is_trip_captain(trip_id));

-- Counters: any trip member can see the list; only the captain can add,
-- rename/toggle, or remove one -- and only a non-default (custom)
-- counter can actually be deleted, so the six built-ins can always be
-- re-activated later instead of needing to be recreated from scratch.
create policy nineteenth_hole_counters_select_members on public.nineteenth_hole_counters
  for select using (public.is_trip_member(trip_id));

create policy nineteenth_hole_counters_insert_captain on public.nineteenth_hole_counters
  for insert with check (public.is_trip_captain(trip_id));

create policy nineteenth_hole_counters_update_captain on public.nineteenth_hole_counters
  for update using (public.is_trip_captain(trip_id)) with check (public.is_trip_captain(trip_id));

create policy nineteenth_hole_counters_delete_captain on public.nineteenth_hole_counters
  for delete using (public.is_trip_captain(trip_id) and not is_default);

-- Activity: any trip member can view it (read-only visibility -- the
-- point of the feature is a shared trip record); who can add an entry
-- follows the trip's own recording policy via
-- nineteenth_hole_can_record(); correcting (soft-deleting) an entry is
-- limited to the trip captain or whoever originally recorded it.
create policy nineteenth_hole_activity_select_members on public.nineteenth_hole_activity
  for select using (public.is_trip_member(trip_id));

create policy nineteenth_hole_activity_insert_authorized on public.nineteenth_hole_activity
  for insert with check (
    public.nineteenth_hole_can_record(trip_id)
    and recorded_by = (select auth.uid())
  );

create policy nineteenth_hole_activity_update_own_or_captain on public.nineteenth_hole_activity
  for update
  using (public.is_trip_captain(trip_id) or recorded_by = (select auth.uid()))
  with check (public.is_trip_captain(trip_id) or recorded_by = (select auth.uid()));
