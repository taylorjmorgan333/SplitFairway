-- Development seed script.
--
-- SAFE BY DESIGN: this does not create fake auth users or bypass the
-- app's authorization rules. Instead it drives the same RPCs the real
-- app calls (create_trip, invite_trip_member) impersonating real
-- accounts you've already signed up through the app, via the same
-- request.jwt.claims trick Supabase uses for RLS testing. If the
-- looked-up accounts don't exist, it does nothing and tells you so.
--
-- STEP 1 — sign up two real accounts through the running app
--   (npm run dev -> /signup), e.g.:
--     captain@example.com
--     member@example.com
--
-- STEP 2 — edit the two emails below to match what you used.
--
-- STEP 3 — run this file against your Supabase project:
--     supabase db execute --file supabase/seed/seed.sql
--   or paste it into the Supabase SQL editor.
--
-- Re-running this script creates ANOTHER sample trip each time (it
-- does not delete or reset existing data) — delete a trip from the
-- dashboard, or by id in the SQL editor, if you want to start over.

do $$
declare
  v_captain_email text := 'captain@example.com';   -- <-- edit me
  v_member_email  text := 'member@example.com';    -- <-- edit me
  v_captain_id uuid;
  v_member_id uuid;
  v_trip_id uuid;
  v_invite jsonb;
  v_expense1_id uuid;
  v_expense2_id uuid;
  v_member_trip_member_id uuid;
begin
  select id into v_captain_id from auth.users where email = v_captain_email;
  select id into v_member_id from auth.users where email = v_member_email;

  if v_captain_id is null then
    raise notice 'No account found for %, sign up through the app first — skipping seed.', v_captain_email;
    return;
  end if;

  -- Act as the captain: create a sample trip and (if the member
  -- account exists) invite them.
  perform set_config('request.jwt.claims', json_build_object('sub', v_captain_id, 'role', 'authenticated', 'email', v_captain_email)::text, true);
  set local role authenticated;

  select (public.create_trip(
    'Pebble Ridge Fall Trip',
    'Bandon, OR',
    current_date + interval '30 days',
    current_date + interval '33 days',
    'USD',
    'Sample seeded trip for local development.'
  )).id into v_trip_id;

  insert into public.expenses (trip_id, title, category, total_amount_cents, split_method, created_by, expense_date)
  values (v_trip_id, 'Lodging — the Dunes house', 'lodging', 240000, 'equal', v_captain_id, current_date)
  returning id into v_expense1_id;

  insert into public.expenses (trip_id, title, category, total_amount_cents, split_method, created_by, expense_date)
  values (v_trip_id, 'Saturday tee times (2 rounds)', 'golf', 96000, 'equal', v_captain_id, current_date)
  returning id into v_expense2_id;

  if v_member_id is not null then
    select public.invite_trip_member(v_trip_id, v_member_email, 'Sample Member', 'member') into v_invite;
  else
    raise notice 'No account found for %, skipping invite (trip still created).', v_member_email;
  end if;

  reset role;

  -- If the member account exists and has already accepted an
  -- invitation to this trip in a prior run, log a sample payment from
  -- them. This step is best-effort and silently does nothing on a
  -- fresh member who hasn't accepted yet — accept the invite through
  -- the app first, then re-run this script to add the payment.
  if v_member_id is not null then
    select id into v_member_trip_member_id
    from public.trip_members
    where trip_id = v_trip_id and user_id = v_member_id and status = 'active';

    if v_member_trip_member_id is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', v_member_id, 'role', 'authenticated', 'email', v_member_email)::text, true);
      set local role authenticated;
      insert into public.payments (trip_id, payer_member_id, amount_cents, payment_method, reported_by, paid_at, reference_note)
      values (v_trip_id, v_member_trip_member_id, 42000, 'venmo', v_member_id, now(), 'Sample seeded payment');
      reset role;
    end if;
  end if;

  raise notice 'Seeded trip % for captain %', v_trip_id, v_captain_email;
end $$;
