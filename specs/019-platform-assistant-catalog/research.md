# Phase 0 Research: Platformbeheer van assistentcatalogus, organisatieschakelaars en n8n-koppelingen

**Feature**: `019-platform-assistant-catalog` | **Date**: 2026-10-31

Alle onbekenden uit de Technical Context zijn hieronder besloten. De technische route van de
opdrachtgever is leidend; waar de live database afweek, is dat expliciet benoemd en bevestigd.

---

## 1. Datamodel: catalogus + per-organisatie rij

**Decision**: `assistant_catalog` houdt de platformbrede definitie. Elke organisatie krijgt één
`ai_assistants`-rij per catalogusitem via `ai_assistants.catalog_id` (UNIQUE per organisatie).
De schakelaar is `ai_assistants.is_active`.

**Rationale**: `conversations.assistant_id`, `assistant_knowledge_bases.assistant_id` en de
RLS-policies verwijzen allemaal naar `ai_assistants`. Door de per-organisatie rij te behouden
hoeft geen enkele foreign key te worden verlegd en blijven bestaande gesprekken zonder migratie
leesbaar (FR-022, FR-025). De bestaande `is_active`-controle in `rag-chat` en de UI blijft
letterlijk werken.

**Alternatives considered**:
- `ai_assistants.organization_id` nullable maken en één globale rij per assistent gebruiken →
  vereist herkoppeling van alle gesprekken, kenniskoppelingen en feedback, plus herschrijven van
  alle RLS-policies. Hoog risico op dataverlies, geen voordeel.
- Alleen een koppeltabel (`organization_assistants`) zonder per-organisatie `ai_assistants`-rij →
  breekt `conversations.assistant_id` en de bestaande queries.

## 2. Bron van waarheid voor de definitie

**Decision**: `assistant_catalog` is de bron van waarheid. `platform_save_catalog_assistant`
schrijft de definitie in dezelfde transactie door naar alle `ai_assistants`-rijen met dat
`catalog_id`.

**Rationale**: de bestaande UI, `useAssistants` en `rag-chat` lezen `ai_assistants.name`,
`icon`, `type` en `example_questions`. Door de definitie te spiegelen blijven die leesroutes
werken; de schrijfactie is atomair, dus er kan geen versie driften.

**Alternatives considered**: alleen via een view/join lezen → meer wijzigingen in de frontend
en in `rag-chat` dan nodig; de route schrijft spiegelen expliciet voor.

## 3. RLS-drift op `ai_assistants` (bevestigd door opdrachtgever)

**Decision**: naast de drie `Admins can …`-policies worden ook de drie verweesde policies
`Users can create assistants`, `Users can update assistants` en `Users can delete assistants`
gedropt.

**Rationale**: de live database bevat die drie permissieve policies (niet in enige migratie).
Permissieve policies combineren met OR, dus elk lid kon assistenten aanmaken, wijzigen en
verwijderen. Zonder deze drop faalt FR-008/FR-024 en zou `scripts/rls-verify.mjs` rood blijven.

**Alternatives considered**: alleen de route volgen → acceptatiecriterium onhaalbaar. Policies
`RESTRICTIVE` maken → omslachtig en laat de verweesde policies staan.

## 4. Autoristatie: aparte tabel, geen rolwaarde

**Decision**: `platform_admins` (user_id → `auth.users`) plus `public.is_platform_admin()`
(SECURITY DEFINER, STABLE, `search_path = public`).

**Rationale**: `profiles.role` heeft een CHECK op `admin|member` en de policy
"Users can update their own profile" staat gebruikers toe hun eigen rij te wijzigen. Een
`platform_admin`-rolwaarde in `profiles` zou dus self-escalatie mogelijk maken. Een aparte tabel
zonder policies en zonder clientrechten is niet via de client te lezen of te wijzigen.

**Alternatives considered**: `profiles.role` uitbreiden → privilege escalation; `auth.users`
`app_metadata` → vereist admin-API bij elke leesactie en is niet in RLS te gebruiken.

**Grant-detail**: `GRANT EXECUTE ... TO authenticated` is een no-op zolang de functie
PUBLIEK uitvoerbaar is. Daarom wordt eerst `REVOKE ALL ... FROM PUBLIC` gedaan en daarna
expliciet aan `authenticated` gegrant. `anon` kan de functie dan niet aanroepen.

## 5. Functies `platform_save_catalog_assistant` en `platform_seed_org_assistants`

**Decision**: SECURITY DEFINER, `SET search_path = public`, `REVOKE EXECUTE FROM PUBLIC, anon,
authenticated` **en daarna `GRANT EXECUTE TO service_role`**.

**Rationale**: `REVOKE ... FROM PUBLIC` haalt de standaard-EXECUTE óók bij `service_role` weg;
zonder expliciete grant kan de Edge Function de RPC niet aanroepen. Alleen de service role
(server-side) mag deze functies uitvoeren.

**Alternatives considered**: De inserts in de Edge Function met de service-role client doen in
plaats van in een functie → niet atomair over alle organisaties (de route vraagt één transactie).

## 6. Seed versus datavulling

**Decision**: `platform_seed_org_assistants` zet nieuwe rijen **aan** en wordt alleen gebruikt
voor nieuwe organisaties. De datavulling in dezelfde migratie insert ontbrekende combinaties
voor bestaande organisaties juist met `is_active = false`.

**Rationale**: FR-023 (nieuwe organisatie → alles aan) en FR-025 (bestaande organisaties zien
exact dezelfde actieve set) zijn tegengesteld als één functie beide paden zou bedienen. De
datalijn blijft zo aantoonbaar gelijk aan de oude situatie.

