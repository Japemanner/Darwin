# Feature Specification: Beveiligde n8n-koppeling via de server

**Feature Branch**: `009-secure-n8n-proxy`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Beveiligde koppeling tussen Darwin en n8n via de server. De browser roept de n8n-webhooks rechtstreeks aan (src/lib/webhook.ts: callRagWebhook, callDocumentWebhook, testWebhook). Het webhook-token staat versleuteld in flow_configs, maar de sleutel (VITE_ENCRYPTION_KEY) zit in de publieke JS-bundle. Elke ingelogde gebruiker kan het token dus lezen. De browser bepaalt zelf tenantId (organisatienaam), kennisbronnen en system prompt in de payload, en n8n vertrouwt die waarden. Een gebruiker van organisatie A kan daardoor documenten van organisatie B bevragen. Een assistent met meerdere kennisbronnen stuurt de namen samengevoegd als één string (\"Schade, Acceptatie\"); de zoekstap vindt dan niets. De analyse-client (src/lib/analysis-client.ts) stuurt geen JWT mee, terwijl de contracten in specs/008-risico-analyse-ui/contracts/ dat eisen. Doel: geen geheim en geen tenant-beslissing meer in de browser."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Vraag stellen aan een chat-assistent (Priority: P1)

Als adviseur stel ik een vraag aan een chat-assistent. De server controleert wie ik
ben, bepaalt mijn organisatie en de kennisbronnen van de assistent en haalt het
antwoord op bij n8n. Ik merk geen verschil, behalve duidelijkere foutmeldingen.

**Why this priority**: Dit is de kernflow van het product en tegelijk de grootste
beveiligingslekken: het webhook-token is via de publieke bundel uitleesbaar en de
browser bepaalt zelf de tenant-gegevens die n8n vertrouwt. Zolang deze story niet
af is, blijft elke organisatie blootgesteld aan cross-tenant bevraging.

**Independent Test**: Volledig te testen door met een geconfigureerde
chat-assistent een vraag te stellen: het antwoord komt terug (zelfde beleving voor
de adviseur), het netwerkverkeer van de browser bevat geen enkel verzoek aan het
n8n-domein, en een gemanipuleerde aanroep naar een assistent of gesprek van een
andere organisatie wordt met 403 geweigerd.

**Acceptance Scenarios**:

1. **Given** een ingelogde adviseur van organisatie A met een geconfigureerde
   chat-assistent, **When** de adviseur een vraag stelt, **Then** ontvangt de
   adviseur het antwoord (met bronnen, zoals voorheen) en bevat het
   netwerkverkeer van de browser geen enkel verzoek aan het n8n-domein.
2. **Given** een gebruiker zonder geldige sessie, **When** deze de
   chat-functionaliteit aanroept, **Then** geeft de server 401 en toont de UI een
   Nederlandse foutmelding met foutcode.
3. **Given** een gebruiker van organisatie A, **When** deze een aanroep doet die
   refereert aan een assistent, gesprek of document van organisatie B, **Then**
   geeft de server 403 en toont de UI een Nederlandse foutmelding met foutcode.
4. **Given** een assistent met twee kennisbronnen ("Schade" en "Acceptatie"),
   **When** de adviseur een vraag stelt, **Then** ontvangt n8n beide namen als
   afzonderlijke items in een lijst en vindt de zoekstap resultaten.
5. **Given** een assistent of organisatie zonder webhook-configuratie, **When**
   de adviseur een vraag stelt, **Then** toont de UI een Nederlandse melding met
   foutcode dat de verbinding niet geconfigureerd is.

---

### User Story 2 - Document upload of verwijdering melden (Priority: P1)

Als beheerder upload of verwijder ik een document. De server meldt dit aan n8n,
met een downloadlink die de server zelf maakt.

**Why this priority**: Documenten voeden de kennisbank; zonder correcte en veilige
melding aan n8n raakt de kennisbank verouderd. Deze flow verwerkt nu ook
gevoelige bestanden vanuit de browser met het token binnen handbereik.

**Independent Test**: Volledig te testen door als beheerder een document te
uploaden en te verwijderen: n8n ontvangt de melding met een server-gegenereerde
downloadlink, de browser doet zelf geen verzoek aan n8n, en bij een storing bij
n8n verschijnt een Nederlandse foutmelding met foutcode (geen stille fout,
constitution V).

**Acceptance Scenarios**:

1. **Given** een ingelogde beheerder met een geconfigureerde
   documentverwerkingsflow, **When** deze een document uploadt, **Then** meldt
   de server dit aan n8n met de actie, de kennisbron, de documentgegevens en een
   downloadlink die de server zelf genereert; het netwerkverkeer van de browser
   bevat geen verzoek aan het n8n-domein.
2. **Given** een ingelogde beheerder, **When** deze een document verwijdert,
   **Then** meldt de server de verwijderactie aan n8n met dezelfde waarborgen.
3. **Given** n8n is onbereikbaar of geeft een fout tijdens de melding, **When**
   de beheerder uploadt of verwijdert, **Then** toont de UI een Nederlandse
   foutmelding met foutcode; het document zelf blijft gewoon opgeslagen.

---

### User Story 3 - Webhook-configuratie beheren in Instellingen (Priority: P1)

Als beheerder stel ik in Instellingen de webhook-URL, de headernaam en het token
in en test ik de verbinding. Het token kan ik daarna niet meer uitlezen, alleen
vervangen.

**Why this priority**: Het token is het geheim dat toegang geeft tot de
n8n-workflows van de organisatie. Zolang het vanuit de browser uitleesbaar is,
biedt versleuteling geen bescherming. Schrijf-only opslag sluit dit lek
definitief.

**Independent Test**: Volledig te testen door als beheerder een configuratie in
te stellen, de verbinding te testen en de instellingen te heropenen: het token
wordt nergens getoond of teruggegeven, en via de data-API is het token niet
op te vragen voor de rollen anon en authenticated.

**Acceptance Scenarios**:

1. **Given** een ingelogde beheerder, **When** deze de Instellingen opent,
   **Then** kan deze de webhook-URL, de headernaam en het token instellen en
   opslaan.
2. **Given** een opgeslagen token, **When** de beheerder de Instellingen
   opnieuw opent, **Then** wordt de tokenwaarde nergens getoond of aan de client
   teruggestuurd; alleen een nieuw token invoeren vervangt de oude.
3. **Given** een opgeslagen token, **When** de data-API wordt bevraagd met de
   rollen anon of authenticated, **Then** is het token niet uitleesbaar.
4. **Given** een opgeslagen configuratie, **When** de beheerder op "Verbinding
   testen" klikt, **Then** wordt de test namens de beheerder via de server
   uitgevoerd en toont de UI een Nederlands resultaat, bij mislukking met
   foutcode.
5. **Given** een ingevoerde n8n test-URL (/webhook-test/), **When** de beheerder
   de verbinding test, **Then** weigert de test met de bestaande Nederlandse
   uitleg dat een productie-URL vereist is.

---

### User Story 4 - Risico-analyse verifieert de sessie (Priority: P2)

De risico-analyse-client stuurt bij elke aanroep het sessie-JWT mee, conform de
contracten van feature 008.

**Why this priority**: De risico-analyse-flow werkt functioneel, maar de
aanroepen voldoen nog niet aan het eigen contract (sessie-verificatie). Dit
sluit het gat in de beveiligingsconsistente werking van de recente analyse-feature.

**Independent Test**: Volledig te testen door een analyse te starten en de
run-status op te vragen: elke aanroep bevat het sessie-JWT, en met een verlopen
sessie faalt elke aanroep met 401 en een Nederlandse foutmelding.

**Acceptance Scenarios**:

1. **Given** een ingelogde adviseur, **When** deze een analyse indient of de
   status opvraagt, **Then** bevat elke aanroep het sessie-JWT en valideert de
   server deze.
2. **Given** een verlopen of afwezige sessie, **When** de analyse-client een
   aanroep doet, **Then** faalt de aanroep met 401 en toont de UI een
   Nederlandse foutmelding met foutcode.

---

### Edge Cases

- Wat gebeurt er wanneer de sessie verloopt tussen het laden van de pagina en
  het verzenden van de vraag? → De server weigert met 401; de UI toont een
  Nederlandse melding met foutcode, waarna de gebruiker opnieuw kan inloggen en
  de vraag opnieuw kan stellen.
- Wat als n8n een 200 teruggeeft met een onverwacht of leeg antwoordformaat? →
  De server faalt getypeerd met een Nederlandse melding en foutcode; nooit een
  stil, leeg antwoord (constitution V).
- Wat als het token wordt vervangen terwijl een chatverzoek loopt? → Het lopende
  verzoek wordt met de configuratie van dat moment afgemaakt; elk volgend
  verzoek gebruikt de nieuwe configuratie.
- Wat als de assistent geen kennisbronnen heeft? → Het verzoek slaagt met een
  lege lijst aan kennisbronnen (zelfde gedrag als nu).
- Wat als de gespreksgeschiedenis zeer lang is? → De server stuurt maximaal de
  laatste 20 berichten mee (zelfde limiet als nu).
- Wat als n8n een authenticatiefout (401/403) geeft? → De UI toont een
  Nederlandse melding dat het token en de headernaam niet overeenkomen met de
  n8n-webhookinstellingen, met foutcode.
- Wat bij time-out (chat 60 seconden, documentmelding 10 seconden,
  verbindingstest 10 seconden)? → De UI toont een Nederlandse time-outmelding
  met foutcode.
- Wat als de server zelf onbereikbaar is of een interne fout geeft? → De UI
  toont een Nederlandse, generieke foutmelding met foutcode.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Het systeem MOET bij elke server-aanroep eerst de identiteit van
  de gebruiker verifiëren; zonder geldige sessie wordt de aanroep met 401
  geweigerd.
- **FR-002**: De server MOET de organisatie van de gebruiker en de gekoppelde
  kennisbronnen van de assistent vaststellen op basis van servergegevens en de
  geverifieerde sessie; de client kan deze waarden niet bepalen of overschrijven.
- **FR-003**: Een aanroep die refereert aan een assistent, gesprek of document
  van een andere organisatie MOET met 403 worden geweigerd.
- **FR-004**: De server MOET de namen van kennisbronnen als lijst naar n8n
  sturen (elke naam als afzonderlijk item, niet als samengevoegde string).
- **FR-005**: Alle communicatie met n8n MOET vanaf de server plaatsvinden; uit
  de browser mag geen verzoek aan het n8n-domein gaan.
- **FR-006**: De clienttoepassing MAG geen encryptiesleutel, geen
  encryptie-/decryptielogica en geen webhook-token bevatten.
- **FR-007**: Het webhook-token MOET zodanig zijn opgeslagen dat het voor de
  rollen anon en authenticated niet uitleesbaar is via de data-API; het token
  is alleen te vervangen, nooit uit te lezen.
- **FR-008**: Bij document-upload en -verwijdering MOET de server n8n informeren
  met een downloadlink die de server zelf genereert.
- **FR-009**: Elke foutsituatie — geen configuratie, n8n onbereikbaar,
  authenticatiefout bij n8n, time-out, n8n-fout, ongeldig antwoordformaat — MOET
  in de UI een Nederlandse foutmelding met foutcode tonen (constitution V),
  weergegeven op een toegankelijke wijze conform WCAG 2.1 AA (constitution IV).
- **FR-010**: Serverlogboeken (Edge Functions) MOGEN geen berichtinhoud
  bevatten (constitution III).
- **FR-011**: De risico-analyse-client MOET bij elke aanroep het sessie-JWT
  meesturen.
- **FR-012**: De verbindingstest in Instellingen MOET namens de beheerder via de
  server worden uitgevoerd en een Nederlands resultaat tonen, bij mislukking met
  foutcode.

### Key Entities

- **Webhook-configuratie**: per organisatie per flowtype (chat,
  documentverwerking): webhook-URL, headernaam, token. Het token is alleen te
  vervangen en voor de client nooit uit te lezen.
- **Organisatie**: de tenant waartoe gebruikers, assistenten, kennisbronnen,
  gesprekken en documenten behoren; wordt server-side vastgesteld.
- **Assistent**: met gekoppelde kennisbronnen; de server lost deze koppeling op
  en stuurt de namen als lijst naar n8n.
- **Chatverzoek**: assistent, gesprek en bericht van de gebruiker; de server
  haalt de gespreksgeschiedenis op en stelt het payload naar n8n samen.
- **Documentmelding**: actie (toevoegen/wijzigen/verwijderen), kennisbron,
  documentgegevens en een server-gegenereerde downloadlink.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: De productie-bundel van de webtoepassing bevat geen encryptiesleutel
  (de huidige VITE_ENCRYPTION_KEY), geen encryptie-/decryptiecode en geen
  webhook-token — verifieerbaar met een geautomatiseerde scan van de gebouwde
  bundel.
- **SC-002**: Tijdens de flows chat, documentverwerking en verbindingstest
  bevat het netwerkverkeer van de browser geen enkel verzoek aan het
  n8n-domein — verifieerbaar via netwerkinspectie in de browser.
- **SC-003**: De volledige foutmatrix — geen configuratie, n8n onbereikbaar,
  authenticatiefout bij n8n, time-out, n8n-fout, ongeldig antwoord, geen sessie
  (401), cross-tenant toegang (403) — is gedekt door geautomatiseerde tests en
  toont in elk geval een Nederlandse melding met foutcode.
- **SC-004**: Het token is via de data-API van het platform niet uitleesbaar
  voor de rollen anon en authenticated — verifieerbaar met de REST-controle
  uit quickstart.md, uit te voeren na de rollout (de controle is als script
  te automatiseren).
- **SC-005**: Een assistent met twee kennisbronnen stuurt bij een vraag beide
  namen als afzonderlijke lijst naar n8n — verifieerbaar met de
  payload-controle in quickstart.md. Dat de zoekstap daadwerkelijk uit beide
  bronnen vindt, volgt zodra de n8n-zoekstap op de lijst is overgeschakeld
  (verbeterplan N1, aan de n8n-kant, buiten deze scope).
- **SC-006**: De adviseur merkt geen functioneel verschil: chatvragen
  ontvangen binnen 60 seconden antwoord (verruiming van de huidige limiet
  van 30 seconden, conform de technische route in
  docs/verbeterplan-opencode.md, groep A).

## Assumptions

**Buiten scope** (vastgelegd in de opdracht):

- Wijzigingen aan de n8n-workflows.
- Berichten server-side opslaan.
- Herontwerp van de chat-UI (de beleving van de adviseur blijft gelijk).

**Aannames en gemaakte keuzes**:

- Bestaande n8n-workflows blijven ongewijzigd. De enige contractwijziging
  richting n8n is het kennisbronveld: namen als lijst in plaats van één
  samengevoegde string. Het afstemmen van de n8n-zoekstap hierop is een taak
  van de n8n-beheerder, buiten dit project.
- Bestaande opgeslagen tokens worden gewist en vervangen: de oude waarden
  zijn als gelekt te beschouwen (de versleutelingssleutel zat in de publieke
  bundel). Beheerders voeren per organisatie een nieuw token in; de
  releasevolgorde en handmatige stappen staan in het plan (technische route:
  docs/verbeterplan-opencode.md, groep A).
- De antwoordstructuur van n8n (antwoord + bronnen) blijft ongewijzigd; de
  server valideert deze structuur getypeerd (constitution V).
- De downloadlink is een kort geldige, door de server ondertekende URL naar het
  opgeslagen document.
- Time-outgrenzen: chat 60 seconden (verruimd t.o.v. de huidige 30 seconden,
  conform de technische route), documentmelding 10 seconden, verbindingstest
  10 seconden.
- De server stuurt maximaal de laatste 20 gespreksberichten mee (gelijk aan het
  huidige gedrag).
- De token-loze per-assistent webhook-URL (`n8n_webhook_url`) blijft bestaan
  en is rechtstreeks bij n8n aanroepbaar zonder token. Dit is een geaccepteerd
  rest-risico (behoud van huidig gedrag); authenticatie per assistent valt
  buiten deze feature.
- Alleen beheerders van een organisatie kunnen de webhook-configuratie
  instellen, vervangen en testen (bestaande rolverdeling blijft gelden).