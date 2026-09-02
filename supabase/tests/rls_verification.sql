-- RLS / authorization verification script.
--
-- This is not a DDL migration — it creates three throwaway auth users,
-- exercises the app's real RPCs and RLS policies as each of them, and
-- deletes everything it created at the end. It is safe to run against
-- any environment (including production), because it never assumes
-- specific existing data and always cleans up after itself.
--
-- Run it with the Supabase SQL editor, `psql`, or:
--   supabase db execute --file supabase/tests/rls_verification.sql
--
-- It PASSES silently (raises `ALL RLS/AUTHORIZATION CHECKS PASSED`) or
-- raises an exception naming exactly which assertion failed.
--
-- What it proves:
--   1. An unauthenticated (anon) caller cannot call create_trip at all.
--   2. A trip's captain can create it, add an expense, invite a member,
--      and confirm a payment.
--   3. Once a member accepts their invitation, they can see the trip
--      and its expenses.
--   4. A member CANNOT: add an expense, delete the trip, self-confirm
--      a payment (neither via direct UPDATE nor by calling
--      confirm_payment()).
--   5. Co-treasurer support: the captain can promote that member to a
--      second, equal-authority captain, who can then invite a golfer
--      and confirm a payment themselves.
--   6. The "at least one active captain" trigger blocks demoting a
--      trip down to zero captains, even with two captains in play.
--   7. A completely unrelated user (never invited) can see NONE of the
--      trip's data — not the trip, not its payments.
--   8. The co-treasurer can delete the trip (captain-only action).
--   9. create_expense_with_shares(): anon can't call it at all, a
--      captain can use it to create an expense whose shares are
--      correctly split, a mismatched-sum split is rejected, and a
--      non-captain member is rejected outright.
--  10. update_expense_with_shares(): a non-captain member cannot call
--      it, and cannot directly UPDATE or DELETE an expense either; the
--      current captain can edit an expense and its shares are fully
--      replaced (recalculated) to match the new split; an edit whose
--      shares don't sum to the new total is rejected.
--  11. Once a member is removed from the trip, they can no longer be
--      referenced in a split — a new or edited expense naming them is
--      rejected at the database level.
--  12. Deleting an expense removes its expense_shares in the same
--      transaction (no orphaned shares left behind).
--
-- A second, independent do-block below covers the invitation lifecycle,
-- ownership transfer, and recipient-confirmed payments added in
-- 20260902050000_invitations_ownership_reminders.sql:
--  13. create_trip() sets owner_id to the creating captain.
--  14. A used (already-accepted) invitation token cannot be accepted a
--      second time — the atomic check-and-set UPDATE makes reuse
--      impossible, not just unlikely.
--  15. An expired invitation cannot be accepted.
--  16. A revoked invitation cannot be accepted, and revoking marks the
--      pending trip_members row 'removed'.
--  17. A non-captain member cannot resend or revoke an invitation.
--  18. resend_trip_invitation() invalidates the previous token (it can
--      no longer be accepted) while the freshly issued token works.
--  19. A captain who is NOT the trip's owner cannot transfer ownership;
--      the owner can, and it auto-promotes the new owner to captain.
--  20. A payment's designated recipient — even a non-captain — can
--      confirm it; a member who is neither the captain nor that
--      payment's recipient cannot.
--  21. invite_trip_member() is rate-limited (20/hour) rather than
--      allowing unbounded invitations.

do $$
declare
  v_captain uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_trip_id uuid;
  v_invite jsonb;
  v_raw_token text;
  v_expense_id uuid;
  v_payment_id uuid;
  v_member_trip_member_id uuid;
  v_captain_trip_member_id uuid;
  v_expense2_id uuid;
  v_share_sum bigint;
  v_count int;
  v_blocked boolean;
  v_payment_status public.payment_status;