## 7. `created_by` bij datavulling en seed

**Decision**: bestaande rijen houden hun `created_by`. Ontbrekende combinaties krijgen de
oudste `profile` met `role = 'admin'` van die organisatie; nieuwe organisaties krijgen de
aanroeper (`p_actor`) zoals de route voorschrijft.

**Rationale**: `ai_assistants.created_by` is `NOT NULL` met FK naar `profiles(id)`; een
platformbeheerder zonder profielrij zou de seed laten falen. Elke bestaande organisatie heeft
minstens één admin (geverifieerd: Darwin 2, Gerard_Tekelenburg 1).

**Risk**: een organisatie zonder admin laat de migratie falen op de NOT NULL — bewust, zodat er
geen rij met een verzonnen auteur ontstaat. De pre-check in quickstart vangt dit vóór het
toepassen.

## 8. Tokenopslag en -transport

**Decision**: `platform_webhook_config` is één rij (`id boolean PRIMARY KEY CHECK (id)`),
RLS aan, geen policies, `REVOKE ALL` van clientrollen. Het token wordt uitsluitend met de
service role gelezen en nooit in een response opgenomen; `get_connections` geeft alleen
`has_token`.

**Rationale**: FR-015 en constitution III. De bestaande `flow_configs`-aanpak (kolom-SELECT
intrekken) werkte, maar een aparte tabel zonder policies is eenvoudiger en dicht ook
`has_token`-lekken via PostgREST af.

**Migration detail**: het token wordt met SQL uit een `rag_chat`-rij met niet-leeg token
gekopieerd, zodat het nooit in het migratiebestand, de chat of de logs staat.

## 9. URL-validatie

**Decision**: `isAllowedWebhookUrl` wordt één-op-één overgenomen in `platform-admin`
(https, geen localhost/`.localhost`/`.local`/`.internal`, geen letterlijk IPv4/IPv6).
Productie-URL's (per assistent én documentverwerking) mogen geen `/webhook-test/` bevatten;
test-URL's wel. Lege waarde = `NULL` (koppeling ontbreekt).

**Rationale**: gelijk gedrag met `flow-config`, `rag-chat` en `document-webhook`, zonder
cross-function-imports (die bestaan in dit project niet). De UI valideert niet zelfstandig;
de server is de enige poort (FR-016/FR-017).

**Alternatives considered**: gedeelde module in `supabase/functions/_shared/` → nieuwe
structuur en deploy-risico; niet nodig voor één functie.

## 10. `test_connection`

**Decision**: exact het testpad van `flow-config` overnemen: POST met het testpayload, 10 s
time-out, statusmeldingen per HTTP-status, maar met de **opgeslagen** headernaam en het
opgeslagen token. De actie wijzigt niets.

**Rationale**: FR-014 en de bestaande gebruikerservaring. Omdat er één centraal token is,
hoeft de gebruiker bij het testen geen token meer in te voeren.

**Alternatives considered**: alleen een HEAD-request → n8n-webhooks accepteren dat niet en de
bestaande meldingen (401/403/404/429) zijn dan niet te reproduceren.

## 11. Schakelaar zonder nieuwe dependency

**Decision**: `src/components/ui/switch.tsx` is een native `<button role="switch"
aria-checked>` met een zichtbare focusring en verplichte `aria-label`/`aria-labelledby`.

**Rationale**: een native button is met Tab bereikbaar en activeert met Enter én Spatie zonder
eigen keydown-handler; dat is precies FR-006 en constitution IV. Geen nieuwe Radix-dependency.

**Alternatives considered**: `@radix-ui/react-switch` toevoegen → in strijd met "geen nieuwe
npm-dependencies".

## 12. Volgorde van uitrol en het verwijderen van `flow-config`

**Decision**: migratie → `platform-admin`, `rag-chat`, `document-webhook`, `create-tenant`
deployen → frontend releasen → daarna `flow-config` handmatig verwijderen. `flow-config.spec.ts`
wordt in deze feature verwijderd; de US3-assertions in `admin-only-management.spec.ts` worden
bijgewerkt.

**Rationale**: de oude frontend gebruikt `flow-config` tot de nieuwe frontend live staat; pas
daarna kan de functie weg. De bestaande tests beschrijven gedrag dat deze feature bewust
verandert (inactieve assistenten alleen voor de platformbeheerder, geen webhookveld meer), dus
ze moeten mee — anders wordt de regressiesuite onterecht rood.

**Alternatives considered**: functie meteen verwijderen → breekt de huidige Instellingen-pagina
tijdens de uitrol. Tests laten falen → in strijd met de Definition of Done in AGENTS.md.

---

## Aanvullende verificatiepunten

- **Platformbeheerder heeft een profielrij nodig**: `p_actor` verwijst naar `profiles(id)`.
  De beheerder logt in op de app, dus er is een profiel; dit wordt vóór de migratie
  gecontroleerd op het opgegeven e-mailadres.
- **Kennisbronnen koppelen door de platformbeheerder** loopt via `assistant_knowledge_bases`
  met RLS `is_org_admin()`. Als het platformbeheerdersaccount in de eigen organisatie
  `role = 'member'` heeft, wordt dat geblokkeerd. Voorwaarde: `role = 'admin'` in de eigen
  organisatie (gedocumenteerd in quickstart; geen server-side omweg, om scope klein te houden).
- **Gerard_Tekelenburg had lege tokens**. Na de migratie gebruikt die organisatie het centrale
  token; documentverwerking en chat gaan daar naar verwachting voor het eerst correct
  authenticeren. Dit is een bewuste, in quickstart gedocumenteerde gedragswijziging.
