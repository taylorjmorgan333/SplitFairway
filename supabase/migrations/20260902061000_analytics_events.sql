-- Basic, first-party, non-invasive product analytics: a handful of key
-- funnel events (trip created, golfer invited, expense added, payment
-- reported/confirmed, invite accepted) so we can see beta usage without
-- a third-party tracking script. Deliberately minimal: no IP address,
-- no user agent, no device fingerprinting, no cross-site tracking, no
-- cookies — just "this signed-in user did this named thing" plus a
-- small JSON payload the caller controls.
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.analytics_events is 'First-party product-usage events. No IP/user-agent/device data is collected.';

create index analytics_events_event_name_idx on public.analytics_events (event_name, created_at desc);
create index analytics_events_user_id_idx on public.analytics_events (user_id);

alter table public.analytics_events enable row level security;

revoke all on public.analytics_events from anon;

-- Write-only from the client's perspective: a signed-in user can record
-- their own events, but there's no select policy at all — this table
-- is read via the Supabase dashboard/reporting, not the app's own API,
-- so no one can browse other users' event history through the app.
grant insert on public.analytics_events to authenticated;

create policy "analytics_events_insert_own" on public.analytics_events
  for insert to authenticated
  with check (user_id = auth.uid());

do $$
begin
  if has_table_privilege('anon', 'public.analytics_events', 'INSERT') then
    raise exception 'analytics_events: anon must not have INSERT';
  end if;
  if has_table_privilege('anon', 'public.analytics_events', 'SELECT') then
    raise exception 'analytics_events: anon must not have SELECT';
  end if;
  if not has_table_privilege('authenticated', 'public.analytics_events', 'INSERT') then
    raise exception 'analytics_events: authenticated must have INSERT';
  end if;
end $$;
