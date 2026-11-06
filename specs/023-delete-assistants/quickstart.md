# Quickstart: Assistenten verwijderen — implementatie en verificatie

**Feature**: `023-delete-assistants` | **Datum**: 2026-11-06

Dit is de handmatige route naast de geautomatiseerde tests. Voer de stappen in
deze volgorde uit: eerst de migratie, dan de Edge Function, dan de frontend.

## 0. Voorbereiding

- Platformbeheerdersaccount met een rij in `platform_admins`.
- Minstens twee organisaties en één assistent met een bestaand gesprek (voor de
  geschiedenischeck).
- Minstens één organisatie die pas **na** het archiveren wordt aangemaakt (voor de
  herstelregel).
- `psql` of de Supabase MCP voor de SQL-controles.
- Een kantoorbeheerdersaccount en een anonieme anon-key client voor de
  negatieve controles.

## 1. Migratie 025 toepassen

Maak `supabase/migrations/025_assistant_archive.sql` aan volgens
`data-model.md` §7 en pas hem toe via de Supabase MCP
(`apply_migration`, naam `assistant_archive`). Gebruik geen handmatige SQL in
productie buiten de MCP om.

Controleer daarna:

```sql
-- 1. Kolommen bestaan en zijn leeg.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('assistant_catalog', 'ai_assistants')
   and column_name = 'archived_at';

select count(*) from public.assistant_catalog where archived_at is not null; -- 0
select count(*) from public.ai_assistants   where archived_at is not null; -- 0

-- 2. Functies bestaan en zijn alleen voor service_role uitvoerbaar.
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_can_execute,
       has_function_privilege('service_role', p.oid, 'execute')  as service_can_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('platform_archive_catalog_assistant',
                     'platform_restore_catalog_assistant',
                     'platform_seed_org_assistants');

-- 3. RLS staat nog aan en de index bestaat.
select relname, relrowsecurity from pg_class
 where relname in ('assistant_catalog', 'ai_assistants');
select indexname from pg_indexes
 where tablename = 'ai_assistants'
   and indexname = 'ai_assistants_organization_archived_idx';
```

Draai daarna de security- en performance-advisors van de Supabase MCP en los
nieuwe bevindingen op.

## 2. Edge Function `platform-admin` deployen

Werk `supabase/functions/platform-admin/index.ts` bij volgens het contract en
deploy met de Supabase MCP (`deploy_edge_function`, functienaam `platform-admin`,
JWT-verificatie aan). Controleer dat de bestaande acties ongewijzigd blijven
werken.

## 3. Frontend bouwen en statische controles

```powershell
npx tsc --noEmit
npx eslint src/ --max-warnings 0
npm run build
```

Alle drie moeten groen zijn vóór de Playwright-suite.

## 4. Playwright

```powershell
npx playwright test tests/e2e/assistant-archive.spec.ts
npx playwright test
```

De nieuwe spec dekt met gemockte REST- en functieantwoorden:

- de verwijderknop en het bevestigingsvenster voor de platformbeheerder;
- annuleren laat alles staan;
- bevestigen stuurt `archive_catalog_assistant` en haalt de kaart weg;
- het archief toont de verwijderde assistent en `restore_catalog_assistant` haalt
  hem uit het archief;
- een kantoorbeheerder ziet geen verwijderknop en geen Archief-knop.

De echte databankpaden worden hieronder handmatig gecontroleerd.

## 5. Handmatige acceptatie

### 5.1 Archiveren

1. Log in als platformbeheerder en open **AI-assistenten**.
2. Kies een testassistent met een bestaand gesprek en klik op het prullenbak-icoon.
3. Controleer het venster: naam, "voor alle organisaties", "gesprekken en analyses
   blijven leesbaar", "herstel via het archief", **Annuleren** heeft de focus.
4. Annuleer: de assistent staat er nog.
5. Open het venster opnieuw en bevestig met **Verwijderen**.
6. Controleer: de kaart verdwijnt direct, de bevestiging verschijnt en de focus
   gaat naar **Archief**.

### 5.2 Zichtbaarheid en bruikbaarheid

Controleer als adviseur en als kantoorbeheerder:

- **AI-assistenten**: de assistent staat er niet meer tussen.
- **Startscherm**: de assistent wordt niet aangeboden.
- **Geschiedenis**: het oude gesprek opent en de berichten zijn leesbaar; de naam
  en het icoon blijven zichtbaar.
- **Nieuw bericht** in dat gesprek: de bestaande foutmelding verschijnt, er komt
  geen antwoord.
- **Directe link** `/chat/new/<assistant-id>`: "Assistent niet gevonden".
- **Directe link** `/analyse/new/<assistant-id>`: "Assistent niet gevonden".
- **Instellingen**: de assistent staat niet meer in de schakelaarrij van enige
  organisatie.
- **Koppelingen**: de assistent en zijn URL's staan er niet meer in.

Controleer in de database:

