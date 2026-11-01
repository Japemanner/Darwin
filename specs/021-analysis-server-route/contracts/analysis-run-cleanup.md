# Contract: `analysis-run-cleanup` (pg_cron → Darwin)

**Feature**: 021-analysis-server-route | **Datum**: 2026-10-31
**Doel**: verlopen uitvoeringen én hun dossierbestanden echt verwijderen (US6/FR-020,
constitution III).

## Endpoint

`POST {SUPABASE_URL}/functions/v1/analysis-run-cleanup`

- **Deploy met `--no-verify-jwt`** (de aanroeper is pg_cron, geen gebruiker).
- Alleen server-to-server; geen CORS, geen browsergebruik.
- Verificatie: header `x-cleanup-secret` moet gelijk zijn aan het Edge-secret
  `ANALYSIS_CLEANUP_SECRET` (constant-time). Ontbreekt/klopt niet → 401, niets doen.

## Request

```http
POST /functions/v1/analysis-run-cleanup
x-cleanup-secret: <ANALYSIS_CLEANUP_SECRET>
Content-Type: application/json

{}
```

## Gedrag

1. Selecteer maximaal 1000 verlopen rijen:
   `select id, dossier_path from public.analysis_runs
    where expires_at < now() order by expires_at limit 1000`.
2. Verzamel de niet-lege `dossier_path`s en verwijder ze in batches van maximaal 100
   via de Storage API:
   `serviceClient.storage.from('analysis-dossiers').remove(paths)`.
3. Verwijder de rijen waarvan het object weg is (of die geen `dossier_path` hadden).
4. Rijen met een mislukte objectverwijdering blijven staan; de volgende run pakt ze
   opnieuw op.
5. Antwoord 200 met `{ deleted: number, failed: number }`.

Er wordt niets gelogd behalve `{ code, deleted, failed, ms }`; nooit paden, run-id's of
klantinhoud.

## Waarom geen SQL-delete van `storage.objects`

Supabase waarschuwt expliciet dat het verwijderen van rijen uit `storage.objects` de
fysieke bestanden in de bucket achterlaat (orphaned objects). De Storage API is de enige
juiste verwijderweg; daarom een kleine functie in plaats van een pure SQL-job.

## Trigger (handmatige stap, zie quickstart)

De dagelijkse job staat bewust **niet** in de migratie: de functie-URL bestaat pas na
de deploy en het cleanup-secret mag nooit in de repository staan. In quickstart:

```sql
-- eenmalig, na de deploy van de functie
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/analysis-run-cleanup',
  'analysis_cleanup_url');
select vault.create_secret('<zelfde waarde als ANALYSIS_CLEANUP_SECRET>',
  'analysis_cleanup_secret');

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

- pg_cron en pg_net worden in de migratie aangezet.
- De job draait dagelijks om 03:15 UTC; verlopen rijen blijven dus maximaal ±24 uur
  staan, nooit langer dan nodig.
- Resultaat controleren: `select * from net._http_response order by created desc limit 5;`
  en `select jobname, schedule, active from cron.job where jobname = 'analysis-runs-cleanup';`.
