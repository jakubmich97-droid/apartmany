-- Spusťte jednou v Supabase SQL Editoru.
-- Přidá vlastní časy notifikací a kontrolu plánu každou minutu.

alter table public.push_subscriptions
  add column if not exists morning_time time not null default '07:00',
  add column if not exists evening_time time not null default '18:00';

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
