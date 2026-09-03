-- Golf Profile + manual handicap entry (SplitFairway golf-scoring MVP,
-- phase 2 of the implementation order). Everything here is self-reported
-- by the golfer — there is no official USGA/GHIN API integration and
-- none is implied anywhere in these comments, column names, or the UI
-- text that reads from them. See handicap_source below.

create type public.handicap_source as enum ('manual', 'ghin_screenshot_import');
create type public.dominant_hand as enum ('right', 'left');

create table public.golf_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  -- Self-reported by the golfer, never fetched from GHIN.com. Digits
  -- only; the full value is only ever selected by its owner (see RLS
  -- below) — other trip members reach handicap fields exclusively
  -- through get_trip_mate_handicap(), which never selects this column.
  ghin_number text,
  handicap_index numeric(4,1),
  handicap_revision_date date,
  handicap_source public.handicap_source not null default 'manual',
  home_club text,
  golf_association text,
  preferred_tee text,
  dominant_hand public.dominant_hand,
  -- Set server-side by handle_handicap_change() below whenever
  -- handicap_index/handicap_revision_date actually change — never
  -- client-writable, so it can't be backdated or spoofed.
  handicap_updated_at timestamptz not null default now(),
  -- True only if the golfer expressly chose to keep their GHIN
  -- screenshot after import (phase 3) instead of the default
  -- delete-after-extraction behavior. Unused until that phase ships;
  -- present now so the column doesn't require a later migration on a
  -- table that already has RLS/production data.
  ghin_screenshot_retained boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint golf_profiles_ghin_number_format check (ghin_number is null or ghin_number ~ '^[0-9]{1,10}$'),
  -- WHS handicap indexes run roughly -10.0 (a strong "plus" handicap)
  -- to 54.0. Generous bounds — this is a sanity check, not a rules
  -- engine.
  constraint golf_profiles_handicap_range check (
    handicap_index is null or (handicap_index >= -10.0 and handicap_index <= 54.0)
  )
);
comment on table public.golf_profiles is
  'One row per user. ghin_number and handicap_index are entered by the golfer themselves — either typed in directly or transcribed from a GHIN screenshot the golfer reviews and confirms (handicap_source = ghin_screenshot_import). SplitFairway has no connection to the official USGA/GHIN service and does not verify these values. Full ghin_number is selectable only by its owner (see RLS); other trip members can read handicap fields only via get_trip_mate_handicap(), which never returns this column.';

comment on column public.golf_profiles.handicap_source is
  'manual = typed in directly. ghin_screenshot_import = the golfer photographed/uploaded their own GHIN screen and confirmed the transcribed values before saving. Neither implies SplitFairway retrieved anything from GHIN directly.';

create index golf_profiles_user_id_idx on public.golf_profiles (user_id);

-- Append-only. The only writer is handle_handicap_change() below,
-- which runs as this migration's owning role and so is unaffected by
-- the RLS policies applied to this table (same pattern as
-- handle_new_user() writing to profiles despite profiles' own RLS).
-- No insert/update/delete policy is granted to `authenticated` at all.
create table public.handicap_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  handicap_index numeric(4,1) not null,
  handicap_revision_date date,
  source public.handicap_source not null,
  recorded_at timestamptz not null default now()
);
comment on table public.handicap_history is
  'Append-only log of golf_profiles.handicap_index changes, written only by the handle_handicap_change() trigger. Never inserted, updated, or deleted directly by any client — this is the audit trail behind the "Handicap history" profile feature.';

create index handicap_history_user_id_recorded_at_idx on public.handicap_history (user_id, recorded_at desc);

-- Sets handicap_updated_at and appends a handicap_history row whenever
-- handicap_index or handicap_revision_date actually change (including
-- on first insert) — never on an unrelated field edit like home_club.
create or replace function public.handle_handicap_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.handicap_index is not distinct from old.handicap_index
     and new.handicap_revision_date is not distinct from old.handicap_revision_date then
    return new;
  end if;

  if new.handicap_index is null then
    return new;
  end if;

  new.handicap_updated_at := now();

  insert into public.handicap_history (user_id, handicap_index, handicap_revision_date, source)
  values (new.user_id, new.handicap_index, new.handicap_revision_date, new.handicap_source);

  return new;
end;
$$;

create trigger trg_golf_profiles_handicap_change
  before insert or update on public.golf_profiles
  for each row execute function public.handle_handicap_change();

create trigger trg_golf_profiles_updated_at
  before update on public.golf_profiles
  for each row execute function public.set_updated_at();

-- Cross-user read path for handicap info: trip mates (and the owner)
-- get handicap_index/date/source/home_club/preferred_tee — deliberately
-- never ghin_number, so the full GHIN number never leaves the server
-- for anyone but its owner, regardless of RLS on the base table.
create or replace function public.get_trip_mate_handicap(p_user_id uuid)
returns table (
  user_id uuid,
  handicap_index numeric,
  handicap_revision_date date,
  handicap_source public.handicap_source,
  handicap_updated_at timestamptz,
  home_club text,
  preferred_tee text
)
language sql
security definer
stable
set search_path = public
as $$
  select gp.user_id, gp.handicap_index, gp.handicap_revision_date, gp.handicap_source,
         gp.handicap_updated_at, gp.home_club, gp.preferred_tee
  from public.golf_profiles gp
  where gp.user_id = p_user_id
    and (gp.user_id = auth.uid() or public.shares_active_trip_with(gp.user_id));
$$;

comment on function public.get_trip_mate_handicap(uuid) is
  'Read path for a trip mate''s handicap. Deliberately excludes ghin_number — callers other than the profile owner never receive it, no matter what RLS on golf_profiles would otherwise allow. Returns zero rows if the caller does not share an active trip with p_user_id.';

alter table public.golf_profiles enable row level security;
alter table public.handicap_history enable row level security;

-- Supabase's default schema privileges grant anon broad table access on
-- every new `public` table (confirmed by prior migrations in this
-- project) — revoke it explicitly rather than relying on RLS alone.
revoke all on public.golf_profiles from anon;
revoke all on public.handicap_history from anon;

grant select, insert, update, delete on public.golf_profiles to authenticated;
grant select on public.handicap_history to authenticated;

create policy "golf_profiles_select_own" on public.golf_profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy "golf_profiles_insert_own" on public.golf_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "golf_profiles_update_own" on public.golf_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "golf_profiles_delete_own" on public.golf_profiles
  for delete to authenticated
  using (user_id = auth.uid());

create policy "handicap_history_select_own" on public.handicap_history
  for select to authenticated
  using (user_id = auth.uid());

-- New functions default to PUBLIC execute in Postgres unless revoked —
-- lock all three down explicitly, same convention as every other
-- privileged function in this project.
revoke all on function public.handle_handicap_change() from public;
revoke all on function public.get_trip_mate_handicap(uuid) from public;

revoke execute on function public.get_trip_mate_handicap(uuid) from anon;
grant execute on function public.get_trip_mate_handicap(uuid) to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.get_trip_mate_handicap(uuid)', 'execute') then
    raise exception 'anon must not be able to execute get_trip_mate_handicap';
  end if;
  if not has_function_privilege('authenticated', 'public.get_trip_mate_handicap(uuid)', 'execute') then
    raise exception 'authenticated must be able to execute get_trip_mate_handicap';
  end if;
  if has_table_privilege('anon', 'public.golf_profiles', 'select') then
    raise exception 'anon must not have any grant on golf_profiles';
  end if;
  if has_table_privilege('anon', 'public.handicap_history', 'select') then
    raise exception 'anon must not have any grant on handicap_history';
  end if;
end $$;
