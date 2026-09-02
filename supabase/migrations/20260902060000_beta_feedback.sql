-- Private-beta feedback: a lightweight, durable place for the in-app
-- "Feedback" button to write to, independent of whether an email
-- provider is configured. Feedback is personal to the sender (not
-- trip data), so it gets its own simple RLS shape rather than reusing
-- is_trip_member()/is_trip_captain().

create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Optional — set when the feedback button was used from inside a
  -- trip, so a report can be cross-referenced, but never required
  -- (the button is available everywhere, including the dashboard).
  trip_id uuid references public.trips(id) on delete set null,
  page_path text not null,
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);
comment on table public.beta_feedback is 'Free-text feedback submitted via the in-app beta feedback button.';

create index beta_feedback_user_id_idx on public.beta_feedback (user_id);
create index beta_feedback_created_at_idx on public.beta_feedback (created_at desc);

alter table public.beta_feedback enable row level security;

-- Supabase's default schema privileges grant anon and authenticated
-- broad table-level access on every new table in `public`; RLS (with
-- authenticated-only policies) is what actually blocks anon on every
-- other table in this project, and that's proven live in
-- rls_verification.sql rather than by table grants. For this new
-- table we go one step further and revoke anon's default grant
-- outright, so an anonymous caller is blocked even if a future policy
-- change ever mis-scoped a `using` clause.
revoke all on public.beta_feedback from anon;

-- Deliberately no update/delete policy — feedback is append-only, the
-- same convention as activity_log.
grant select, insert on public.beta_feedback to authenticated;

create policy "beta_feedback_select_own" on public.beta_feedback
  for select to authenticated
  using (user_id = auth.uid());

create policy "beta_feedback_insert_own" on public.beta_feedback
  for insert to authenticated
  with check (user_id = auth.uid());

-- Self-verify the grant state, same convention as every other migration
-- in this project: fail loudly at migration time rather than silently
-- ship a table anon can read or write.
do $$
begin
  if has_table_privilege('anon', 'public.beta_feedback', 'SELECT') then
    raise exception 'beta_feedback: anon must not have SELECT';
  end if;
  if has_table_privilege('anon', 'public.beta_feedback', 'INSERT') then
    raise exception 'beta_feedback: anon must not have INSERT';
  end if;
  if not has_table_privilege('authenticated', 'public.beta_feedback', 'SELECT') then
    raise exception 'beta_feedback: authenticated must have SELECT';
  end if;
  if not has_table_privilege('authenticated', 'public.beta_feedback', 'INSERT') then
    raise exception 'beta_feedback: authenticated must have INSERT';
  end if;
end $$;
