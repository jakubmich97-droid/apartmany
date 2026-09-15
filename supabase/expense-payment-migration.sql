-- Spusťte jednou v Supabase SQL Editoru.
-- Přidá evidenci, zda byl výdaj zaplacen z účtu.

alter table public.expenses
  add column if not exists paid_from_account boolean not null default false;
