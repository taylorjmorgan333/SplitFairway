create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  category public.expense_category not null default 'other',
  vendor text,
  total_amount_cents bigint not null check (total_amount_cents >= 0),
  paid_by_member_id uuid references public.trip_members(id) on delete set null,
  expense_date date,
  due_date date,
  notes text,
  split_method public.split_method not null default 'equal',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_shares (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  trip_member_id uuid not null references public.trip_members(id) on delete cascade,
  amount_owed_cents bigint not null check (amount_owed_cents >= 0),
  created_at timestamptz not null default now(),
  unique (expense_id, trip_member_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  payer_member_id uuid not null references public.trip_members(id) on delete cascade,
  recipient_member_id uuid references public.trip_members(id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0),
  payment_method public.payment_method not null,
  status public.payment_status not null default 'reported',
  reference_note text,
  paid_at timestamptz not null default now(),
  reported_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
