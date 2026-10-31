# Quickstart & Rollout: 021 — Risico-analyse via de serverroute

**Date**: 2026-10-31 | **Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Deze feature heeft een **verplichte volgorde**: eerst de handmatige n8n-aanpassingen,
dan de migratie, dan de Edge Functions + secrets + cron, en pas daarna de frontend. Er
wordt niets toegepast of gedeployed zonder bevestiging in de chat.

## 0. Voorbereiding en secrets

Maak in Supabase (Project Settings → Edge Functions → Secrets) twee secrets aan. Zet ze
**niet** in de repository en niet met een echte waarde in `.env.example`.

| Secret | Gebruikt door | Waarde |
|---|---|---|
| `ANALYSIS_CALLBACK_SECRET` | `analysis-run-submit` (HMAC maken) en `analysis-run-callback` (HMAC controleren) | willekeurig, minimaal 32 bytes (bijv. `openssl rand -hex 32`) |
| `ANALYSIS_CLEANUP_SECRET` | `analysis-run-cleanup` en de pg_cron-job | willekeurig, minimaal 32 bytes |

Controleer dat `ALLOWED_ORIGINS` (bestaand projectsecret) de Netlify-URL en
`http://localhost:5173` bevat; de nieuwe functies gebruiken dezelfde fail-closed
CORS-regel als `rag-chat`.

De E2E-accounts (`E2E_EMAIL`/`E2E_PASSWORD`, eventueel `E2E_MEMBER_*`) blijven nodig
voor de Playwright-suite; zonder deze variabelen skippen de tests met een reden.

## 1. Handmatige n8n-aanpassingen (eerst)

Doe dit in de n8n-flow **"Darwin - Risico-analyse"** voordat de functies live gaan:

1. Zet **Header Auth** op de webhook met pad `darwin-risicoanalyse`, met dezelfde
   headernaam en waarde als `platform_webhook_config` (feature 019).
2. Vul de twee placeholders die je in de flow hebt gemarkeerd (de dynamische waarden
   uit de payload).
3. Verhoog `N8N_PAYLOAD_SIZE_MAX` naar minimaal **64 MiB** (default 16 MiB). Een
   upload van 25 MB wordt base64 ± 33 MB; zonder deze verhoging weigert n8n de payload.

De flow moet blijven antwoorden met **202** en het resultaat later naar de meegegeven
`callback_url` posten.

## 2. Migratie (na bevestiging in de chat)

Bestand: `supabase/migrations/023_analysis_server_route.sql`.

Toepassen (na bevestiging) via de Supabase MCP (`apply_migration` met de
bestandsinhoud) of via de CLI (`npx supabase db push`). De migratie is de bron van
waarheid.

Wat het doet:

- `public.analysis_runs` aanmaken (kolommen volgens [data-model.md](data-model.md) §2),
  RLS aan, alleen een SELECT-policy, expliciete `revoke`/`grant select`.
- Indexen op `(advisor_id, started_at desc)` en `(expires_at)`.
- Privébucket `analysis-dossiers` + één SELECT-policy op `storage.objects`.
- `pg_cron` en `pg_net` aanzetten.

Daarna:

```bash
# types opnieuw genereren (Supabase MCP generate_typescript_types of CLI)
npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts
```

Verificatiequeries staan in [data-model.md](data-model.md) §6. Verwacht: RLS aan,
precies één SELECT-policy op de tabel, bucket `public = false`, één storage-SELECT-policy.

## 3. Edge Functions (na bevestiging in de chat)

```bash
# submit: standaard JWT-verificatie (de browser stuurt het sessie-JWT)
npx supabase functions deploy analysis-run-submit

# callback en cleanup: geen Supabase-JWT (n8n respectievelijk pg_cron)
npx supabase functions deploy analysis-run-callback --no-verify-jwt
npx supabase functions deploy analysis-run-cleanup  --no-verify-jwt
```

Via de Supabase MCP kan hetzelfde met `deploy_edge_function` en `verify_jwt: false`
voor `analysis-run-callback` en `analysis-run-cleanup`; `analysis-run-submit` houdt
`verify_jwt: true` (standaard).

Controleer na de deploy dat alle drie de functies bestaan en dat `analysis-run-callback`
en `analysis-run-cleanup` anoniem bereikbaar zijn (401 zonder geldige sig/secret).

### 3a. Dagelijkse opruiming (na de deploy van de cleanup-functie)

Voer dit eenmalig uit in de SQL-editor. Vervang de URL en het secret; zet ze daarna in
Vault (niet in de repository).

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/analysis-run-cleanup',
  'analysis_cleanup_url');
select vault.create_secret('<ANALYSIS_CLEANUP_SECRET>', 'analysis_cleanup_secret');

select cron.unschedule('analysis-runs-cleanup')
 where exists (select 1 from cron.job where jobname = 'analysis-runs-cleanup');

