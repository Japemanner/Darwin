# Data Model: 021 — Risico-analyse via de serverroute

**Date**: 2026-10-31 | **Feature**: [spec.md](spec.md) | **Branch**: `021-analysis-server-route`

## 1. Overzicht

```text
auth.users ── profiles (id, organization_id) ── analysis_runs.advisor_id
                                                    │
organizations ── ai_assistants (catalog_id) ────────┤ assistant_id
                    └─ assistant_catalog (prod_webhook_url)
platform_webhook_config (auth_header, token)

analysis_runs ── dossier_path ── storage.objects (bucket analysis-dossiers)
                                   {organization_id}/{advisor_id}/{run_id}.docx

pg_cron (dagelijks) ── pg_net ── analysis-run-cleanup ── Storage API + rijen
```

De browser leest `analysis_runs` via PostgREST (RLS) en vraagt een 60-seconden
signed URL aan voor het dossier. Schrijven gebeurt uitsluitend met de service role in
de Edge Functions.

## 2. Tabel `public.analysis_runs` (nieuw, migratie 023)

| Kolom | Type | Regels |
|---|---|---|
| `id` | uuid | PK; door de client gegenereerd en door de server gevalideerd (UUID) |
| `assistant_id` | uuid | NOT NULL, FK → `ai_assistants(id)` ON DELETE CASCADE |
| `advisor_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE; = `auth.uid()` van de aanroeper |
| `organization_id` | uuid | NOT NULL, FK → `organizations(id)` ON DELETE CASCADE; uit `profiles`, nooit uit de request |
| `client_reference` | text | NOT NULL, `length(btrim(...)) > 0` |
| `status` | text | NOT NULL DEFAULT `'queued'`, CHECK in (`queued`,`running`,`succeeded`,`failed`) |
| `started_at` | timestamptz | NOT NULL DEFAULT `now()` |
| `finished_at` | timestamptz | NULL; gezet bij `succeeded`/`failed` |
| `error_code` | text | NULL |
| `error_message` | text | NULL; Nederlandse, adviseur-leesbare melding |
| `result_json` | jsonb | NULL; `AnalysisResult` volgens 008 `analysis-schema.md` |
| `intern_markdown` | text | NULL |
| `dossier_path` | text | NULL; `{organization_id}/{advisor_id}/{run_id}.docx` |
| `expires_at` | timestamptz | NOT NULL; `now() + interval '7 days'` bij aanmaken |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |

### Indexen

```sql
create index analysis_runs_advisor_started_idx
  on public.analysis_runs (advisor_id, started_at desc);
create index analysis_runs_expires_idx
  on public.analysis_runs (expires_at);
```

### RLS

| Commando | Policy | Effect |
|---|---|---|
| SELECT | `Advisors can view own analysis runs` | `advisor_id = auth.uid() AND organization_id = get_user_org_id()` |
| INSERT/UPDATE/DELETE | geen | geweigerd voor `anon` en `authenticated`; alleen service role |

Aanvullend: `revoke all on public.analysis_runs from anon, authenticated;`
`grant select on public.analysis_runs to authenticated;` (defence in depth; RLS blijft
de grens).

### Toestandsovergangen

```text
(geen rij)
   │ submit: alle controles OK, productie-URL aanwezig
   ▼
 queued ── n8n 202 ──► running ── callback ok ──► succeeded
   │                      │
   │ n8n ≠ 202 / timeout  │ callback error
   ▼                      ▼
 failed                 failed
