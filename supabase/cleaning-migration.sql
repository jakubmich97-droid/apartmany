-- Jednorázová aktualizace pro existující databázi.
-- Spusťte v Supabase > SQL Editor.

alter table public.bookings
add column if not exists cleaning_completed_at timestamptz;

-- Starší příjezdy považujeme za již uklizené.
update public.bookings
set cleaning_completed_at = date_from::timestamp
where date_from < current_date
  and cleaning_completed_at is null;

create index if not exists bookings_cleaning_status_idx
on public.bookings(owner_id, date_from, cleaning_completed_at);