select cron.schedule('analysis-runs-cleanup', '15 3 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
             where name = 'analysis_cleanup_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cleanup-secret', (select decrypted_secret from vault.decrypted_secrets
                            where name = 'analysis_cleanup_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
```

Controle:

```sql
select jobname, schedule, active from cron.job where jobname = 'analysis-runs-cleanup';
select status_code, content, created from net._http_response order by created desc limit 5;
```

## 4. Frontend

```bash
npx tsc --noEmit
npx eslint src/ --max-warnings 0
npm run build
npx playwright test tests/e2e/analysis-form.spec.ts tests/e2e/analysis-run.spec.ts \
  tests/e2e/analysis-jwt.spec.ts tests/e2e/analysis-notifications.spec.ts \
  tests/e2e/analysis-server-route.spec.ts
```

- `VITE_ANALYSIS_API_URL` is uit `src/`, `.env.example` en de code verwijderd; een
  eventuele regel in `.env.local` (gitignored) is ongebruikt en mag blijven staan.
- `scripts/mock-analysis-server.mjs` blijft op schijf staan maar wordt **niet meer
  gebruikt**; de `webServer`-entry in `playwright.config.ts` is verwijderd.
- De frontend mag pas live nadat de functies en de migratie live zijn: de client leest
  `analysis_runs` en roept de nieuwe functies aan.

Daarna: PR naar `develop` → preview testen → merge naar `main` (AGENTS.md).

## 5. Handmatige verificatie (na de release)

### 5.1 Echte analyse (n8n)

1. Log in als adviseur met een risico-analyse-assistent die voor de organisatie aan
   staat en een productie-URL heeft.
2. Start een analyse met klantsituatie, één pdf en één URL.
3. Verwacht: de pagina toont eerst "in wachtrij"/"bezig", daarna "klaar" met resultaat
   en een downloadbaar dossier. Het CONCEPT-label staat overal.
4. Controleer in de Netlify/devtools-netwerklog dat de browser **geen** verzoek naar de
   n8n-host doet; alleen Supabase (`/functions/v1/analysis-run-submit`,
   `/rest/v1/analysis_runs`, `/storage/v1/...`).

### 5.2 Foutpaden

| Scenario | Verwacht |
|---|---|
| Assistent uitzetten (platformbeheer) en de analyse starten | Nederlandse melding, geen nieuwe rij in `analysis_runs` |
| Productie-URL leegmaken (platformbeheer) en starten | "Er is geen koppeling geconfigureerd. Neem contact op met de beheerder.", geen rij |
| Met een tweede adviseur het run-adres openen | "Analyse niet gevonden" / geen toegang, geen inhoud |
| `GET`/`POST` op de callback zonder geldige `sig` | 401, rij ongewijzigd |
| Tweede callback voor een afgeronde run | 409, resultaat ongewijzigd |
| Bestand > 10 MB of totaal > 25 MB | 413 + inline melding, geen rij |
| Bestandstype `.exe` | inline melding, geen rij |

Geldige signaturen maken voor een handmatige callback-test:

```bash
node -e "console.log(require('crypto').createHmac('sha256', process.env.ANALYSIS_CALLBACK_SECRET).update(process.env.RUN_ID).digest('hex'))"
```

### 5.3 Privacy- en opslagcontrole

- `storage.objects` in `analysis-dossiers`: alleen dossiers van geslaagde runs, geen
  invoerbestanden.
- `analysis_runs` bevat geen bestandsnamen, bestandsinhoud of URL's; `result_json`
  bevat alleen het analyse-resultaat.
- Geen bestandsnaam of klantinhoud in de Netlify/Supabase-logs; alleen
  `{ code, run_id, ms }`.
- `dist/assets/*.js` bevat geen n8n-host en geen webhooksecret:
  `Select-String -Path dist/assets/*.js -Pattern 'process.jaaphoeve.com'` → geen treffer.

### 5.4 Opruiming

- Maak (in een testomgeving) een rij met `expires_at = now() - interval '1 day'` en
  eventueel een testobject, en roep de cleanup-functie handmatig aan met
  `net.http_post` of `curl` (met `x-cleanup-secret`).
- Verwacht: object weg uit de bucket, rij weg uit `analysis_runs`, `{ deleted: n }`.
- De cron-job draait dagelijks om 03:15 UTC; controleer `cron.job` en
  `net._http_response`.

## 6. Rollback

| Laag | Rollback |
|---|---|
| Frontend | revert van de merge-PR; de oude client gebruikt weer de (dan nog bestaande) env-var/mock — alleen in een noodgeval |
| Edge Functions | vorige versie redeployen of de functie verwijderen; bestaande rijen blijven |
| Migratie | `drop table public.analysis_runs` + bucket verwijderen is destructief; eerst exporteren. De cron-job loskoppelen met `cron.unschedule('analysis-runs-cleanup')` |
| n8n | de handmatige wijzigingen terugdraaien (header/placeholders/payloadlimiet) |

## 7. Bekende beperkingen

- De opruiming draait dagelijks, dus een verlopen run/dossier kan tot ± 24 uur blijven
  bestaan.
- De HMAC dekt `run_id`, niet de body: wie de callback-URL onderschept kan vóór n8n een
  resultaat voor die ene run posten. Dit is de afgesproken opzet (een body-HMAC vereist
  een n8n-wijziging).
- De UI-tests gebruiken route-interception; de echte RLS- en callback-afdwinging
  verifieer je met §5.2 en de bestaande `scripts/rls-verify.mjs`.
- Zonder `E2E_EMAIL`/`E2E_PASSWORD` skippen de analyse-tests met een reden.
- De maximale upload is 25 MB; n8n moet `N8N_PAYLOAD_SIZE_MAX` verhoogd hebben.
- Een run waarvoor n8n nooit een callback stuurt, blijft in "in wachtrij"/"bezig" staan
  tot de bewaartermijn (zeven dagen) en wordt dan verwijderd. Een run-level time-out is
  niet in deze route opgenomen.
- De cron-job is een handmatige SQL-stap na de deploy (URL/secret horen niet in de
  migratie).
