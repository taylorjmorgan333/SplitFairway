-- Edits an existing expense and atomically replaces its shares.
-- Captain-only, mirrors create_expense_with_shares(): p_shares is a
-- JSON array of {"trip_member_id": uuid, "amount_owed_cents": integer}
-- and must sum to exactly p_total_amount_cents — every member listed
-- must be an active member of this trip, or the whole call is rejected
-- and nothing is changed (the update, the share delete, and the share
-- re-insert all happen in one transaction, so an expense can never be
-- left half-updated or with stale/missing shares).
create or replace function public.update_expense_with_shares(
  p_expense_id uuid,
  p_title text,
  p_total_amount_cents bigint,
  p_shares jsonb,
  p_category public.expense_category default 'other',
  p_split_method public.split_method default 'equal',
  p_paid_by_member_id uuid default null,
  p_vendor text default null,
  p_expense_date date default null,
  p_due_date date default null,
  p_notes text default null
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense public.expenses;
  v_trip_id uuid;
  v_share jsonb;
  v_share_sum bigint;
  v_share_count int;
  v_valid_member_count int;
begin
  select trip_id into v_trip_id from public.expenses where id = p_expense_id;
  if not found then
    raise exception 'Expense not found';
  end if;

  if not public.is_trip_captain(v_trip_id) then
    raise exception 'Only a trip captain can edit an expense';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'An expense needs a title';
  end if;

  if p_total_amount_cents <= 0 then
    raise exception 'Expense amount must be greater than zero';
  end if;

  select count(*), coalesce(sum((s->>'amount_owed_cents')::bigint), 0)
  into v_share_count, v_share_sum
  from jsonb_array_elements(p_shares) s;

  if v_share_count = 0 then
    raise exception 'Select at least one golfer to split this expense with';
  end if;

  if exists (select 1 from jsonb_array_elements(p_shares) s where (s->>'amount_owed_cents')::bigint <= 0) then
    raise exception 'Every golfer''s share must be greater than zero';
  end if;

  if v_share_sum <> p_total_amount_cents then
    raise exception 'Shares (%) must add up to the total amount (%)', v_share_sum, p_total_amount_cents;
  end if;

  select count(*) into v_valid_member_count
  from jsonb_array_elements(p_shares) s
  join public.trip_members tm
    on tm.id = (s->>'trip_member_id')::uuid
   and tm.trip_id = v_trip_id
   and tm.status = 'active';

  if v_valid_member_count <> v_share_count then
    raise exception 'One or more golfers in the split are not active members of this trip';
  end if;

  if p_paid_by_member_id is not null and not exists (
    select 1 from public.trip_members
    where id = p_paid_by_member_id and trip_id = v_trip_id and status = 'active'
  ) then
    raise exception 'The golfer who paid must be an active member of this trip';
  end if;

  update public.expenses set
    title = trim(p_title),
    category = p_category,
    vendor = nullif(trim(coalesce(p_vendor, '')), ''),
    total_amount_cents = p_total_amount_cents,
    paid_by_member_id = p_paid_by_member_id,
    expense_date = p_expense_date,
    due_date = p_due_date,
    notes = nullif(trim(coalesce(p_notes, '')), ''),
    split_method = p_split_method,
    updated_at = now()
  where id = p_expense_id
  returning * into v_expense;

  delete from public.expense_shares where expense_id = p_expense_id;

  for v_share in select * from jsonb_array_elements(p_shares)
  loop
    insert into public.expense_shares (expense_id, trip_member_id, amount_owed_cents)
    values (
      v_expense.id,
      (v_share->>'trip_member_id')::uuid,
      (v_share->>'amount_owed_cents')::bigint
    );
  end loop;

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (
    v_trip_id, auth.uid(), 'expense_updated',
    jsonb_build_object('expense_id', v_expense.id, 'title', v_expense.title, 'amount_cents', p_total_amount_cents)
  );

  return v_expense;
end;
$$;

-- Same two-revoke grant pattern as create_expense_with_shares: Supabase
-- grants EXECUTE on every new function to anon/authenticated directly,
-- separate from Postgres's own PUBLIC default grant — both must be
-- revoked from anon or the function stays callable by anonymous
-- callers despite the is_trip_captain() check inside it running as
-- SECURITY DEFINER (the check itself is correct; the point is this
-- function shouldn't be reachable pre-authentication at all).
revoke execute on function public.update_expense_with_shares(
  uuid, text, bigint, jsonb, public.expense_category, public.split_method, uuid, text, date, date, text
) from public;
revoke execute on function public.update_expense_with_shares(
  uuid, text, bigint, jsonb, public.expense_category, public.split_method, uuid, text, date, date, text
) from anon;
grant execute on function public.update_expense_with_shares(
  uuid, text, bigint, jsonb, public.expense_category, public.split_method, uuid, text, date, date, text
) to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.update_expense_with_shares(uuid, text, bigint, jsonb, public.expense_category, public.split_method, uuid, text, date, date, text)', 'execute') then
    raise exception 'anon must not be able to execute update_expense_with_shares';
  end if;
  if not has_function_privilege('authenticated', 'public.update_expense_with_shares(uuid, text, bigint, jsonb, public.expense_category, public.split_method, uuid, text, date, date, text)', 'execute') then
    raise exception 'authenticated must be able to execute update_expense_with_shares';
  end if;
end $$;
