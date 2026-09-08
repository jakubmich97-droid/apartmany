-- 1) Spusťte tento soubor v Supabase > SQL Editor.
-- 2) Nahraďte text VLOZTE_SERVICE_ROLE_KEY skutečným service_role klíčem.
--    Klíč nikdy neposílejte ani neukládejte do GitHubu.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  timezone text not null default 'Europe/Prague',
  morning_time time not null default '07:00',
  evening_time time not null default '18:00',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  notification_type text not null check (notification_type in ('morning', 'evening')),
  notification_date date not null,
  sent_at timestamptz not null default now(),
  unique (subscription_id, notification_type, notification_date)
);

alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;

drop policy if exists "Own push subscriptions" on public.push_subscriptions;
create policy "Own push subscriptions" on public.push_subscriptions for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;

select vault.create_secret('https://nqvpxopsiiagemumfbmc.supabase.co', 'project_url')
where not exists (select 1 from vault.decrypted_secrets where name = 'project_url');
select vault.create_secret('VLOZTE_SERVICE_ROLE_KEY', 'service_role_key')
where not exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');

select cron.unschedule(jobid) from cron.job where jobname = 'cleaning-push-notifications';
select cron.schedule(
  'cleaning-push-notifications',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-cleaning-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
