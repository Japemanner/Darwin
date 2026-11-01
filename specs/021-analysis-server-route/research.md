# Research: 021 — Risico-analyse via de serverroute

**Date**: 2026-10-31 | **Feature**: [spec.md](spec.md) | **Branch**: `021-analysis-server-route`

Alle onbekenden zijn onderzocht in de codebase, de 008-contracten, de 019-catalogus,
de Supabase-documentatie (Context7 + de officiële limits-pagina) en de constitution.
Geen onopgeloste NEEDS CLARIFICATION. Twee punten zijn vooraf met de opdrachtgever
afgestemd en als beslissing vastgelegd (zie #10 en #13).

## 1. Maximale requestgrootte van Supabase Edge Functions — check vóór ontwerp

**Decision**: doorgaan. Er is geen gedocumenteerde maximale request-bodygrootte voor
Edge Functions. De gedocumenteerde limieten zijn 256 MB geheugen, 2 s CPU per request
en een wall-clock/idle-timeout van 150 s (Free) of 400 s (betaald). Een upload van
25 MB plus multipart-overhead past daar ruim binnen, ook na base64-codering naar n8n
(± 33 MB). De echte bovengrens in deze keten is n8n: `N8N_PAYLOAD_SIZE_MAX` staat
standaard op 16 MiB en moet handmatig omhoog (release-stap 1).

**Rationale**: Context7 leverde de runtime-limieten en de platform-limieten
(maximale functiegrootte, logs, secrets), maar geen request-size-limiet; de officiële
pagina `supabase.com/docs/guides/functions/limits` bevestigt dat beeld. De controle
zoals gevraagd ("is die kleiner dan 25 MB plus overhead?") levert dus "niet kleiner"
op. Geheugen is de relevante grens: 25 MB raw + ±33 MB base64 + JSON-kopie blijft
ruim onder 256 MB. CPU (2 s) is voldoende voor één base64- en JSON-pas, maar wordt
als risico bewaakt in de implementatie (per bestand coderen, geen extra kopieën).

**Alternatives considered**:
- Bestanden eerst naar Storage uploaden en alleen paden naar n8n sturen — afgewezen:
  de opdracht eist expliciet dat bestanden niet in Storage worden bewaard, en n8n
  verwacht `data` als base64 in de payload.
- De upload opknippen in meerdere requests — afgewezen: buiten scope en n8n verwacht
  één payload.
- Stoppen en melden — niet nodig: geen gedocumenteerde limiet kleiner dan 25 MB.

**Bewijs**: Context7 `/websites/supabase` → "Edge Functions > Limits" (256 MB memory,
2 s CPU, 150/400 s wall clock); officiële limits-pagina bevat geen request-size-regel.
De n8n-limiet is de bekende `N8N_PAYLOAD_SIZE_MAX` (default 16 MiB), door de
opdrachtgever al als handmatige stap genoemd.

## 2. Serverroute in plaats van een browserclient naar n8n

**Decision**: de browser praat alleen nog met Supabase: `analysis-run-submit` voor het
starten (multipart met echte bestanden), `analysis_runs` via PostgREST voor status en
lijst (RLS), en de Storage API voor een 60 seconden geldige download-URL. De browser
kent geen n8n-URL, geen webhookgeheim en geen tenantkeuze meer.

**Rationale**: dit is de kern van de feature en van constitution III. De bestaande
`analysis-client.ts` bouwt de n8n-payload in de browser en kent `VITE_ANALYSIS_API_URL`;
na deze feature is de server de enige die de catalogus-URL en het centrale secret leest.
Statuslezen via RLS is al zo gecontracteerd in 008 (`run-status.md`) en vereist geen
extra functie; het vermindert juist het aantal serverpaden.

**Alternatives considered**:
- Ook status/lijst via een Edge Function — afgewezen: extra functie, extra CORS,
  dezelfde RLS-uitkomst; 008 voorziet expliciet in directe tabelselects.
- Een algemene `analysis-api`-functie met een actieparameter — afgewezen: verbergt
  twee verschillende trust-grenzen (JWT vs. HMAC) in één functie.

## 3. n8n-payload: JSON met base64-bestanden (prompt gaat vóór 008)

**Decision**: `analysis-run-submit` stuurt JSON naar de productie-URL met precies:
`run_id`, `callback_url`, `verzekeringsvraagstuk`, `kennisbronnen`, `klantsituatie`,
`bestanden: [{ naam, type, data }]` (data base64), `urls`, `klant_ref`, `adviseur`
(platte string met de volledige naam). Header: de centrale `auth_header` met het
centrale token. n8n antwoordt 202; daarna gaat de run naar `running`.

**Rationale**: de opdracht beschrijft exact wat de bestaande n8n-flow leest
(`String(body.adviseur)`, base64-bestanden) en wijkt daarmee bewust af van het
multipart-contract uit 008 (`n8n-submit.md`). De bestandsnaam, het MIME-type en de
inhoud zijn de enige bestandsgegevens die de server doorgeeft; er wordt niets bewaard.

**Alternatives considered**:
- Multipart naar n8n (008-contract) — afgewezen: de flow leest JSON met
  base64-velden; een n8n-wijziging valt buiten scope.
- Bestanden als losse binaire delen — afgewezen: de flow verwacht base64 in JSON.

## 4. Tabel `analysis_runs`: RLS-lezen, service-role schrijven

**Decision**: één nieuwe tabel volgens het 008-datamodel, met RLS aan en uitsluitend
een SELECT-policy `advisor_id = auth.uid() AND organization_id = get_user_org_id()`.
Geen INSERT-, UPDATE- of DELETE-policy. De Edge Functions schrijven met de service role.
Indexen op `(advisor_id, started_at desc)` en `(expires_at)`.

**Rationale**: `get_user_org_id()` bestaat al sinds migratie 001 (SECURITY DEFINER) en
wordt door vrijwel elke tabel gebruikt. Zonder schrijf-policies kan geen enkele client
een run aanmaken, afronden of wissen — ook niet buiten de UI om (FR-024). De
service role omzeilt RLS en is alleen in de functies beschikbaar.

**Alternatives considered**:
- Ook een INSERT-policy voor de client — afgewezen: de server moet de run aanmaken
  vóór het versturen en is de enige die de assistent/config mag controleren.
- Alleen `advisor_id = auth.uid()` zonder organisatie — afgewezen: de opdracht noemt
  beide voorwaarden; de org-check is defence in depth.

## 5. Dossieropslag: privé bucket met org/adviseur/run-pad

**Decision**: privébucket `analysis-dossiers`, pad
`{organization_id}/{advisor_id}/{run_id}.docx`, alleen een SELECT-policy op
`storage.objects` met `storage.foldername(name)[1] = get_user_org_id()::text` én
`[2] = auth.uid()::text`. Geen client-policies voor insert/update/delete. De download
gaat via `createSignedUrl(path, 60)` op het moment van klikken; de URL komt niet in
state, opslag of de adresbalk (tijdelijke `<a download>`-klik).

**Rationale**: het dossier is de enige klantinhoud die langer dan de sessie blijft
bestaan en moet dus zowel privé als per eigenaar bereikbaar zijn. De bucket-policies
spiegelen het pad; zelfs een geraden pad van een andere gebruiker levert geen signed
URL op. 60 seconden is lang genoeg voor de download en kort genoeg om niet deelbaar te
zijn. De bestaande `storage.ts` gebruikt hetzelfde patroon (private bucket + signed
URLs).

**Alternatives considered**:
- Publieke bucket — verboden (AGENTS.md/architectuurregel 6).
- Dossier in de database als bytea — afgewezen: de opdracht zegt "niet in de database",
  en grote blobs horen niet in Postgres.
- Signed URL bij het laden van de run — afgewezen: de opdracht verbiedt de URL in state.

## 6. Submit-functie: autorisatie, kennisbronnen en dubbele validatie

**Decision**: `analysis-run-submit` volgt het rag-chat-patroon (fail-closed CORS,
`auth.getUser`, profiel/organisatie uit `profiles`, service-role leesacties,
`logCode` zonder inhoud). Naast de gevraagde controles (verplichte velden,
groepsregel, bestandstypes/-limieten, assistent actief + type + eigen org, catalogus-URL,
centraal secret) doet de server twee extra controles:
1. `kennisbronnen` wordt gecontroleerd tegen `assistant_knowledge_bases` van deze
   assistent én tegen `knowledge_bases.organization_id`; de namen worden server-side
   opgehaald en de clientnaam wordt genegeerd.
2. `urls` moet https zijn.

**Rationale**: zonder (1) kan een gebruiker willekeurige kennisbronnamen in de
n8n-payload zetten, en dat is precies de tenantbeslissing die niet in de browser hoort
(FR-002/FR-024). De UI stuurt wel `{id,name}`, maar de server vertrouwt alleen de id en
resolveert de naam. (2) is de bestaande UI-regel die de server opnieuw moet afdwingen
(FR-008/FR-024). Beide zijn kleine queries binnen dezelfde functie, geen scope-uitbreiding.

**Alternatives considered**:
- Kennisbronnen volledig vertrouwen — afgewezen: cross-tenant risico en in strijd met
  "geen tenantbeslissing in de browser".
- Alle gekoppelde kennisbronnen altijd meesturen (selectie negeren) — afgewezen: de
  adviseur kan bronnen uitvinken (feature 014).

## 7. Callback: HMAC over run_id, constant-time, 401/409, race-veilig

**Decision**: `analysis-run-callback` deployt met `--no-verify-jwt` en controleert
`sig` uit de query met HMAC-SHA256 over `run_id`, hex, sleutel
`ANALYSIS_CALLBACK_SECRET`, met een constant-time vergelijking. Ongeldig → 401.
Onbekende of al afgeronde run → 409, zonder schrijven. Geldige error-JSON → `failed`.
Geldige multipart `status=ok` → `analyse` parsen en valideren; ongeldig → `failed` met
`INVALID_RESULT`; geldig → dossier uploaden, daarna de rij conditioneel bijwerken
(`where status in ('queued','running')`). Als de rij intussen is afgerond, wordt het
zojuist geüploade object weer verwijderd en volgt 409.

**Rationale**: de callback is publiek bereikbaar (geen JWT) en moet dus op iets anders
vertrouwen. De opdracht schrijft de HMAC over `run_id` voor. De conditionele update
voorkomt dat twee callbacks (of een late callback na een time-out) elkaar overschrijven
(FR-016). De upload-vóór-update-volgorde met opruimcompensatie voorkomt een rij die
naar een niet-bestaand object wijst.

**Bewuste beperking (gedocumenteerd)**: de handtekening authenticeert de URL, niet de
body. Wie de callback-URL onderschept kan vóór n8n een resultaat voor die ene run
posten. Dat is precies de door de opdrachtgever gekozen opzet (HMAC over `run_id`); een
body-handtekening of nonce zou een n8n-wijziging vragen en is buiten scope. De URL
bevat geen klantinhoud en verloopt feitelijk met de run (409 na afronding).

**Alternatives considered**:
- HMAC over de body — afgewezen: n8n moet die dan ook berekenen (buiten scope).
- JWT-verificatie op de callback — afgewezen: n8n heeft geen Supabase-JWT.
- Idempotente tweede callback toestaan (008) — afgewezen: de nieuwe opdracht eist 409
  voor een al afgeronde run.

## 8. Resultaatvalidatie in de functie met `npm:zod`

**Decision**: de callback valideert `analyse` met een zod-schema dat één-op-één de
regels van `AnalysisResultSchema` in `src/lib/analysis-schemas.ts` volgt
(`BronRefIdSchema ^[KRA][0-9]+$`, non-empty strings, `OptieSchema`, alle acht velden).
Import via `npm:zod` in de Edge Function; **geen** toevoeging aan `package.json`.
Ongeldig → run `failed`, `error_code = INVALID_RESULT`, Nederlandse melding.

**Rationale**: de frontend valideert het resultaat opnieuw bij weergave, maar een
ongeldig resultaat mag nooit als "geslaagd" in de database staan (constitution V). De
Edge Function is Deno; `npm:zod` is de bestaande Supabase-manier en raakt de
Vite-bundle niet. Het schema is bewust gedupliceerd: de functie kan niet uit `src/`
importeren, en 008 noemt het contract de single source of truth.

**Alternatives considered**:
- Geen servervalidatie, alleen de bestaande clientvalidatie — afgewezen: dan staat er
  een "geslaagde" run met onbruikbare inhoud, en de foutstatus komt pas bij weergave.
- Een gedeeld bestand buiten `src/` — afgewezen: introduceert een buildstap voor de
  Edge Function; de duplicatie is klein en expliciet in het contract vastgelegd.

## 9. Client: `functions.invoke` met FormData, RLS-reads, `dossier_path`

**Decision**: `submitAnalysisRun` bouwt een `FormData` met de echte `File`-objecten en
roept `supabase.functions.invoke('analysis-run-submit', { body: formData })` aan.
`fetchAnalysisRun` en `fetchRecentRuns` doen een PostgREST-select op `analysis_runs`
en mappen `result_json → result`, `dossier_path → dossier_path`; het bestaande
`dossier_docx_url` blijft optioneel in het schema maar wordt niet meer gevuld. Voeg
`NOT_CONFIGURED` toe aan `AnalysisErrorCode` met de vaste Nederlandse melding. De
advisor-velden vervallen uit `SubmitAnalysisInput` (de server leidt ze uit het JWT af);
`AnalysisNewPage` geeft alleen nog de invoer mee.

**Rationale**: `@supabase/supabase-js` zet bij een `FormData`-body bewust géén
`Content-Type` (zie `FunctionsClient.js`), zodat de browser de multipart-boundary zet;
JSON zou de bestanden niet meenemen. RLS is de enige toegangsgrens voor lezen; de
`advisor_id`-filter in de query blijft als leesbaarheid, niet als beveiliging. De
`dossier_path` is nodig voor de klik-download; een URL in de rij zou verlopen en in
state belanden.

**Alternatives considered**:
- Handmatige `fetch` naar de functie-URL — afgewezen: dan moet de client de URL en het
  JWT zelf beheren; `functions.invoke` doet dat al en is het bestaande patroon
  (`team-admin`, `platform-admin`, `rag-chat`).
- Een eigen status-endpoint — afgewezen: zie #2.

## 10. Opschonen: pg_cron + pg_net + `analysis-run-cleanup` (afgestemd)

**Decision**: pg_cron en pg_net worden aangezet. Een dagelijkse pg_cron-job leest de
functie-URL en een cleanup-secret uit Supabase Vault en roept `analysis-run-cleanup`
aan. Die functie verwijdert eerst de dossierobjecten via de Storage API
(`storage.from('analysis-dossiers').remove(paths)`, batches van 100) en daarna de
bijbehorende rijen; mislukt een objectverwijdering, dan blijft die rij staan voor de
volgende dag.

**Rationale**: Supabase waarschuwt expliciet dat `delete from storage.objects` de
fysieke bestanden achterlaat (orphaned objects). Dat zou US6/FR-020 en constitution III
schenden. Een SQL-job alleen is dus niet genoeg; de Storage API is de enige juiste
verwijderweg. De extra functie is met de opdrachtgever afgestemd (vraag 1) en is de
minimale aanvulling op de twee gevraagde functies.

**Alternatives considered**:
- Alleen rijen verwijderen — afgewezen: dossierbytes blijven staan (geen echte
  verwijdering).
- Opruimen buiten de feature — afgewezen door de opdrachtgever; pg_cron is beschikbaar.
- `storage.objects` toch via SQL verwijderen — afgewezen op grond van de officiële
  Supabase-waarschuwing.

## 11. `expires_at` vanaf het startmoment (prompt gaat vóór 008)

**Decision**: `expires_at = now() + interval '7 days'` bij het aanmaken van de rij.
Na het verstrijken verwijdert de cleanup de rij én het dossier volledig; een oud adres
geeft de bestaande "niet gevonden"-melding. De UI toont "beschikbaar tot" ongewijzigd
bij een geslaagde run.

**Rationale**: de opdracht schrijft deze berekening letterlijk voor. 008 zette de
termijn op `finished_at + 7 dagen` en liet metadata staan; de nieuwe spec (US6) eist
dat runs én dossiers verdwijnen. Een run die nooit afrondt, verdwijnt daardoor na
zeven dagen in plaats van voor altijd te blijven staan.

**Alternatives considered**:
- `finished_at + 7 dagen` — afgewezen: de prompt is expliciet; bovendien is er dan
  geen bovengrens voor een run die nooit een callback krijgt.
- Metadata laten staan — afgewezen: US6/FR-020 eisen volledige verwijdering.

## 12. Teststrategie zonder mock-server

**Decision**:
- Bestaande UI-specs (`analysis-form`, `analysis-run`, `analysis-jwt`,
  `analysis-notifications`) worden omgebouwd van de mock-server naar
  `page.route`-interceptie van de nieuwe Supabase-aanroepen
  (`/functions/v1/analysis-run-submit`, `/rest/v1/analysis_runs*`,
  `/storage/v1/object/sign/...`). De scenario's rich/error/slow worden fixtures in de
  spec zelf; de mock-server is niet meer nodig.
- Nieuw `analysis-server-route.spec.ts` dekt de drie gevraagde gevallen op UI-niveau:
  uitgezette assistent (assistentrespons met `is_active: false`), ontbrekende
  productie-URL (functieantwoord `NOT_CONFIGURED`) en andermans run (lege
  RLS-respons). De testbestanden skippen met reden zonder `E2E_EMAIL`/`E2E_PASSWORD`,
  net als de bestaande suite.
- De echte serverafdwinging (RLS, 401/409 op de callback, echte n8n-run) verifieert de
  opdrachtgever handmatig volgens quickstart; `scripts/rls-verify.mjs` blijft de
  bestaande route voor RLS-controles.

**Rationale**: de suite moet deterministic en zonder n8n kunnen draaien; de mock-server
verdwint als testvoorziening maar blijft als script op schijf (opdracht). Route-mocks
testen de UI-contracten; de server-integriteit is niet met een browser-mock te bewijzen
en hoort bij de handmatige acceptatie (de opdrachtgever test de echte n8n-run zelf).

**Alternatives considered**:
- De specs tegen de echte functies laten lopen — afgewezen: traag, afhankelijk van
  n8n en van gedeelde testdata; niet geschikt voor de standaard pre-commit/CI-run.
- De mock-server ombouwen naar de nieuwe endpoints — afgewezen: dan test je een
  server die niet bestaat, en de opdracht zegt dat hij niet meer gebruikt wordt.

## 13. ResultView: alleen de downloadmechaniek (afgestemd)

**Decision**: `ResultView` houdt inhoud, volgorde, labels en opmaak ongewijzigd, maar
krijgt `dossierPath` in plaats van `dossierDocxUrl`. De downloadknop wordt een
`<button>` met dezelfde classes/tekst die bij de klik `createSignedUrl(..., 60)`
aanroept en een tijdelijke `<a download>`-klik uitvoert. Bij een fout volgt de
bestaande Nederlandse toast.

**Rationale**: de opdracht verbiedt een signed URL in state/URL; de bestaande
`<a href>` kan dus niet blijven. Dit is de minimale wijziging en is met de
opdrachtgever afgestemd (vraag 2). Er verandert niets aan de resultaatweergave als
producteigenschap.

**Alternatives considered**:
- URL bij het laden maken en als prop doorgeven — afgewezen: in strijd met de
  expliciete eis en de URL zou in de React-state staan.
- Download buiten ResultView plaatsen — afgewezen: zichtbare UI-wijziging.

## 14. `VITE_ANALYSIS_API_URL` en de mock-server

**Decision**: verwijder de variabele uit `src/lib/analysis-client.ts` en
`.env.example`; `src/vite-env.d.ts` declareert hem nu niet (geen declaratie om te
verwijderen — wel controleren). `scripts/mock-analysis-server.mjs` blijft staan maar
wordt niet meer gebruikt; de `webServer`-entry in `playwright.config.ts` verdwijnt.
`.env.local` (gitignored) wordt niet aangepast.

**Rationale**: de opdracht eist dat de variabele nergens meer in `src/` voorkomt. De
mock-server weghalen is niet gevraagd; hem laten staan zonder gebruiker voorkomt
verwarring in de toekomst niet, maar de opdracht is expliciet ("laat staan"). De
Playwright-entry weghalen voorkomt dat elke testrun een ongebruikte server start.

**Alternatives considered**:
- De mock-server ook verwijderen — afgewezen: expliciet buiten de opdracht gelaten.
- De webServer-entry laten staan — afgewezen: start een server die geen enkele test
  meer aanspreekt.

## 15. Fouttaxonomie en Nederlandse meldingen

**Decision**: de client houdt de bestaande `AnalysisErrorCode`-waarden en voegt
`NOT_CONFIGURED` toe. Servercodes worden als volgt gemapt:
`NOT_CONFIGURED → NOT_CONFIGURED` (vaste melding), `UNAUTHORIZED → UNAUTHORIZED`,
`FORBIDDEN → BACKEND_ERROR` met de Nederlandse servermelding, `413 → FILE_TOO_LARGE`,
`422 → GROUP_VALIDATION`, `UPSTREAM_*`/5xx → `BACKEND_ERROR`, time-out →
`BACKEND_TIMEOUT`, netwerk → `CONNECTION_ERROR`. De callback zet bij een fout
`error_code` + `error_message` op de rij; de runpagina toont die ongewijzigd met
"Opnieuw".

**Rationale**: de UI kent al deze codes en statussen; alleen de ontbrekende koppeling
hoeft erbij. De exacte NOT_CONFIGURED-melding staat in de spec en in `rag-chat`/
`document-webhook`, dus de tekst blijft consistent in de app.

**Alternatives considered**:
- Een nieuwe code per serverfout — afgewezen: vergroot de UI-matrix zonder
  gebruikerswaarde; de servermelding is al Nederlands en specifiek.

## 16. Database-types

**Decision**: na het toepassen van de migratie wordt `src/types/database.types.ts`
opnieuw gegenereerd (Supabase MCP `generate_typescript_types`) en meegecommit. Tot die
tijd kan de frontend niet compileren op `analysis_runs`; de implementatievolgorde zet
de migratie + types vóór de clientwijzigingen.

**Rationale**: de Supabase-client is getypeerd (`createClient<Database>`); een
ontbrekende tabel in de types geeft een compileerfout. Handmatig bijwerken kan, maar
genereren voorkomt drift met de echte kolommen.

**Alternatives considered**:
- Handmatig de types toevoegen — afgewezen: foutgevoelig en de CLI/MCP kan het
  autoritatief doen.