begin
  -- 1. An anonymous caller must not be able to create a trip at all —
  -- this is the PUBLIC-grant gap fixed in
  -- 20260902025915_revoke_public_execute_on_sensitive_rpcs.sql.
  v_blocked := false;
  begin
    set local role anon;
    perform public.create_trip('Should never exist');
  exception when others then
    v_blocked := true;
  end;
  reset role;
  assert v_blocked, 'anon must not be able to call create_trip';

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  ('00000000-0000-0000-0000-000000000000', v_captain, 'authenticated', 'authenticated', 'rls-captain@example.com', crypt('pw', gen_salt('bf')), now(), now(), now(), '{}', '{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', v_member,  'authenticated', 'authenticated', 'rls-member@example.com',  crypt('pw', gen_salt('bf')), now(), now(), now(), '{}', '{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', v_outsider,'authenticated', 'authenticated', 'rls-outsider@example.com',crypt('pw', gen_salt('bf')), now(), now(), now(), '{}', '{}', false, '', '', '', '');

  -- Captain creates a trip, invites the member, adds an expense.
  perform set_config('request.jwt.claims', json_build_object('sub', v_captain, 'role', 'authenticated', 'email', 'rls-captain@example.com')::text, true);
  set local role authenticated;
  select (public.create_trip('RLS Verification Trip')).id into v_trip_id;
  select public.invite_trip_member(v_trip_id, 'rls-member@example.com', 'Test Member', 'member') into v_invite;
  v_raw_token := v_invite->>'token';

  insert into public.expenses (trip_id, title, total_amount_cents, created_by)
  values (v_trip_id, 'Lodging', 100000, v_captain)
  returning id into v_expense_id;
  reset role;

  -- Member accepts the invite.
  perform set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated', 'email', 'rls-member@example.com')::text, true);
  set local role authenticated;
  perform public.accept_trip_invitation(v_raw_token);

  select count(*) into v_count from public.trips where id = v_trip_id;
  assert v_count = 1, 'member should see trip after accepting invite';
  select count(*) into v_count from public.expenses where id = v_expense_id;
  assert v_count = 1, 'member should see expense';

  v_blocked := false;
  begin
    insert into public.expenses (trip_id, title, total_amount_cents, created_by)
    values (v_trip_id, 'Rogue expense', 5000, v_member);
  exception when others then
    v_blocked := true;
  end;
  assert v_blocked, 'member must not be able to insert an expense';
  reset role;

  -- create_expense_with_shares(): anon can't call it, a captain can,
  -- shares must sum to the total, and a non-captain member is rejected.
  v_blocked := false;
  begin
    set local role anon;
    perform public.create_expense_with_shares(
      v_trip_id, 'Should never exist', 10000,
      jsonb_build_array(jsonb_build_object('trip_member_id', gen_random_uuid(), 'amount_owed_cents', 10000))
    );
  exception when others then
    v_blocked := true;
  end;
  reset role;
  assert v_blocked, 'anon must not be able to call create_expense_with_shares';

  perform set_config('request.jwt.claims', json_build_object('sub', v_captain, 'role', 'authenticated', 'email', 'rls-captain@example.com')::text, true);
  set local role authenticated;

  select (public.create_expense_with_shares(
    v_trip_id, 'Rental car', 12000,
    jsonb_build_array(
      jsonb_build_object('trip_member_id', (select id from public.trip_members where trip_id = v_trip_id and user_id = v_captain), 'amount_owed_cents', 6000),
      jsonb_build_object('trip_member_id', (select id from public.trip_members where trip_id = v_trip_id and user_id = v_member), 'amount_owed_cents', 6000)
    )
  )).id into v_expense2_id;

  select coalesce(sum(amount_owed_cents), 0) into v_share_sum
  from public.expense_shares where expense_id = v_expense2_id;
  assert v_share_sum = 12000, 'expense shares must sum to the expense total';

  v_blocked := false;
  begin
    perform public.create_expense_with_shares(
      v_trip_id, 'Mismatched split', 10000,
      jsonb_build_array(jsonb_build_object('trip_member_id', (select id from public.trip_members where trip_id = v_trip_id and user_id = v_captain), 'amount_owed_cents', 4000))
    );
  exception when others then
    v_blocked := true;
  end;
  assert v_blocked, 'a split that does not sum to the total must be rejected';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated', 'email', 'rls-member@example.com')::text, true);
  set local role authenticated;
  v_blocked := false;
  begin
    perform public.create_expense_with_shares(
      v_trip_id, 'Should be rejected', 5000,
      jsonb_build_array(jsonb_build_object('trip_member_id', (select id from public.trip_members where trip_id = v_trip_id and user_id = v_member), 'amount_owed_cents', 5000))
    );
  exception when others then
    v_blocked := true;
  end;
  assert v_blocked, 'a non-captain member must not be able to call create_expense_with_shares';

  -- Still in the member's authenticated session from the check above —
  -- the original member-negative-tests continue here unchanged.
  v_blocked := false;
  begin
    delete from public.trips where id = v_trip_id;
    get diagnostics v_count = row_count;
    if v_count = 0 then v_blocked := true; end if;
  exception when others then
    v_blocked := true;
  end;
  assert v_blocked, 'member must not be able to delete the trip';

  insert into public.payments (trip_id, payer_member_id, amount_cents, payment_method, reported_by, paid_at)
  select v_trip_id, tm.id, 25000, 'venmo', v_member, now()
  from public.trip_members tm where tm.trip_id = v_trip_id and tm.user_id = v_member
  returning id into v_payment_id;

  v_blocked := false;
  begin
    update public.payments set status = 'confirmed' where id = v_payment_id;
    get diagnostics v_count = row_count;
    if v_count = 0 then v_blocked := true; end if;
  exception when others then
    v_blocked := true;
  end;
  assert v_blocked, 'member must not be able to self-confirm a payment via direct update';

  v_blocked := false;
  begin
    perform public.confirm_payment(v_payment_id);
  exception when others then
    v_blocked := true;
  end;
  assert v_blocked, 'member must not be able to call confirm_payment';
  reset role;

  -- Co-treasurer: the captain promotes the member to a second, equal
  -- captain. set_trip_member_role() is itself captain-only, and there
  -- is no cardinality limit on how many active captains a trip can
  -- have.
  select id into v_member_trip_member_id
  from public.trip_members where trip_id = v_trip_id and user_id = v_member;

  perform set_config('request.jwt.claims', json_build_object('sub', v_captain, 'role', 'authenticated', 'email', 'rls-captain@example.com')::text, true);
  set local role authenticated;
  perform public.set_trip_member_role(v_member_trip_member_id, 'captain');
  reset role;

  -- The freshly promoted co-treasurer should now be able to do
  -- captain-only things themselves: invite a golfer and confirm the
  -- payment the original captain couldn't get to.
  perform set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated', 'email', 'rls-member@example.com')::text, true);
  set local role authenticated;
  perform public.invite_trip_member(v_trip_id, 'rls-second-invite@example.com', 'Invited By Co-Treasurer', 'member');
  perform public.confirm_payment(v_payment_id);
  select status into v_payment_status from public.payments where id = v_payment_id;
  assert v_payment_status = 'confirmed', 'co-treasurer confirm_payment should mark it confirmed';
  reset role;

  -- The "at least one active captain" trigger must block driving a
  -- trip down to zero captains even once a second captain exists:
  -- demote the original captain (fine, one remains), then try to
  -- demote the last one (must be blocked).
  select id into v_captain_trip_member_id
  from public.trip_members where trip_id = v_trip_id and user_id = v_captain;

  perform set_config('request.jwt.claims', json_build_object('sub', v_captain, 'role', 'authenticated', 'email', 'rls-captain@example.com')::text, true);
  set local role authenticated;
  perform public.set_trip_member_role(v_captain_trip_member_id, 'member');
  reset role;

  v_blocked := false;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated', 'email', 'rls-member@example.com')::text, true);
    set local role authenticated;
    perform public.set_trip_member_role(v_member_trip_member_id, 'member');
  exception when others then
    v_blocked := true;
  end;
  reset role;
  assert v_blocked, 'must not be able to demote a trip''s last remaining captain';

  -- Outsider was never invited and must see nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', v_outsider, 'role', 'authenticated', 'email', 'rls-outsider@example.com')::text, true);
  set local role authenticated;
  select count(*) into v_count from public.trips where id = v_trip_id;
  assert v_count = 0, 'outsider must not see the trip';
  select count(*) into v_count from public.payments where id = v_payment_id;
  assert v_count = 0, 'outsider must not see the payment';
  reset role;

  -- update_expense_with_shares(): v_captain was just demoted to a
  -- regular member above, so this also proves a non-captain can't edit
  -- or directly touch an expense — the co-treasurer (v_member) is the
  -- trip's only remaining captain at this point.
  perform set_config('request.jwt.claims', json_build_object('sub', v_captain, 'role', 'authenticated', 'email', 'rls-captain@example.com')::text, true);
  set local role authenticated;

  v_blocked := false;
  begin
    perform public.update_expense_with_shares(
      v_expense2_id, 'Should be rejected', 12000,
      jsonb_build_array(jsonb_build_object('trip_member_id', v_captain_trip_member_id, 'amount_owed_cents', 12000))
    );
  exception when others then
    v_blocked := true;
  end;
  assert v_blocked, 'a non-captain (demoted) member must not be able to call update_expense_with_shares';

  v_blocked := false;
  begin
    update public.expenses set title = 'Should be rejected' where id = v_expense2_id;
    get diagnostics v_count = row_count;
    if v_count = 0 then v_blocked := true; end if;
  exception when others then
    v_blocked := true;
  end;
  assert v_blocked, 'a non-captain member must not be able to directly update an expense';

  v_blocked := false;
  begin
    delete from public.expenses where id = v_expense2_id;
    get diagnostics v_count = row_count;
    if v_count = 0 then v_blocked := true; end if;
  exception when others then
    v_blocked := true;
  end;
  assert v_blocked, 'a non-captain member must not be able to directly delete an expense';
  reset role;

  -- The captain (co-treasurer) edits the expense — its shares must be
  -- fully recalculated (old ones replaced, not merely appended to) so
  -- they sum to exactly the new total.
  perform set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated', 'email', 'rls-member@example.com')::text, true);
  set local role authenticated;

  select (public.update_expense_with_shares(
    v_expense2_id, 'Rental car (updated)', 15000,
    jsonb_build_array(
      jsonb_build_object('trip_member_id', v_captain_trip_member_id, 'amount_owed_cents', 7500),
      jsonb_build_object('trip_member_id', v_member_trip_member_id, 'amount_owed_cents', 7500)
    )
  )).id into v_expense2_id;

  select coalesce(sum(amount_owed_cents), 0), count(*) into v_share_sum, v_count
  from public.expense_shares where expense_id = v_expense2_id;
  assert v_share_sum = 15000, 'update_expense_with_shares must recalculate shares to sum to the new total';
  assert v_count = 2, 'update_expense_with_shares must leave exactly the new shares behind, not stale ones';

  v_blocked := false;
  begin
    perform public.update_expense_with_shares(
      v_expense2_id, 'Mismatched edit', 20000,
      jsonb_build_array(jsonb_build_object('trip_member_id', v_captain_trip_member_id, 'amount_owed_cents', 5000))
    );
  exception when others then
    v_blocked := true;
  end;
  assert v_blocked, 'an edit whose shares do not sum to the new total must be rejected';

  -- Member removal: once a golfer's status is 'removed' (exactly what
  -- the app's removeMemberAction sets), they can no longer be
  -- referenced in a split at all — proving "removed members must not
  -- automatically be included" is enforced by the database, not just
  -- by the UI hiding them from the picker.
  update public.trip_members set status = 'removed' where id = v_captain_trip_member_id;

  v_blocked := false;
  begin
    perform public.update_expense_with_shares(
      v_expense2_id, 'Split including a removed member', 10000,
      jsonb_build_array(jsonb_build_object('trip_member_id', v_captain_trip_member_id, 'amount_owed_cents', 10000))
    );
  exception when others then
    v_blocked := true;
  end;
  assert v_blocked, 'a split referencing a removed member must be rejected';

  -- Deleting an expense must remove its shares as part of the same
  -- transaction — no orphaned expense_shares survive.
  delete from public.expenses where id = v_expense2_id;
  select count(*) into v_count from public.expense_shares where expense_id = v_expense2_id;
  assert v_count = 0, 'deleting an expense must remove its shares';
  reset role;

  -- The co-treasurer (not the original creator) deletes the trip,
  -- proving delete rights are shared, not tied to who created it.
  perform set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated', 'email', 'rls-member@example.com')::text, true);
  set local role authenticated;
  delete from public.trips where id = v_trip_id;
  get diagnostics v_count = row_count;
  assert v_count = 1, 'co-treasurer must be able to delete the trip';
  reset role;

  raise notice 'ALL RLS/AUTHORIZATION CHECKS PASSED';

  delete from auth.users where id in (v_captain, v_member, v_outsider);
