-- Extensions
create extension if not exists pgcrypto with schema extensions;

-- Enum types
create type public.trip_status as enum ('planning', 'active', 'completed', 'cancelled');
create type public.member_role as enum ('captain', 'member');
create type public.member_status as enum ('invited', 'active', 'declined', 'removed');
create type public.expense_category as enum ('lodging', 'golf', 'transportation', 'food', 'merchandise', 'activity', 'other');
create type public.split_method as enum ('equal', 'selected', 'custom');
create type public.payment_method as enum ('venmo', 'zelle', 'paypal', 'cash', 'check', 'other');
create type public.payment_status as enum ('reported', 'confirmed', 'rejected');
