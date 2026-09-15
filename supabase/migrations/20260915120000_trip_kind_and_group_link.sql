-- SplitFairway repositioning (nav/product phase): lets a "round" be
-- started without the user ever seeing a trip-creation step. A Quick
-- Round or Group Round still needs somewhere to hang its rounds/
-- round_players/expenses rows (every one of those tables is keyed off
-- trip_id/trip_member_id, and none of that is being rewired), so it
-- gets a normal trips row created behind the scenes via the existing
-- create_trip() RPC -- this column is only how the app tells that
-- "hidden" trip apart from a real one the user created on purpose, so
-- it can be excluded from the Trips list/nav.
--
-- Purely additive: every existing trip row defaults to 'trip', which is
-- exactly what it already was, so no existing trip changes meaning or
-- visibility.
create type public.trip_kind as enum ('trip', 'quick_round', 'group_round');

alter table public.trips
  add column kind public.trip_kind not null default 'trip';

comment on column public.trips.kind is
  '''trip'' = a real trip the user created and sees in Trips. ''quick_round''/''group_round'' = a lightweight trip auto-created so a Quick Round or Group Round has somewhere to store its round_players/expenses, hidden from the Trips list. Defaults to ''trip'' so no pre-existing row changes meaning.';

-- Optional link from a trip to the saved golf_groups group it was
-- started from/for (requirement: "Trips may optionally be connected to
-- a saved group"). Nullable, on delete set null -- deleting a group
-- must never delete or orphan a trip's actual data.
alter table public.trips
  add column golf_group_id uuid references public.golf_groups(id) on delete set null;

comment on column public.trips.golf_group_id is
  'Optional: the saved golf group this trip is associated with, if any. Set automatically for group_round trips; settable by a captain on a real trip via attach_trip_to_group(). Never required.';

create index trips_golf_group_id_idx on public.trips (golf_group_id) where golf_group_id is not null;

-- The existing trips_select_members / trips_update_captain / trips_delete_captain
-- policies are unchanged and already cover the new column -- membership
-- and captaincy are still what govern a trip, regardless of kind.
