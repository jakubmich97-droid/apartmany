# Moje apartmány

Jednoduchá responzivní aplikace pro správu ubytování:

- kalendář pobytů a přehled hostů,
- provozní výdaje podle kategorií a apartmánů,
- zásoby s minimálním množstvím a upozorněním na doplnění,
- přihlášení bezpečným odkazem na e-mail,
- oddělení dat uživatelů pomocí Supabase Row Level Security.

## Spuštění lokálně

```bash
npm install
cp .env.example .env.local
npm run dev
```

Bez proměnných Supabase se aplikace otevře v ukázkovém režimu. Data se v něm po obnovení stránky neukládají.

## Nastavení Supabase

1. Vytvořte projekt na Supabase.
2. V `SQL Editor` spusťte celý soubor [`supabase/schema.sql`](supabase/schema.sql).
3. V `Authentication > URL Configuration` nastavte adresu aplikace jako `Site URL` a přidejte ji do `Redirect URLs`.
4. V `Project Settings > API` zkopírujte Project URL a anon/publishable key do `.env.local`:

```env
VITE_SUPABASE_URL=https://vas-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=vas-anon-klic
```

## GitHub Pages

Workflow v `.github/workflows/deploy.yml` sestaví a publikuje aplikaci po každém pushi do `main`.

1. V `Settings > Secrets and variables > Actions` vytvořte `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY`.
2. V `Settings > Pages > Build and deployment` vyberte zdroj `GitHub Actions`.
3. V Supabase přidejte `https://jakubmich97-droid.github.io/apartmany/` mezi povolené Redirect URLs.

> Anon/publishable klíč je určený pro frontend. Ochranu dat zajišťují RLS pravidla v databázi. Service role key do aplikace nikdy nevkládejte.