```

- `queued → failed` ook bij een directe n8n-fout of time-out (30 s).
- `succeeded` en `failed` zijn eindtoestanden; een volgende callback krijgt 409 en
  wijzigt niets.
- Een run zonder callback blijft `queued`/`running` tot de bewaartermijn; de cleanup
  verwijdert hem dan (geen eeuwige "bezig"-status in de lijst).

## 3. Storage-bucket `analysis-dossiers`

| Eigenschap | Waarde |
|---|---|
| Publiek | nee |
| Pad | `{organization_id}/{advisor_id}/{run_id}.docx` |
| Inhoud | alleen het door n8n geleverde klantdossier (`.docx`) |
| Levensduur | tot `analysis_runs.expires_at`; daarna verwijdert de cleanup het object |

Policies op `storage.objects`:

| Commando | Policy | Voorwaarde |
|---|---|---|
| SELECT | `Advisors can read own analysis dossiers` | `bucket_id = 'analysis-dossiers' AND (storage.foldername(name))[1] = get_user_org_id()::text AND (storage.foldername(name))[2] = auth.uid()::text` |
| INSERT/UPDATE/DELETE | geen | alleen de service role (Edge Functions en cleanup) |

Toelichting: de client maakt een signed URL met `createSignedUrl(path, 60)`; daarvoor
is SELECT nodig. Uploaden en verwijderen gebeurt nooit met de client.

## 4. Client-entiteiten en mapping

### `AnalysisRun` (bestaand schema, uitgebreid)

| DB-kolom | Clientveld | Regel |
|---|---|---|
| `id`, `assistant_id`, `advisor_id`, `client_reference`, `status`, `started_at`, `finished_at`, `error_code`, `error_message`, `expires_at` | idem | ongewijzigd |
| `result_json` | `result` | nullable; zod-gevalideerd bij weergave |
| `intern_markdown` | `intern_markdown` | nullable |
| `dossier_path` | `dossier_path` | **nieuw**, nullable, `string` |
| — | `dossier_docx_url` | blijft optioneel in het schema, wordt niet meer gevuld |

### `RecentRun` (bestaand schema)

Ongewijzigd: `id`, `assistant_id`, `client_reference`, `status`, `started_at`,
`finished_at`, `error_code`, optioneel `expires_at`. De lijst-query selecteert alleen
deze kolommen; nooit `result_json`, `intern_markdown` of `dossier_path`.

### Formulierinvoer → multipart

| FormData-veld | Bron | Servergedrag |
|---|---|---|
| `run_id` | `crypto.randomUUID()` in de client | UUID-validatie; PK |
| `assistant_id` | route/assistent | bestaan + actief + type + eigen org |
| `verzekeringsvraagstuk` | formulier | verplicht, non-empty |
| `kennisbronnen` | JSON-array `[{id,name}]` | id's gevalideerd tegen `assistant_knowledge_bases`; namen server-side geresolveerd |
| `klantsituatie` | formulier | optioneel |
| `bestanden` | `File[]` | pdf/docx/txt; ≤ 10 MB per bestand; ≤ 25 MB totaal |
| `urls` | JSON-array | elk https |
| `klant_ref` | formulier | verplicht, non-empty |

De velden `advisor_id` en `adviseur` worden **niet** meer door de client gestuurd; de
server leidt de adviseur af uit het JWT en stuurt `adviseur` als platte naamstring naar
n8n.

## 5. Opruiming

De cleanup-functie (service role) doet per aanroep:

1. `select id, dossier_path from analysis_runs where expires_at < now() order by expires_at limit 1000`.
2. Verzamelt de niet-lege `dossier_path`s en verwijdert ze in batches van maximaal 100
   via de Storage API (`remove` ondersteunt tot 1000 paden per call).
3. Verwijdert de rijen waarvan het object weg is (of die geen `dossier_path` hadden):
   `delete from analysis_runs where id = any(...)`.
4. Rijen waarvan de objectverwijdering mislukte, blijven staan en komen de volgende dag
   opnieuw aan de beurt.
5. Retourneert `{ deleted, failed }` zonder paden of klantinhoud te loggen.

De dagelijkse trigger staat in quickstart (pg_cron + pg_net + Vault), niet in de
migratie, omdat de functie-URL pas na de deploy bestaat en het cleanup-secret nooit in
de repository mag staan.

## 6. Verificatiequeries (na de migratie)

```sql
-- 1. RLS aan en precies één SELECT-policy
select relrowsecurity from pg_class where oid = 'public.analysis_runs'::regclass;
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'analysis_runs';

-- 2. Bucket privé en alleen een SELECT-policy
select id, public from storage.buckets where id = 'analysis-dossiers';
select policyname, cmd from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname = 'Advisors can read own analysis dossiers';

-- 3. Geen rijen zonder eigenaar/organisatie (moet 0 zijn)
select count(*) from public.analysis_runs
 where advisor_id is null or organization_id is null;

-- 4. Cleanup-kandidaten (aantal, zonder inhoud)
select count(*) from public.analysis_runs where expires_at < now();

-- 5. Cron-job aanwezig (na de handmatige schedule-stap)
select jobname, schedule, active from cron.job where jobname = 'analysis-runs-cleanup';
```
