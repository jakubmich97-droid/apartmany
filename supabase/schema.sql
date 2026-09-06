-- Spusťte celý soubor v Supabase > SQL Editor.
-- Data každého přihlášeného uživatele jsou oddělena pomocí RLS.

create extension if not exists pgcrypto;

create table if not exists public.apartments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  color text not null default '#2f6f62' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  guest_name text not null check (char_length(trim(guest_name)) between 1 and 120),
  guest_count integer not null default 1 check (guest_count between 1 and 50),
  date_from date not null,
  date_to date not null,
  source text not null default 'Booking.com',
  note text,
  created_at timestamptz not null default now(),
  check (date_to >= date_from)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  apartment_id uuid references public.apartments(id) on delete set null,
  category text not null,
  description text not null check (char_length(trim(description)) between 1 and 160),
  amount numeric(12,2) not null check (amount >= 0),
  spent_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  quantity numeric(10,2) not null default 0 check (quantity >= 0),
  unit text not null default 'ks',
  minimum_quantity numeric(10,2) not null default 0 check (minimum_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (apartment_id, name)
);

create index if not exists bookings_owner_dates_idx on public.bookings(owner_id, date_from, date_to);
create index if not exists expenses_owner_date_idx on public.expenses(owner_id, spent_on desc);
create index if not exists inventory_owner_apartment_idx on public.inventory_items(owner_id, apartment_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inventory_set_updated_at on public.inventory_items;
create trigger inventory_set_updated_at before update on public.inventory_items
for each row execute function public.set_updated_at();

alter table public.apartments enable row level security;
alter table public.bookings enable row level security;
alter table public.expenses enable row level security;
alter table public.inventory_items enable row level security;

drop policy if exists "Own apartments" on public.apartments;
create policy "Own apartments" on public.apartments for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "Own bookings" on public.bookings;
create policy "Own bookings" on public.bookings for all to authenticated
using ((select auth.uid()) = owner_id) with check (
  (select auth.uid()) = owner_id and exists (
    select 1 from public.apartments a where a.id = apartment_id and a.owner_id = (select auth.uid())
  )
);

drop policy if exists "Own expenses" on public.expenses;
create policy "Own expenses" on public.expenses for all to authenticated
using ((select auth.uid()) = owner_id) with check (
  (select auth.uid()) = owner_id and (
    apartment_id is null or exists (
      select 1 from public.apartments a where a.id = apartment_id and a.owner_id = (select auth.uid())
    )
  )
);

drop policy if exists "Own inventory" on public.inventory_items;
create policy "Own inventory" on public.inventory_items for all to authenticated
using ((select auth.uid()) = owner_id) with check (
  (select auth.uid()) = owner_id and exists (
    select 1 from public.apartments a where a.id = apartment_id and a.owner_id = (select auth.uid())
  )
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.apartments, public.bookings, public.expenses, public.inventory_items to authenticated;

