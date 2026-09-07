# Dokončení notifikací v Supabase

1. V Supabase otevřete **Edge Functions → Secrets** a přidejte:
   - `VAPID_PUBLIC_KEY` = `BKXUVeA2f_mhEIFDkyaGVvLWzsS7G4ZFDAo0qTLQmWmXk53kpeI4Wa8JIorxIcGjnmj21MmUYU13gYPK6dC6sak`
   - `VAPID_PRIVATE_KEY` = soukromý klíč předaný samostatně správcem
   - `VAPID_SUBJECT` = `mailto:jamichalek@centrum.cz`
2. V **Edge Functions** vytvořte funkci `send-cleaning-notifications`, vložte obsah souboru `functions/send-cleaning-notifications/index.ts` a nasaďte ji.
3. V **Project Settings → API Keys** zkopírujte `service_role` klíč. Nikam ho neposílejte.
4. V souboru `notifications-setup.sql` nahraďte `VLOZTE_SERVICE_ROLE_KEY` tímto klíčem a celý SQL spusťte v SQL Editoru.
5. Po novém načtení aplikace stiskněte na úvodní stránce **Zapnout**.

Plánovač běží každou hodinu, ale upozornění odešle jen v 7:00 a 18:00 místního času. Díky tomu správně funguje i změna zimního a letního času.
