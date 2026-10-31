# Quickstart: Kennisbronnenbeheer dat laat zien of een bron bruikbaar is

**Feature**: 016-knowledge-source-manageability | **Branch**: `016-knowledge-source-manageability`

## Prerequisites

- Node 20, dependencies installed (`npm install`)
- Supabase-project met de migraties t/m 017
- `.env.local` met `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY`
- Voor E2E: `E2E_EMAIL` / `E2E_PASSWORD` (admin) en optioneel `E2E_MEMBER_EMAIL` / `E2E_MEMBER_PASSWORD`
- Supabase MCP beschikbaar voor migratie en edge-function-deploy

## 1. Database

Pas `supabase/migrations/018_knowledge_source_manageability.sql` toe via Supabase MCP. De migratie:

1. voegt `knowledge_base_documents.error_message text` toe;
2. maakt `knowledge_base_stats` met `security_invoker = true`;
3. gunt `SELECT` aan `authenticated`;
4. herlaadt het PostgREST-schema.

Controleer daarna:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'knowledge_base_documents' and column_name = 'error_message';

select * from public.knowledge_base_stats limit 5;
```

Verwacht: `error_message | text | YES` en één stats-rij per kennisbron.

## 2. Edge function

Deploy `supabase/functions/document-webhook` opnieuw via Supabase MCP. Wijziging: bij `action = 'index'` een admincheck, status `processing` + `error_message = null` vóór de n8n-call, en status `error` + Nederlandse fouttekst bij upstream-falen.

Controleer dat `ALLOWED_ORIGINS` nog steeds de app-origin bevat en dat de secrets (`VITE_SUPABASE_*`, service role) aanwezig zijn.

## 3. Frontend

```bash
npm run dev
```

Handmatige controle op `/knowledge`:

1. Elke kaart toont aantal documenten, aantal fouten en "Laatst bijgewerkt".
2. Open een bron met een document in verwerking: de status ververst elke ~5 s en stopt daarna.
3. Een foutdocument toont "Fout", de reden (indien gevuld; anders de algemene fouttekst) en "Opnieuw verwerken"; de knop zet de status terug op "Verwerken".
4. Verwijderen opent een bevestiging met de documentnaam; annuleren doet niets.
5. Bewerken van een bron met documenten: naamveld disabled met de uitleg over de zoekfunctie.
6. Meerdere bestanden kiezen of slepen: per bestand "Wachten" → "Uploaden..." → "Klaar"/"Fout".
7. Het Vector Collection ID-veld en het Kennisitems-tabblad zijn weg; bestaande data is ongewijzigd.
8. Als member: statusinformatie zichtbaar, geen bewerk-, upload-, retry- of verwijderknoppen.

## 4. Quality gates

```bash
npx tsc --noEmit
npx eslint src/ --max-warnings 0
npm run build
npx playwright test tests/e2e/knowledge-source-manageability.spec.ts
```

Verwacht: alle vier groen. De E2E-tests mocken de REST-routes en `document-webhook`; alleen de login is echt.

## 5. Definition of Done

- [ ] Migratie toegepast en view bereikbaar
- [ ] Edge function gedeployed
- [ ] `tsc`, ESLint, build en feature-tests groen
- [ ] `FEATURES.md` bijgewerkt (Kennisitems-tab verborgen, data behouden)
- [ ] Geen nieuwe npm-dependencies
- [ ] Constitution Check opnieuw bevestigd (Dutch UI, geen klantinhoud in logs/URL's, typed client, admin-only, minimale scope)

## Rollback

- Frontend: revert de feature-branch.
- Edge function: vorige versie redeployen.
- Database: `DROP VIEW public.knowledge_base_stats;` en `ALTER TABLE knowledge_base_documents DROP COLUMN error_message;` (alleen als zeker is dat geen enkele rij intussen een reden bevat; de kolom is nullable en additief).
