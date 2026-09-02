-- These RPCs all require auth.uid() internally and reject anon callers
-- with an error, but there's no reason to leave them anon-callable at
-- all. decline_trip_invitation is the deliberate exception (declining
-- doesn't require an account, only the token).
revoke execute on function public.create_trip(text, text, date, date, text, text) from anon;
revoke execute on function public.invite_trip_member(uuid, text, text, public.member_role) from anon;
revoke execute on function public.accept_trip_invitation(text) from anon;
revoke execute on function public.confirm_payment(uuid) from anon;
revoke execute on function public.reject_payment(uuid, text) from anon;
revoke execute on function public.set_trip_member_role(uuid, public.member_role) from anon;