end $$;

-- ---------------------------------------------------------------------
-- Part 2: invitation lifecycle, ownership transfer, recipient-confirmed
-- payments, and rate limiting (see the numbered list above, items
-- 13-21). Fully self-contained — its own users, its own trip, its own
-- cleanup — so it can run independently of (and after) part 1.
-- ---------------------------------------------------------------------
do $$
declare
  v_captain2 uuid := gen_random_uuid();
  v_member2 uuid := gen_random_uuid();
  v_recipient uuid := gen_random_uuid();
  v_new_owner uuid := gen_random_uuid();
  v_bystander uuid := gen_random_uuid();
  v_outsider2 uuid := gen_random_uuid();
  v_trip2_id uuid;
  v_invite jsonb;
  v_token_member2 text;
  v_token_recipient text;
  v_token_new_owner text;
  v_token_revoked text;
  v_token_expired text;
  v_token_old text;
  v_token_new text;
  v_token_bystander text;
  v_member2_tm_id uuid;
  v_recipient_tm_id uuid;
  v_new_owner_tm_id uuid;
  v_revoked_tm_id uuid;
  v_resend_tm_id uuid;
  v_captain2_tm_id uuid;
  v_payment_id uuid;
  v_payment2_id uuid;
  v_i int;
  v_blocked boolean;
  v_member_status public.member_status;
  v_invitation_status public.invitation_status;
  v_payment_status public.payment_status;
  v_owner_id uuid;
  v_role public.member_role;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  ('00000000-0000-0000-0000-000000000000', v_captain2,  'authenticated', 'authenticated', 'rls2-captain@example.com',   crypt('pw', gen_salt('bf')), now(), now(), now(), '{}', '{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', v_member2,   'authenticated', 'authenticated', 'rls2-member@example.com',    crypt('pw', gen_salt('bf')), now(), now(), now(), '{}', '{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', v_recipient, 'authenticated', 'authenticated', 'rls2-recipient@example.com', crypt('pw', gen_salt('bf')), now(), now(), now(), '{}', '{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', v_new_owner, 'authenticated', 'authenticated', 'rls2-newowner@example.com',  crypt('pw', gen_salt('bf')), now(), now(), now(), '{}', '{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', v_bystander, 'authenticated', 'authenticated', 'rls2-bystander@example.com', crypt('pw', gen_salt('bf')), now(), now(), now(), '{}', '{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', v_outsider2, 'authenticated', 'authenticated', 'rls2-outsider@example.com',  crypt('pw', gen_salt('bf')), now(), now(), now(), '{}', '{}', false, '', '', '', '');

  -- 13. create_trip() sets owner_id to the creating captain.
  perform set_config('request.jwt.claims', json_build_object('sub', v_captain2, 'role', 'authenticated', 'email', 'rls2-captain@example.com')::text, true);
  set local role authenticated;
  select (public.create_trip('RLS Invitations Trip')).id into v_trip2_id;
  reset role;

  select owner_id into v_owner_id from public.trips where id = v_trip2_id;
  assert v_owner_id = v_captain2, 'create_trip must set owner_id to the creating captain';

  perform set_config('request.jwt.claims', json_build_object('sub', v_captain2, 'role', 'authenticated', 'email', 'rls2-captain@example.com')::text, true);
  set local role authenticated;

  select public.invite_trip_member(v_trip2_id, 'rls2-member@example.com', 'Member Two', 'member') into v_invite;
  v_token_member2 := v_invite->>'token';

  select public.invite_trip_member(v_trip2_id, 'rls2-recipient@example.com', 'Recipient', 'member') into v_invite;
  v_token_recipient := v_invite->>'token';

  select public.invite_trip_member(v_trip2_id, 'rls2-newowner@example.com', 'New Owner', 'member') into v_invite;
  v_token_new_owner := v_invite->>'token';

  select public.invite_trip_member(v_trip2_id, 'rls2-bystander@example.com', 'Bystander', 'member') into v_invite;
  v_token_bystander := v_invite->>'token';

  select public.invite_trip_member(v_trip2_id, 'rls2-revoked@example.com', 'Revoked Invitee', 'member') into v_invite;
  v_token_revoked := v_invite->>'token';
  select id into v_revoked_tm_id from public.trip_members where trip_id = v_trip2_id and lower(email) = 'rls2-revoked@example.com';

  select public.invite_trip_member(v_trip2_id, 'rls2-expired@example.com', 'Expired Invitee', 'member') into v_invite;
  v_token_expired := v_invite->>'token';

  select public.invite_trip_member(v_trip2_id, 'rls2-resend@example.com', 'Resend Invitee', 'member') into v_invite;
  v_token_old := v_invite->>'token';
  select id into v_resend_tm_id from public.trip_members where trip_id = v_trip2_id and lower(email) = 'rls2-resend@example.com';

  reset role;

  -- Force-expire one invitation directly (test setup, not through the
  -- app) to exercise the "expired" branch of accept_trip_invitation.
  update public.trip_invitations set expires_at = now() - interval '1 day'
  where trip_id = v_trip2_id and lower(email) = 'rls2-expired@example.com';

  -- Everyone except the revoked/expired invitees accepts normally.
  perform set_config('request.jwt.claims', json_build_object('sub', v_member2, 'role', 'authenticated', 'email', 'rls2-member@example.com')::text, true);
  set local role authenticated;
  perform public.accept_trip_invitation(v_token_member2);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_recipient, 'role', 'authenticated', 'email', 'rls2-recipient@example.com')::text, true);
  set local role authenticated;
  perform public.accept_trip_invitation(v_token_recipient);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_new_owner, 'role', 'authenticated', 'email', 'rls2-newowner@example.com')::text, true);
  set local role authenticated;
  perform public.accept_trip_invitation(v_token_new_owner);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_bystander, 'role', 'authenticated', 'email', 'rls2-bystander@example.com')::text, true);
  set local role authenticated;
  perform public.accept_trip_invitation(v_token_bystander);
  reset role;

  -- 14. REUSED — a token that's already been consumed cannot be
  -- accepted a second time, regardless of who's asking.
  v_blocked := false;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_outsider2, 'role', 'authenticated', 'email', 'rls2-outsider@example.com')::text, true);
    set local role authenticated;
    perform public.accept_trip_invitation(v_token_member2);
  exception when others then
    v_blocked := true;
  end;
  reset role;
  assert v_blocked, 'a used invitation token must not be acceptable a second time';

  -- 15. EXPIRED — an invitation past its expiry cannot be accepted.
  v_blocked := false;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_outsider2, 'role', 'authenticated', 'email', 'rls2-outsider@example.com')::text, true);
    set local role authenticated;
    perform public.accept_trip_invitation(v_token_expired);
  exception when others then
    v_blocked := true;
  end;
  reset role;
  assert v_blocked, 'an expired invitation must not be acceptable';

  -- 16. REVOKED — the captain revokes a pending invitation; the
  -- trip_members row is marked removed and the token stops working.
  perform set_config('request.jwt.claims', json_build_object('sub', v_captain2, 'role', 'authenticated', 'email', 'rls2-captain@example.com')::text, true);
  set local role authenticated;
  perform public.revoke_trip_invitation(v_revoked_tm_id);
  reset role;

  select status into v_member_status from public.trip_members where id = v_revoked_tm_id;
  assert v_member_status = 'removed', 'revoke_trip_invitation must mark the trip_members row removed';

  v_blocked := false;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_outsider2, 'role', 'authenticated', 'email', 'rls2-outsider@example.com')::text, true);
    set local role authenticated;
    perform public.accept_trip_invitation(v_token_revoked);
  exception when others then
    v_blocked := true;
  end;
  reset role;
  assert v_blocked, 'a revoked invitation must not be acceptable';

  -- 17. UNAUTHORIZED — a non-captain member cannot resend or revoke.
  v_blocked := false;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_recipient, 'role', 'authenticated', 'email', 'rls2-recipient@example.com')::text, true);
    set local role authenticated;
    perform public.resend_trip_invitation(v_resend_tm_id);
  exception when others then
    v_blocked := true;
  end;
  reset role;
  assert v_blocked, 'a non-captain member must not be able to resend an invitation';

  v_blocked := false;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_recipient, 'role', 'authenticated', 'email', 'rls2-recipient@example.com')::text, true);
    set local role authenticated;
    perform public.revoke_trip_invitation(v_resend_tm_id);
  exception when others then
    v_blocked := true;
  end;
  reset role;
  assert v_blocked, 'a non-captain member must not be able to revoke an invitation';

  -- 18. RESEND invalidates the previous token; the fresh one works.
  perform set_config('request.jwt.claims', json_build_object('sub', v_captain2, 'role', 'authenticated', 'email', 'rls2-captain@example.com')::text, true);
  set local role authenticated;
  select public.resend_trip_invitation(v_resend_tm_id) into v_invite;
  v_token_new := v_invite->>'token';
  reset role;

  select status into v_invitation_status
  from public.trip_invitations
  where trip_id = v_trip2_id and lower(email) = 'rls2-resend@example.com' and status = 'revoked';
  assert v_invitation_status = 'revoked', 'resend_trip_invitation must revoke the previous pending invitation';

  v_blocked := false;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_outsider2, 'role', 'authenticated', 'email', 'rls2-outsider@example.com')::text, true);
    set local role authenticated;
    perform public.accept_trip_invitation(v_token_old);
  exception when others then
    v_blocked := true;
  end;
  reset role;
  assert v_blocked, 'the token replaced by resend_trip_invitation must no longer be acceptable';

  -- accept_trip_invitation() reads the caller's email straight from
  -- auth.users (not the JWT claim), and rolls the invitation back to
  -- 'pending' rather than burning it on a wrong-account attempt — so
  -- the invitee's real email has to match. Resend's invitee never
  -- signed up for real, so temporarily repoint v_outsider2's account
  -- email to match, accept, then put it back.
  update auth.users set email = 'rls2-resend@example.com' where id = v_outsider2;
  perform set_config('request.jwt.claims', json_build_object('sub', v_outsider2, 'role', 'authenticated', 'email', 'rls2-resend@example.com')::text, true);
  set local role authenticated;
  perform public.accept_trip_invitation(v_token_new);
  reset role;
  update auth.users set email = 'rls2-outsider@example.com' where id = v_outsider2;

  select status into v_member_status from public.trip_members where id = v_resend_tm_id;
  assert v_member_status = 'active', 'the freshly issued resend token must be acceptable';

  -- 19. Ownership transfer is owner-only, not merely captain-only.
  -- Promote v_member2 to captain so this proves captain authority
  -- alone is insufficient — only the current owner can transfer.
  perform set_config('request.jwt.claims', json_build_object('sub', v_captain2, 'role', 'authenticated', 'email', 'rls2-captain@example.com')::text, true);
  set local role authenticated;
  select id into v_member2_tm_id from public.trip_members where trip_id = v_trip2_id and user_id = v_member2;
  select id into v_new_owner_tm_id from public.trip_members where trip_id = v_trip2_id and user_id = v_new_owner;
  perform public.set_trip_member_role(v_member2_tm_id, 'captain');
  reset role;

  v_blocked := false;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_member2, 'role', 'authenticated', 'email', 'rls2-member@example.com')::text, true);
    set local role authenticated;
    perform public.transfer_trip_ownership(v_trip2_id, v_new_owner_tm_id);
  exception when others then
    v_blocked := true;
  end;
  reset role;
  assert v_blocked, 'a captain who is not the current owner must not be able to transfer ownership';

  perform set_config('request.jwt.claims', json_build_object('sub', v_captain2, 'role', 'authenticated', 'email', 'rls2-captain@example.com')::text, true);
  set local role authenticated;
  perform public.transfer_trip_ownership(v_trip2_id, v_new_owner_tm_id);
  reset role;

  select owner_id into v_owner_id from public.trips where id = v_trip2_id;
  assert v_owner_id = v_new_owner, 'transfer_trip_ownership must update trips.owner_id';
  select role into v_role from public.trip_members where id = v_new_owner_tm_id;
  assert v_role = 'captain', 'transfer_trip_ownership must auto-promote the new owner to captain';

  -- 20. A payment's designated recipient (even a non-captain) can
  -- confirm it; someone who is neither the captain nor that payment's
  -- recipient cannot.
  select id into v_captain2_tm_id from public.trip_members where trip_id = v_trip2_id and user_id = v_captain2;
  select id into v_recipient_tm_id from public.trip_members where trip_id = v_trip2_id and user_id = v_recipient;

  perform set_config('request.jwt.claims', json_build_object('sub', v_captain2, 'role', 'authenticated', 'email', 'rls2-captain@example.com')::text, true);
  set local role authenticated;
  insert into public.payments (trip_id, payer_member_id, recipient_member_id, amount_cents, payment_method, reported_by, paid_at)
  values (v_trip2_id, v_captain2_tm_id, v_recipient_tm_id, 5000, 'venmo', v_captain2, now())
  returning id into v_payment_id;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_recipient, 'role', 'authenticated', 'email', 'rls2-recipient@example.com')::text, true);
  set local role authenticated;
  perform public.confirm_payment(v_payment_id);
  reset role;

  select status into v_payment_status from public.payments where id = v_payment_id;
  assert v_payment_status = 'confirmed', 'a payment''s designated (non-captain) recipient must be able to confirm it';

  perform set_config('request.jwt.claims', json_build_object('sub', v_captain2, 'role', 'authenticated', 'email', 'rls2-captain@example.com')::text, true);
  set local role authenticated;
  insert into public.payments (trip_id, payer_member_id, recipient_member_id, amount_cents, payment_method, reported_by, paid_at)
  values (v_trip2_id, v_captain2_tm_id, v_recipient_tm_id, 3000, 'zelle', v_captain2, now())
  returning id into v_payment2_id;
  reset role;

  v_blocked := false;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_bystander, 'role', 'authenticated', 'email', 'rls2-bystander@example.com')::text, true);
    set local role authenticated;
    perform public.confirm_payment(v_payment2_id);
  exception when others then
    v_blocked := true;
  end;
  reset role;
  assert v_blocked, 'a member who is neither captain nor the payment''s recipient must not be able to confirm it';

  -- 21. Rate limiting — invite_trip_member() must not allow unbounded
  -- invitations (capped at 20/hour per captain per trip). Several
  -- invites already happened above for this captain on this trip, so
  -- a bounded number of further distinct invites must eventually hit
  -- the cap.
  perform set_config('request.jwt.claims', json_build_object('sub', v_captain2, 'role', 'authenticated', 'email', 'rls2-captain@example.com')::text, true);
  set local role authenticated;
  v_blocked := false;
  for v_i in 1..20 loop
    begin
      perform public.invite_trip_member(v_trip2_id, 'rls2-ratelimit-' || v_i || '@example.com', 'Rate Limit Test', 'member');
    exception when others then
      v_blocked := true;
      exit;
    end;
  end loop;
  reset role;
  assert v_blocked, 'invite_trip_member must be rate-limited rather than allowing unbounded invitations';

  raise notice 'ALL INVITATION/OWNERSHIP/PAYMENT-AUTHORIZATION CHECKS PASSED';

  delete from public.trips where id = v_trip2_id;
  delete from auth.users where id in (v_captain2, v_member2, v_recipient, v_new_owner, v_bystander, v_outsider2);
end $$;
