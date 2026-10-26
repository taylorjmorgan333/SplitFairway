-- iOS waitlist. NOT APPLIED by the change that added this file.
-- Run it yourself in the Supabase SQL editor or via the Supabase CLI
-- when you want the public email form to store addresses. Until then
-- the server action falls back to emailing FEEDBACK_TO_ADDRESS through
-- the existing Resend provider, and tells the visitor the list is not
-- on if that is not configured either.
--
-- Addresses are not readable by anon or authenticated. Inserts go
-- through join_ios_waitlist(), which is the only entry point. Read the
-- rows from the Supabase dashboard as the table owner.

create table public.ios_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null,
  created_at timestamptz not null default now(),
  constraint ios_waitlist_email_unique unique (email),
  constraint ios_waitlist_email_length check (char_length(email) between 3 and 320),
  constraint ios_waitlist_email_shape check (
    email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint ios_waitlist_source_check check (source in ('home_footer', 'trip_mode'))
);

comment on table public.ios_waitlist is
  'Email addresses from the public iOS waitlist. No select policy for anon or authenticated.';

create index ios_waitlist_created_at_idx on public.ios_waitlist (created_at desc);

alter table public.ios_waitlist enable row level security;

revoke all on public.ios_waitlist from anon, authenticated;

create or replace function public.join_ios_waitlist(p_email text, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_source text := btrim(coalesce(p_source, ''));
  v_recent integer;
begin
  if char_length(v_email) > 320
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_source not in ('home_footer', 'trip_mode') then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- A coarse brake so a script cannot fill the table. Not a per-person
  -- limit: this function does not see a trustworthy client identity.
  select count(*) into v_recent
  from public.ios_waitlist
  where created_at > now() - interval '1 hour';

  if v_recent >= 300 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.ios_waitlist (email, source)
  values (v_email, v_source)
  on conflict (email) do nothing;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.join_ios_waitlist(text, text) from public;
grant execute on function public.join_ios_waitlist(text, text) to anon, authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.ios_waitlist', 'SELECT') then
    raise exception 'ios_waitlist: anon must not have SELECT';
  end if;
  if has_table_privilege('anon', 'public.ios_waitlist', 'INSERT') then
    raise exception 'ios_waitlist: anon must not have INSERT';
  end if;
  if has_table_privilege('authenticated', 'public.ios_waitlist', 'SELECT') then
    raise exception 'ios_waitlist: authenticated must not have SELECT';
  end if;
  if has_function_privilege('anon', 'public.join_ios_waitlist(text, text)', 'EXECUTE') is not true then
    raise exception 'ios_waitlist: anon must be able to execute join_ios_waitlist';
  end if;
end $$;
