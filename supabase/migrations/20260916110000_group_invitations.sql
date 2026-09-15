-- SplitFairway daily-use revamp (Phase 2): group invitations.
--
-- Mirrors trip_invitations/trip_members' proven token pattern (see
-- 20260902050000_invitations_ownership_reminders.sql) as closely as
-- possible, with one deliberate difference: email is nullable here.
-- A named invite (email set) behaves exactly like a trip invite --
-- single recipient, single use, must match the accepting account's
-- email. A link invite (email null) is what "Copy invitation link" /
-- the device share sheet produce -- reusable by anyone holding the
-- link until revoked or expired, since a captain sharing a link has no
-- single named recipient in mind. Neither kind ever hands out group
-- roster, trip, or financial data -- see get_group_invitation_preview
-- below, which returns only the group's name and the invited role.
create type public.golf_group_invitation_role as enum ('member', 'guest');
comment on type public.golf_group_invitation_role is
  'What accepting this invitation grants: ''member'' is full, ordinary golf_group_members access. ''guest'' also creates a normal (role=member) golf_group_members row -- there is no separate persisted membership tier -- but routes the invitee straight into the group''s current round to score, instead of the group dashboard, per the "view the relevant round and enter permitted scores without navigating the entire app" requirement. See acceptGroupInvitationAction.';

create table public.golf_group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.golf_groups(id) on delete cascade,
  email text,
  invited_role public.golf_group_invitation_role not null default 'member',
  token_hash text not null unique,
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  status public.invitation_status not null default 'pending',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.golf_group_invitations is
  'The raw token is never stored -- only its SHA-256 hash, same convention as trip_invitations.token_hash. A link invite (email null) stays ''pending'' and reusable across multiple acceptances until revoked/expired; a named invite (email set) flips to ''accepted'' on first use, exactly like a trip invitation.';

create index golf_group_invitations_group_status_idx on public.golf_group_invitations (group_id, status);

alter table public.golf_group_invitations enable row level security;

-- No insert/update policy: every write goes through the RPCs below,
-- each of which is security definer and enforces its own authorization
-- (owner-only to create/revoke, self-service accept). Select is
-- owner-only -- a group's pending invitations are the captain's own
-- business, not visible to ordinary members.
grant select on public.golf_group_invitations to authenticated;

create policy "golf_group_invitations_select_owner" on public.golf_group_invitations
  for select to authenticated
  using (public.is_group_owner(group_id));
