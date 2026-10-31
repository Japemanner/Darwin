# Quickstart: Platformbeheer van assistentcatalogus, organisatieschakelaars en n8n-koppelingen

**Feature**: `019-platform-assistant-catalog` | **Branch**: `019-platform-assistant-catalog`

> **Er is nog niets toegepast of gedeployed.** Elke stap hieronder vraagt om uw expliciete
> bevestiging in de chat. De migratie is pas toepasbaar nadat het e-mailadres van de
> platformbeheerder is ingevuld.

## 0. Voorwaarden

| Voorwaarde | Controle |
|---|---|
| E-mailadres platformbeheerder bekend | vul `<PLATFORM_ADMIN_EMAIL>` in `021_platform_admin_catalog.sql` |
| Dat account heeft een `profiles`-rij | `SELECT id, role FROM profiles WHERE id = (SELECT id FROM auth.users WHERE email = '<adres>');` |
| Dat account is `role = 'admin'` in de eigen organisatie (nodig om kennisbronnen te koppelen) | zelfde query; `role` moet `admin` zijn |
| Elke organisatie heeft minstens één admin (nodig voor `created_by` in de datavulling) | `SELECT o.name FROM organizations o WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.organization_id = o.id AND p.role = 'admin');` → moet leeg zijn |
| Bevestiging om de migratie toe te passen | vraag in de chat |

Optionele omgevingsvariabelen (lokaal, `.env.local`):

```dotenv
# E2E-platformbeheerder (tests/e2e/fixtures.ts)
E2E_PLATFORM_ADMIN_EMAIL=platform-admin@example.com
E2E_PLATFORM_ADMIN_PASSWORD=your-platform-admin-password
# Organisatie waartegen schakeltests draaien; tests skippen zonder deze variabele
E2E_TEST_ORG_NAME=Darwin
```

Dezelfde sleutels staan zonder echte waarden in `.env.example`.

## 1. Migratie `021_platform_admin_catalog.sql`

Bestand: `supabase/migrations/021_platform_admin_catalog.sql`.

Inhoud: zie `data-model.md` §2–§5. Kernpunten:

1. `platform_admins`, `assistant_catalog`, `platform_webhook_config` aanmaken (RLS aan, geen
   policies, `REVOKE ALL` van clientrollen).
2. `is_platform_admin()` aanmaken (SECURITY DEFINER, `search_path = public`).
3. `ai_assistants.catalog_id` + `UNIQUE (organization_id, catalog_id)`.
4. De zes schrijf-policies droppen (drie `Admins …` uit 015, drie verweesde `Users …`).
5. `platform_save_catalog_assistant` en `platform_seed_org_assistants` aanmaken en alleen aan
   `service_role` granten.
6. Datavulling: vijf catalogusitems, vijf bestaande rijen koppelen, acht ontbrekende combinaties
   met `is_active = false`, centrale koppeling vullen uit `flow_configs`, platformbeheerder
   toevoegen, daarna `catalog_id SET NOT NULL`.

**Toepassen** (alleen na bevestiging): Supabase MCP `apply_migration` met naam
`platform_admin_catalog` en de definitieve SQL (placeholder vervangen). Niet met de hand in de
SQL-editor, zodat de migratiehistorie klopt.

## 2. Verificatie direct na de migratie

```sql
-- a. Iedere rij heeft een catalogusitem; 5 bestaande + 5 nieuwe = 10
SELECT count(*) AS totaal, count(*) FILTER (WHERE catalog_id IS NULL) AS zonder
FROM public.ai_assistants;

-- b. Actieve set ongewijzigd: Darwin 3, Gerard_Tekelenburg 2
SELECT o.name, count(*) FILTER (WHERE a.is_active) AS actief
FROM public.organizations o JOIN public.ai_assistants a ON a.organization_id = o.id
GROUP BY o.name ORDER BY o.name;

-- c. Geen schrijfpolicies meer op ai_assistants
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'ai_assistants' AND cmd <> 'SELECT';
-- verwacht: 0 rijen

-- d. Koppeling gevuld, token niet zichtbaar
SELECT auth_header, (token <> '') AS has_token, document_webhook_url
FROM public.platform_webhook_config;
-- verwacht: X-Webhook-Token | true | https://process.jaaphoeve.com/webhook/86ff1d2c-…

-- e. Eén platformbeheerder
SELECT count(*) FROM public.platform_admins;  -- verwacht: 1

-- f. Geen dubbele combinaties
SELECT organization_id, catalog_id, count(*) FROM public.ai_assistants
GROUP BY 1, 2 HAVING count(*) > 1;             -- verwacht: 0 rijen
```

## 3. Edge Functions deployen (na bevestiging, in deze volgorde)

1. `platform-admin` (nieuw)
2. `rag-chat` (gewijzigd)
3. `document-webhook` (gewijzigd)
4. `create-tenant` (gewijzigd)

Rooktest na elke deploy:

| Functie | Controle |
|---|---|
| `platform-admin` | als platformbeheerder `list_organizations` → 2 organisaties; als kantoorbeheerder → 403 |
| `rag-chat` | één chatbericht met een aangezette assistent → normaal antwoord; met een uitgezette assistent → 403 |
| `document-webhook` | indexeeractie op een bestaand document → `{ ok: true }` |
| `create-tenant` | kantoorbeheerder → 403; platformbeheerder → nieuwe organisatie met alle assistenten aan |

