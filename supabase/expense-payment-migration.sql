-- Spusťte jednou v Supabase SQL Editoru.
-- Přidá evidenci, zda si správce výdaj již proplatil.

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name = 'paid_from_account')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name = 'reimbursed') then
    alter table public.expenses rename column paid_from_account to reimbursed;
  elsif not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name = 'reimbursed') then
    alter table public.expenses add column reimbursed boolean not null default false;
  end if;
end $$;
