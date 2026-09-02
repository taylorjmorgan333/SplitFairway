create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  default_payment_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per authenticated user, created automatically on signup.';

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  name text not null,
  destination text,
  start_date date,
  end_date date,
  currency text not null default 'USD',
  description text,
  status public.trip_status not null default 'planning',
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_date_order check (start_date is null or end_date is null or end_date >= start_date)
);

create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  email text not null,
  role public.member_role not null default 'member',
  status public.member_status not null default 'invited',
  joined_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.trip_members is 'A row is created at invite time (status=invited, user_id null) and linked to a real user when the invitation is accepted.';

create table public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  email text not null,
  invited_by uuid references public.profiles(id) on delete set null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
comment on column public.trip_invitations.token_hash is 'SHA-256 hash of the invitation token. The raw token is never stored — only returned once, at creation, to be emailed to the invitee.';