```sql
-- Kies het gearchiveerde catalogus-id.
select id, name, archived_at from public.assistant_catalog where archived_at is not null;

-- Alle organisatierijen delen hetzelfde tijdstip; is_active is ongewijzigd.
select organization_id, is_active, archived_at
  from public.ai_assistants
 where catalog_id = '<catalog-id>'
 order by organization_id;

-- Geschiedenis en koppelingen zijn niet aangeraakt.
select count(*) from public.conversations
 where assistant_id in (select id from public.ai_assistants where catalog_id = '<catalog-id>');
select count(*) from public.messages m
  join public.conversations c on c.id = m.conversation_id
 where c.assistant_id in (select id from public.ai_assistants where catalog_id = '<catalog-id>');
select count(*) from public.analysis_runs
 where assistant_id in (select id from public.ai_assistants where catalog_id = '<catalog-id>');
select count(*) from public.assistant_knowledge_bases
 where assistant_id in (select id from public.ai_assistants where catalog_id = '<catalog-id>');
```

Vergelijk de aantallen met de waarden van vóór het archiveren; ze moeten gelijk
zijn.

### 5.3 Nieuwe organisatie tijdens het archief

1. Maak als platformbeheerder een nieuwe organisatie aan terwijl de assistent
   gearchiveerd is.
2. Controleer dat de nieuwe organisatie de assistent **niet** heeft gekregen:

```sql
select count(*) from public.ai_assistants
 where organization_id = '<nieuwe-org-id>' and catalog_id = '<catalog-id>'; -- 0
```

### 5.4 Herstellen

1. Open **AI-assistenten** → **Archief**.
2. Controleer icoon, naam, type en de verwijderdatum (Nederlands formaat).
3. Klik op **Herstellen**.
4. Controleer: de assistent staat weer op AI-assistenten, de bevestiging verschijnt
   en het archief toont de Nederlandse lege toestand als er niets meer in staat.
5. Controleer per organisatie dat de schakelaar dezelfde stand heeft als vóór het
   verwijderen.
6. Controleer dat de nieuwe organisatie de assistent nu wel heeft, maar **uit**.
7. Open het oude gesprek: lezen werkt en een nieuw bericht werkt weer volgens de
   schakelaarstand.
8. Open **Koppelingen**: de assistent en zijn URL's staan er weer in.
9. Controleer dat de kennisbronkoppelingen weer gelden (vraag stellen aan de
   assistent gebruikt dezelfde bronnen).

## 6. Negatieve beveiligingscontroles

Vervang de placeholders; gebruik de anon key en een JWT van een kantoorbeheerder.

```powershell
# Anoniem: 401
curl -i -X POST "$SUPABASE_URL/functions/v1/platform-admin" `
  -H "Content-Type: application/json" `
  -H "apikey: $ANON_KEY" `
  -d '{"action":"archive_catalog_assistant","catalog_id":"<catalog-id>"}'

# Kantoorbeheerder: 403
curl -i -X POST "$SUPABASE_URL/functions/v1/platform-admin" `
  -H "Content-Type: application/json" `
  -H "apikey: $ANON_KEY" `
  -H "Authorization: Bearer $OFFICE_ADMIN_JWT" `
  -d '{"action":"archive_catalog_assistant","catalog_id":"<catalog-id>"}'

# Kantoorbeheerder: 403 op herstellen
curl -i -X POST "$SUPABASE_URL/functions/v1/platform-admin" `
  -H "Content-Type: application/json" `
  -H "apikey: $ANON_KEY" `
  -H "Authorization: Bearer $OFFICE_ADMIN_JWT" `
  -d '{"action":"restore_catalog_assistant","catalog_id":"<catalog-id>"}'
```

Controleer dat de assistent na elke geweigerde aanroep ongewijzigd is.

## 7. Idempotentie en fouten

- Archiveer dezelfde assistent tweemaal via de functie: de tweede keer
  `400 VALIDATION` ("Deze assistent is al verwijderd."), zonder wijziging.
- Herstel een niet-gearchiveerde assistent: `400 VALIDATION` ("Deze assistent is
  niet verwijderd.").
- Archiveer een onbekend id: `400 VALIDATION` ("Deze assistent bestaat niet
  meer.").
- Breek tijdelijk de service-role configuratie (of simuleer met een ongeldige
  functie-URL) en controleer dat de UI een Nederlandse foutmelding toont en de
  assistent volledig blijft bestaan.

## 8. Rollback

De migratie is additief. Rollback in omgekeerde volgorde:

1. Zet de frontend terug (vorige Netlify-deploy) zodat de nieuwe kolommen niet
   meer worden gefilterd.
2. Deploy de vorige `platform-admin`-functie.
3. Zet eventueel gearchiveerde assistenten terug:

```sql
update public.assistant_catalog set archived_at = null where archived_at is not null;
update public.ai_assistants   set archived_at = null where archived_at is not null;
```

4. Verwijder daarna de index, de twee functies en de twee kolommen. Er is geen
   gebruikersdata verwijderd, dus rollback verliest geen geschiedenis.

## 9. Release

1. Alles groen op `develop` (Netlify preview).
2. PR `develop` → `main`.
3. Controleer na de productiedeploy dezelfde acceptatie als §5.1–§5.4 met één
   echte, ongebruikte assistent.
4. Werk `FEATURES.md` en `FITNESS.md` bij volgens de projectworkflow.
