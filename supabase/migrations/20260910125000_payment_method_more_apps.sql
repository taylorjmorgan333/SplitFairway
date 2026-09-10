-- "Popular payment apps" per the feature request -- rounds out the
-- existing payment_method enum (already used for recording a payment)
-- with the two most common apps it was missing. Additive only; nothing
-- that already reads/writes this enum's existing values changes. Split
-- into its own migration since ALTER TYPE ... ADD VALUE can't be used
-- in the same transaction as code that references the new values.
alter type public.payment_method add value if not exists 'cashapp';
alter type public.payment_method add value if not exists 'apple_pay';