`ALLOWED_ORIGINS` moet de Netlify-origin(s) bevatten; zonder match krijgt de browser geen
CORS-header (fail-closed).

## 4. Frontend releasen

Na de functies: `src/`-wijzigingen uit `plan.md` deployen. Controle:

- Kantoorbeheerder: geen Instellingen in het menu; `/settings` toont "Geen toegang".
- Platformbeheerder: Instellingen → organisatie kiezen → horizontale rij tegels met schakelaars.
- Tandwiel → Koppelingen: secretveld leeg met "Secret is ingesteld; laat leeg om te behouden".
- Assistenten: platformbeheerder ziet alle tegels (ook "Inactief"), kantoorbeheerder alleen
  aangezette; geen verwijderknop, geen webhookveld, geen Actief-schakelaar in de modal.
- Kennisbronnen koppelen werkt voor de kantoorbeheerder.

## 5. `flow-config` verwijderen (handmatig, na de release)

De oude functie blijft tot de nieuwe frontend live staat. Daarna zelf verwijderen:

- Supabase dashboard → Edge Functions → `flow-config` → Delete.
- Het bestand `supabase/functions/flow-config/` en `src/lib/flow-config-client.ts` zijn in deze
  feature al verwijderd; `tests/e2e/flow-config.spec.ts` eveneens.
- `flow_configs` blijft als tabel bestaan (buiten scope om te verwijderen).

## 6. Tests

```bash
npx tsc --noEmit
npx eslint src/ --max-warnings 0
npm run build
npx playwright test tests/e2e/platform-admin.spec.ts
npx playwright test                      # volledige regressie
node scripts/rls-verify.mjs              # member + kantoorbeheerder
```

E2E-scenario's in `tests/e2e/platform-admin.spec.ts`:

1. Kantoorbeheerder ziet Instellingen niet en krijgt op `/settings` "Geen toegang".
   (Skipt als `E2E_EMAIL` gelijk is aan `E2E_PLATFORM_ADMIN_EMAIL`.)
2. Platformbeheerder zet een assistent uit voor `E2E_TEST_ORG_NAME`; een lid van die organisatie
   ziet hem daarna niet meer. De oorspronkelijke stand wordt in `finally` teruggezet.
3. De dialoog Koppelingen toont het secret nooit (veld leeg, alleen `has_token`-placeholder).
4. De schakelaar is met Tab en Spatie te bedienen; de stand wordt teruggezet.

`scripts/rls-verify.mjs` wordt uitgebreid met:

- member én kantoorbeheerder: INSERT/UPDATE/DELETE op `ai_assistants` geweigerd;
- member én kantoorbeheerder: `platform_admins`, `assistant_catalog` en
  `platform_webhook_config` niet leesbaar;
- bestaande positieve controles blijven groen.

## 7. Rollback

- Migratie is additief op twee uitzonderingen na: de policy-drops en `catalog_id SET NOT NULL`.
  Terugdraaien vereist een nieuwe migratie die de oude policies herstelt en `catalog_id`
  nullable maakt; de nieuwe tabellen kunnen blijven staan (ongebruikt).
- Edge Functions: vorige versie terugzetten via het Supabase-dashboard (vorige deployment).
- Frontend: vorige Netlify-deploy restoren. Zolang `flow-config` nog bestaat, blijft de oude
  Instellingen-pagina werken.

## 8. Definition of Done

- [ ] `npx tsc --noEmit` groen
- [ ] `npx eslint src/ --max-warnings 0` groen
- [ ] `npm run build` groen
- [ ] `tests/e2e/platform-admin.spec.ts` groen
- [ ] volledige Playwright-regressie groen
- [ ] `scripts/rls-verify.mjs` groen
- [ ] verificatiequeries §2 geven de verwachte uitkomsten
- [ ] FEATURES.md bijgewerkt (via `@feature-tracker`)
- [ ] `flow-config` na de release verwijderd (stap 5)

## 9. Bewuste gedragswijzigingen

| Wijziging | Toelichting |
|---|---|
| Gerard_Tekelenburg authenticatie | had lege tokens; gebruikt nu het centrale token en werkt daardoor naar verwachting voor het eerst correct |
| Kantoorbeheerder ziet geen inactieve assistenten meer | alleen de platformbeheerder ziet ze, met label "Inactief" |
| Kantoorbeheerder verliest Instellingen | inclusief "Nieuwe organisatie" en de oude webhookinstellingen |
| Assistentmodal | geen webhook-URL, geen Actief-schakelaar, geen verwijderknop |
| Directe link naar een uitgezette assistent | `ChatPage` toont al "Assistent niet gevonden" en `rag-chat` weigert met de bestaande toegangsfout; hiervoor is geen codewijziging nodig (gecontroleerd) |
| `tests/e2e/flow-config.spec.ts` | verwijderd; de UI en functie bestaan niet meer |
| `tests/e2e/admin-only-management.spec.ts` | US3-assertions aangepast aan het nieuwe gedrag |
