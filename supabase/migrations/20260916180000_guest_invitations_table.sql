-- SplitFairway Phase 2 cleanup: passwordless guest scoring, step 2 --
-- the invitation table itself. Mirrors golf_group_invitations' proven
-- hashed-token shape (raw token never stored, only its SHA-256 hash)
-- but is a wholly separate table on purpose: this one identifies a
-- specific round and a specific pre-created guest golfer up front
-- (per the spec's "identify the correct group, round and guest
-- golfer"), not just a group + a role. group_id is nullable because
-- the underlying access mechanism (trip_members + round_players) has
-- never required a golf_group to exist -- restricting this to
-- group-linked trips only would be a narrower rebuild of the existing
-- round/trip model for no real reason, so guest scoring links work
-- for any trip's round, group-linked or not.

create type public.guest_invitation_status as enum ('pending', 'redeemed', 'revoked');
comment on type public.guest_invitation_status is
  'Unlike golf_group_invitations, there is no stored ''expired'' or ''accepted'' value -- expiry is checked dynamically against expires_at (see get_guest_invitation_preview/redeem_group_guest_invitation), and ''redeemed'' does not make the link single-use: reopening a still-valid, non-revoked link always re-links the current session, which is what lets a guest resume scoring from a second tap or a different device. Only an explicit revoke (captain action) or a passed expires_at blocks a redemption.';

create table public.golf_group_guest_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.golf_groups(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  trip_member_id uuid not null references public.trip_members(id) on delete cascade,
  round_player_id uuid not null references public.round_players(id) on delete cascade,
  guest_display_name text not null,
  token_hash text not null unique,
  status public.guest_invitation_status not null default 'pending',
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  redeemed_user_id uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.golf_group_guest_invitations is
  'One row per "invite a guest to score this round" link. trip_member_id/round_player_id are created up front (by create_group_guest_invitation, captain-only) so the token has a real, specific golfer identity to claim -- redeem_group_guest_invitation only ever relinks trip_members.user_id to the redeeming session''s auth.uid(), it never creates a new golfer. Revoking sets both this row''s status and the linked trip_members.status to ''removed'', cutting off live RLS access immediately, not just future redemptions.';

create index golf_group_guest_invitations_trip_status_idx on public.golf_group_guest_invitations (trip_id, status);
create index golf_group_guest_invitations_round_id_idx on public.golf_group_guest_invitations (round_id);

alter table public.golf_group_guest_invitations enable row level security;

-- No insert/update policy -- every write goes through the security
-- definer RPCs in the next migration, each enforcing its own
-- is_trip_captain() check. Select is captain-only, same as
-- golf_group_invitations_select_owner: a trip's pending/active guest
-- links are the captain's own business, not visible to ordinary
-- members and never to the guest themselves (they only ever see
-- get_guest_invitation_preview's deliberately minimal anon-callable
-- projection of one row).
grant select on public.golf_group_guest_invitations to authenticated;

create policy "golf_group_guest_invitations_select_captain" on public.golf_group_guest_invitations
  for select to authenticated
  using (public.is_trip_captain(trip_id));
