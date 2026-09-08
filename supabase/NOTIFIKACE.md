# Dokončení notifikací v Supabase

1. V Supabase otevřete **Edge Functions → Secrets** a přidejte:
   - `VAPID_PUBLIC_KEY` = `BAMdkkMHLF2if6v33P92dheoBePoaYviUAoc6tmQk3iY_iojhyw4C_N1Nbfd9nmPLyJ4Kqt_cX0IfB0C6D8WFUs`
   - `VAPID_PRIVATE_KEY` = soukromý klíč předaný samostatně správcem
   - `VAPID_SUBJECT` = `mailto:jamichalek@centrum.cz`
2. V **Edge Functions** vytvořte funkci `send-cleaning-notifications`, vložte obsah souboru `functions/send-cleaning-notifications/index.ts` a nasaďte ji.
3. V **Project Settings → API Keys** zkopírujte `service_role` klíč. Nikam ho neposílejte.
4. V souboru `notifications-setup.sql` nahraďte `VLOZTE_SERVICE_ROLE_KEY` tímto klíčem a celý SQL spusťte v SQL Editoru.
5. Po novém načtení aplikace stiskněte na úvodní stránce **Zapnout**.

Plánovač kontroluje nastavení každou minutu, ale každý typ upozornění odešle nejvýše jednou denně. Časy lze změnit přímo v aplikaci a správně funguje i změna zimního a letního času.
