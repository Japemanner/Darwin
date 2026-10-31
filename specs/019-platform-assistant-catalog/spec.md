# Feature Specification: Platformbeheer van assistentcatalogus, organisatieschakelaars en n8n-koppelingen

**Feature Branch**: `019-platform-assistant-catalog`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Platformbeheer: assistentcatalogus, schakelaar per organisatie en koppelingen. Huidige situatie: assistenten bestaan alleen per organisatie; beheerders van een organisatie maken ze aan, bewerken en verwijderen ze op de pagina Assistenten, inclusief een eigen n8n-webhook-URL en de schakelaar Actief. Instellingen toont aan elke beheerder van een organisatie de n8n-koppelingen van de eigen organisatie en een formulier Nieuwe organisatie; de server controleert alleen role = 'admin', dus elke kantoorbeheerder kan nieuwe organisaties aanmaken. rag-chat gebruikt voor type chat de chatkoppeling van de organisatie en anders de webhook-URL van de assistent zelf (zonder token). document-webhook gebruikt de documentkoppeling van de organisatie. In n8n controleren alle webhooks dezelfde headerwaarde. Er is geen rol boven de beheerder van een organisatie. Doel: één platformbeheerder bepaalt centraal welke assistenten er zijn, welke organisatie welke assistent gebruikt en hoe Darwin met n8n verbindt."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assistent per organisatie aan- en uitzetten (Priority: P1)

Als platformbeheerder open ik Instellingen en kies ik een organisatie. In het subscherm
zie ik alle assistenten uit de catalogus als één horizontale rij tegels: icoon, naam en
typelabel. Elke tegel heeft een schakelaar waarmee ik die assistent voor die organisatie
aan- of uitzet. De schakelaar is met het toetsenbord te bedienen en heeft een
toegankelijke naam waarin zowel de assistent als de organisatie staat. Mislukt het
opslaan, dan springt de schakelaar terug naar de vorige stand en verschijnt een
Nederlandse foutmelding.

**Why this priority**: Dit is de kern van het nieuwe beheer: de platformbeheerder bepaalt
per organisatie welke assistenten beschikbaar zijn, zonder de assistent zelf per
organisatie te hoeven aanmaken. Zonder deze schakelaar kan geen enkele organisatie een
assistent krijgen of verliezen.

**Independent Test**: Volledig te testen met een platformbeheerdersaccount en twee
organisaties: kies een organisatie, zet een assistent aan en weer uit, herlaad de pagina
en controleer dat de stand bewaard blijft; doorloop de rij uitsluitend met het toetsenbord
en controleer de toegankelijke naam; simuleer een mislukte opslag en controleer dat de
schakelaar terugspringt met een Nederlandse melding.

**Acceptance Scenarios**:

1. **Given** een platformbeheerder en een catalogus met vijf assistenten, **When** deze
   in Instellingen een organisatie kiest, **Then** ziet deze één horizontale rij van vijf
   tegels met per tegel icoon, naam, typelabel en een schakelaar die de huidige stand
   voor die organisatie toont.
2. **Given** een assistent die voor de gekozen organisatie uit staat, **When** de
   platformbeheerder de schakelaar aanzet en de opslag slaagt, **Then** staat de
   assistent aan en is dat na herladen van de pagina nog steeds zo.
3. **Given** een assistent die aan staat, **When** het opslaan mislukt, **Then** springt
   de schakelaar terug naar "aan" en verschijnt een Nederlandse foutmelding.
4. **Given** een platformbeheerder die uitsluitend het toetsenbord gebruikt, **When**
   deze door de rij navigeert en een schakelaar bedient, **Then** is elke schakelaar
   bereikbaar en bedienbaar, en bevat de toegankelijke naam de assistentnaam en de
   organisatienaam.
5. **Given** een catalogus die later wordt uitgebreid, **When** de platformbeheerder het
   subscherm van een organisatie opnieuw opent, **Then** verschijnt de nieuwe assistent
   ook als tegel, met de stand die voor die organisatie geldt.

---

### User Story 2 - Koppelingen centraal instellen (Priority: P1)

Als platformbeheerder open ik met één tandwielknop het venster Koppelingen. Daar stel ik
in: de headernaam en het secret (één waarde voor alle n8n-webhooks), de productie-URL
voor documentverwerking, en per assistent een test-URL en een productie-URL. Een
productie-URL kan ik testen. Het secret is na opslaan nergens meer uit te lezen; laat ik
het veld leeg, dan blijft het bestaande secret behouden.

**Why this priority**: Zonder centrale koppelingen kan de platformbeheerder de
assistentcatalogus niet laten werken. Eén secret voor alle webhooks sluit aan op hoe n8n
de webhooks controleert en maakt een token per organisatie overbodig.

**Independent Test**: Volledig te testen met een platformbeheerdersaccount: open
Koppelingen, sla een headernaam, secret, documentverwerkings-URL en per assistent een
test- en productie-URL op, heropen het venster en controleer dat het secret niet
leesbaar is en leeg opslaan het secret behoudt; test een geldige en een ongeldige
productie-URL.

**Acceptance Scenarios**:

1. **Given** een gevulde catalogus, **When** de platformbeheerder het venster
   Koppelingen opent, **Then** ziet deze één veld voor de headernaam, één veld voor het
   secret (met de aanduiding dat er al een secret is ingesteld), één productie-URL voor
   documentverwerking en per assistent een test-URL en een productie-URL.
2. **Given** een opgeslagen secret, **When** de platformbeheerder het venster opnieuw
   opent of de gegevens op een andere manier opvraagt, **Then** is het secret nergens
   leesbaar, ook niet voor de platformbeheerder zelf.
3. **Given** een opgeslagen secret, **When** de platformbeheerder het secretveld leeg
   laat en opslaat, **Then** blijft het bestaande secret behouden.
4. **Given** een productie-URL of documentverwerkings-URL die niet aan de regels voldoet,
   **When** de platformbeheerder opslaat, **Then** weigert het systeem de opslag met een
   Nederlandse melding die aangeeft wat er mis is.
5. **Given** een test-URL die `/webhook-test/` bevat, **When** de platformbeheerder
   opslaat, **Then** wordt de test-URL geaccepteerd en alleen opgeslagen.
6. **Given** een geldige productie-URL, **When** de platformbeheerder op "testen" klikt,
   **Then** verschijnt een Nederlandse uitkomst (geslaagd of mislukt) en wijzigen de
   opgeslagen instellingen niet.

---

### User Story 3 - Assistentencatalogus beheren (Priority: P1)

Als platformbeheerder maak ik op de pagina Assistenten een nieuwe assistent aan of
bewerk ik een bestaande: icoon, naam, type, beschrijving en voorbeeldvragen. Een nieuwe
assistent komt in de catalogus en staat direct aan bij alle organisaties. Een wijziging
geldt voor alle organisaties.

**Why this priority**: De catalogus is de enige bron van assistenten. Zonder centraal
beheer ontstaan weer per-organisatievarianten en verliest de platformbeheerder de
controle die deze feature beoogt.

**Independent Test**: Volledig te testen met een platformbeheerdersaccount en minstens
twee organisaties: maak een assistent aan en controleer dat deze bij beide organisaties
aan staat; wijzig de naam en controleer dat beide organisaties de nieuwe naam zien.

**Acceptance Scenarios**:

1. **Given** een platformbeheerder op de pagina Assistenten, **When** deze een assistent
   aanmaakt met icoon, naam, type, beschrijving en voorbeeldvragen, **Then** staat de
   assistent in de catalogus en is deze bij alle bestaande organisaties aangezet.
2. **Given** een bestaande catalogusassistent, **When** de platformbeheerder de naam,
   het icoon, het type, de beschrijving of de voorbeeldvragen wijzigt, **Then** zien alle
   organisaties de gewijzigde gegevens.
3. **Given** een bestaande catalogusassistent, **When** de platformbeheerder deze opent,
   **Then** is er geen besturing om de assistent te verwijderen en is er geen veld om de
   systeeminstructie te bewerken.
4. **Given** een kantoorbeheerder of adviseur op de pagina Assistenten, **When** deze de
   pagina bekijkt of met het toetsenbord doorloopt, **Then** is er geen besturing om een
   assistent aan te maken of te bewerken.
5. **Given** een nieuwe organisatie die later wordt aangemaakt, **When** deze in gebruik
   wordt genomen, **Then** staan alle op dat moment bestaande catalogusassistenten aan.

---

### User Story 4 - Uitgezette assistent is nergens zichtbaar of bruikbaar (Priority: P1)

Als adviseur of kantoorbeheerder zie en gebruik ik een uitgezette assistent nergens meer:
niet op de pagina Assistenten, niet op het startscherm en niet via een directe link.
Bestaande gesprekken blijven leesbaar; een nieuw bericht in zo'n gesprek wordt geweigerd
met de bestaande foutmelding.

**Why this priority**: De schakelaar is alleen geloofwaardig als een uitgezette assistent
echt verdwijnt. Zonder deze verplichting is de schakelaar een cosmetische instelling.

**Independent Test**: Volledig te testen met een adviseursaccount: zet een assistent voor
de organisatie uit, controleer dat deze verdwijnt van het assistentoverzicht, het
startscherm en de geschiedenis, dat een directe link niet werkt, dat een bestaand gesprek
nog leesbaar is en dat een nieuw bericht de bestaande foutmelding geeft.

**Acceptance Scenarios**:

1. **Given** een organisatie met één aangezette en één uitgezette assistent, **When** een
   adviseur het assistentoverzicht opent, **Then** ziet deze alleen de aangezette
   assistent.
2. **Given** dezelfde organisatie, **When** een adviseur het startscherm opent,
   **Then** wordt de uitgezette assistent daar niet aangeboden.
3. **Given** dezelfde organisatie, **When** een adviseur een directe link naar de
   uitgezette assistent opent, **Then** kan deze geen gesprek starten en krijgt deze een
   melding dat de assistent niet beschikbaar is.
4. **Given** een adviseur met een bestaand gesprek met die assistent, **When** deze het
   gesprek opent, **Then** blijven de bestaande berichten leesbaar.
5. **Given** datzelfde gesprek, **When** de adviseur een nieuw bericht verstuurt,
   **Then** wordt het bericht geweigerd met de bestaande foutmelding en verschijnt er
   geen nieuw antwoord.
6. **Given** een uitgezette assistent, **When** de platformbeheerder deze weer aanzet,
   **Then** is de assistent direct weer zichtbaar en bruikbaar voor die organisatie.

---

### User Story 5 - Kantoorbeheerder beheert alleen kenniskoppelingen (Priority: P1)

Als kantoorbeheerder koppel ik nog steeds kennisbronnen van mijn organisatie aan onze
assistenten. Assistenten aanmaken, bewerken, verwijderen of aan- en uitzetten kan ik
niet meer, en Instellingen zie ik niet.

**Why this priority**: De kennisbronnen zijn organisatie-eigendom en moeten bruikbaar
blijven. Tegelijk moet de platformbeheerder de enige zijn die de catalogus en de
koppelingen bepaalt. Zonder deze afbakening verliest de kantoorbeheerder werk dat niet
aan de platformbeheerder toebehoort.

**Independent Test**: Volledig te testen met een kantoorbeheerdersaccount: koppel een
eigen kennisbron aan een aangezette assistent en ontkoppel deze weer; controleer dat er
geen besturing is om assistenten aan te maken, te bewerken, te verwijderen of aan of uit
te zetten, dat Instellingen niet in het menu staat en dat de route "Geen toegang" toont.

**Acceptance Scenarios**:

1. **Given** een kantoorbeheerder, **When** deze de pagina Assistenten opent, **Then**
   ziet deze alleen de voor de organisatie aangezette assistenten, zonder besturing om
   assistenten aan te maken, te bewerken, te verwijderen of aan of uit te zetten.
2. **Given** een kantoorbeheerder en een aangezette assistent, **When** deze een
   kennisbron van de eigen organisatie aan de assistent koppelt, **Then** is de koppeling
   opgeslagen en na herladen zichtbaar.
3. **Given** een bestaande koppeling, **When** de kantoorbeheerder deze verbreekt,
   **Then** is de koppeling verwijderd en gebruikt de assistent die kennisbron niet meer.
4. **Given** een kantoorbeheerder, **When** deze een kennisbron van een andere organisatie
   of een niet-aangezette assistent probeert te koppelen, **Then** weigert het systeem de
   actie.
5. **Given** een kantoorbeheerder, **When** deze inlogt, **Then** staat Instellingen niet
   in het menu en toont de route `/settings` "Geen toegang".

---

### User Story 6 - Alleen de platformbeheerder maakt organisaties aan (Priority: P1)

Alleen de platformbeheerder kan nieuwe organisaties aanmaken. Een nieuwe organisatie
krijgt direct alle catalogusassistenten, aangezet.

**Why this priority**: Het huidige formulier "Nieuwe organisatie" staat voor elke
kantoorbeheerder open. Zonder deze beperking kan iedereen tenants bijmaken, wat de
centrale regie ondermijnt.

**Independent Test**: Volledig te testen met een platformbeheerdersaccount en een
kantoorbeheerdersaccount: maak als platformbeheerder een organisatie aan en controleer
dat alle catalogusassistenten aan staan en dat de organisatie in de keuzelijst verschijnt;
probeer hetzelfde als kantoorbeheerder en controleer de weigering.

**Acceptance Scenarios**:

1. **Given** een platformbeheerder en een gevulde catalogus, **When** deze een nieuwe
   organisatie met een beheerdersaccount aanmaakt, **Then** staan alle
   catalogusassistenten direct voor die organisatie aan.
2. **Given** een kantoorbeheerder, **When** deze een nieuwe organisatie probeert aan te
   maken, **Then** weigert de server de actie en verschijnt een Nederlandse melding.
3. **Given** een zojuist aangemaakte organisatie, **When** de platformbeheerder
   Instellingen opent, **Then** staat de organisatie direct in de keuzelijst.

---

### User Story 7 - De server dwingt alle rechten af (Priority: P1)

De server dwingt dit alles af, ook als iemand de gebruikersinterface omzeilt. Een
gebruiker die geen platformbeheerder is, krijgt bij elke actie van de nieuwe beheerroute
en bij het aanmaken van een organisatie een weigering. Geen enkele client-rol kan
assistentgegevens aanmaken, wijzigen of verwijderen of een organisatieschakelaar
omzetten. Het koppelen van kennisbronnen blijft voor kantoorbeheerders binnen de eigen
organisatie werken.

**Why this priority**: UI-maatregelen zijn te omzeilen. Alleen afdwinging op de server
maakt van de platformbeheerder echt de enige beheerder en voorkomt dat een
kantoorbeheerder via directe aanroepen alsnog assistenten wijzigt.

**Independent Test**: Volledig te testen met directe aanroepen buiten de UI onder een
kantoorbeheerders- en een adviseursaccount: elke beheeractie en het aanmaken van een
organisatie worden geweigerd; het koppelen van een eigen kennisbron aan een aangezette
assistent slaagt; leesacties blijven werken.

**Acceptance Scenarios**:

1. **Given** een kantoorbeheerder of adviseur, **When** deze buiten de UI om een actie
   van de platformbeheerroute uitvoert, **Then** weigert de server de actie.
2. **Given** een kantoorbeheerder of adviseur, **When** deze buiten de UI om een
   assistent aanmaakt, wijzigt of verwijdert, **Then** weigert de server de actie en
   wijzigt er niets.
3. **Given** een kantoorbeheerder of adviseur, **When** deze buiten de UI om een
   organisatieschakelaar omzet, **Then** weigert de server de actie.
4. **Given** een kantoorbeheerder, **When** deze buiten de UI om een eigen kennisbron aan
   een voor de organisatie aangezette assistent koppelt of ontkoppelt, **Then** slaagt de
   actie.
5. **Given** een kantoorbeheerder, **When** deze buiten de UI om een organisatie
   aanmaakt, **Then** weigert de server de actie.
6. **Given** een adviseur, **When** deze de eigen gesprekken en berichten leest,
   **Then** werkt dit ongewijzigd.

---

### Edge Cases

- **Assistent uitgezet tijdens een lopend gesprek**: het gesprek blijft leesbaar, maar
  een nieuw bericht wordt geweigerd met de bestaande foutmelding.
- **Assistent staat bij geen enkele organisatie aan**: de assistent blijft in de
  catalogus staan en is voor niemand zichtbaar of bruikbaar.
- **Nieuwe catalogusassistent terwijl een organisatie net is aangemaakt**: de assistent
  staat bij alle bestaande organisaties aan, inclusief de zojuist aangemaakte.
- **Secret opslaan mislukt**: het oude secret blijft geldig en de platformbeheerder ziet
  een Nederlandse foutmelding.
- **Headernaam gewijzigd maar n8n nog niet**: chat en documentverwerking krijgen de
  bestaande melding dat de koppeling de verbinding weigert.
- **URL ontbreekt op het moment van gebruik**: de gebruiker krijgt de bestaande melding
  "Er is geen koppeling geconfigureerd".
- **Ongeldige URL**: een adres dat niet aan de regels voldoet, wordt niet opgeslagen; de
  bestaande waarde blijft staan.
- **Kennisbron gekoppeld aan een assistent die later wordt uitgezet**: de koppeling
  blijft bestaan; zodra de assistent weer aan staat, gebruikt deze de kennisbron weer.
- **Kennisbron van een andere organisatie**: koppelen aan een eigen assistent wordt
  geweigerd, ook buiten de UI om.
- **Platformbeheerder hoort ook bij een organisatie**: voor gebruik binnen die organisatie
  gelden dezelfde zichtbaarheidsregels als voor andere gebruikers.
- **Twee organisaties gebruiken dezelfde catalogusassistent**: de gesprekken,
  berichten en kenniskoppelingen blijven per organisatie en per gebruiker gescheiden.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Het systeem MOET een platformbeheerder kennen: een rol of bevoegdheid
  boven de beheerder van een organisatie, die toegang geeft tot alle organisaties en tot
  het platformbeheer. Deze rol wordt buiten de gebruikersinterface toegekend.
- **FR-002**: Het systeem MOET één platformbrede assistentcatalogus hebben met per
  assistent: icoon, naam, type, beschrijving en voorbeeldvragen. Een wijziging aan een
  catalogusassistent MOET voor alle organisaties gelden.
- **FR-003**: Een nieuwe catalogusassistent MOET direct bij alle bestaande organisaties
  aangezet staan.
- **FR-004**: Het systeem MOET per organisatie en per catalogusassistent een
  aan/uit-stand vastleggen. Alleen de platformbeheerder MAG deze stand wijzigen.
- **FR-005**: Alleen de platformbeheerder MOET toegang hebben tot Instellingen. Daar
  kiest deze een organisatie en ziet in het subscherm alle catalogusassistenten als één
  horizontale rij tegels met icoon, naam, typelabel en een schakelaar per tegel.
- **FR-006**: Elke schakelaar MOET met het toetsenbord bedienbaar zijn en een
  toegankelijke naam hebben die de assistent en de organisatie bevat.
- **FR-007**: Mislukt het opslaan van een schakelaar, dan MOET de schakelaar terugspringen
  naar de vorige stand en MOET een Nederlandse foutmelding verschijnen.
- **FR-008**: Geen enkele client-rol MAG assistentgegevens aanmaken, wijzigen of
  verwijderen. Deze handelingen MOETEN uitsluitend via de platformbeheerroute verlopen.
- **FR-009**: Een kantoorbeheerder MOET kennisbronnen van de eigen organisatie kunnen
  koppelen aan en ontkoppelen van assistenten die voor de eigen organisatie aan staan.
  Koppelen aan een andere organisatie of aan een niet-aangezette assistent MOET worden
  geweigerd.
- **FR-010**: Een kantoorbeheerder of adviseur MAG geen besturing zien of bereiken om
  assistenten aan te maken, te bewerken, te verwijderen of aan of uit te zetten.
- **FR-011**: Instellingen MOET voor niet-platformbeheerders uit het menu verdwijnen en
  de route `/settings` MOET "Geen toegang" tonen.
- **FR-012**: Elke actie van de platformbeheerroute en het aanmaken van een organisatie
  MOET door de server worden geweigerd voor iedereen die geen platformbeheerder is.
- **FR-013**: Het venster Koppelingen MOET met één tandwielknop te openen zijn en bevatten:
  de headernaam, het secret (één waarde voor alle n8n-webhooks), de productie-URL voor
  documentverwerking, en per catalogusassistent een test-URL en een productie-URL.
- **FR-014**: Een productie-URL MOET kunnen worden getest; de uitkomst MOET in het
  Nederlands worden getoond en MAG de opgeslagen instellingen niet wijzigen.
- **FR-015**: Het secret MOET na opslaan nergens meer leesbaar zijn, ook niet voor de
  platformbeheerder. Een leeg secretveld bij opslaan MOET het bestaande secret behouden.
- **FR-016**: Een productie-URL MOET https zijn en MAG niet naar localhost, een host die
  eindigt op `.local` of `.internal`, of een letterlijk IP-adres wijzen, en MAG geen
  `/webhook-test/` bevatten. Dit geldt voor de productie-URL per assistent en voor de
  productie-URL voor documentverwerking.
- **FR-017**: Een test-URL MOET dezelfde regels volgen als een productie-URL, met dit
  verschil dat `/webhook-test/` is toegestaan. De test-URL wordt alleen opgeslagen en
  door de applicatie niet gebruikt.
- **FR-018**: Chat MOET de productie-URL van de catalogusassistent gebruiken, samen met de
  centrale headernaam en het centrale secret.
- **FR-019**: Documentverwerking MOET de centrale productie-URL voor documentverwerking
  gebruiken, met dezelfde centrale headernaam en hetzelfde centrale secret.
- **FR-020**: Ontbreekt een vereiste URL, dan MOET de gebruiker de bestaande melding
  "Er is geen koppeling geconfigureerd" krijgen.
- **FR-021**: Adviseurs en kantoorbeheerders MOETEN alleen assistenten zien die voor hun
  organisatie aan staan: op de pagina Assistenten, op het startscherm en in de
  geschiedenis. Een directe link naar een uitgezette assistent MAG niet tot een bruikbare
  assistent leiden.
- **FR-022**: Bestaande gesprekken met een uitgezette assistent MOETEN leesbaar blijven.
  Een nieuw bericht in zo'n gesprek MOET worden geweigerd met de bestaande foutmelding.
- **FR-023**: Alleen de platformbeheerder MAG nieuwe organisaties aanmaken. Een nieuwe
  organisatie MOET direct alle catalogusassistenten aangezet krijgen.
- **FR-024**: De server MOET alle bovenstaande rechten afdwingen, ook bij aanroepen
  buiten de gebruikersinterface om.
- **FR-025**: Na de migratie MOETEN adviseurs en kantoorbeheerders precies dezelfde
  actieve assistenten zien als voorheen, en MOETEN chat en documentverwerking werken
  zonder dat iemand opnieuw een token invoert.
- **FR-026**: Alle nieuwe interface tekst MOET in het Nederlands zijn en gebruikmaken van
  de u-vorm.

### Key Entities

- **Platformbeheerder**: gebruiker met een bevoegdheid boven de beheerder van een
  organisatie; ziet alle organisaties en beheert de catalogus, de schakelaars en de
  koppelingen. De rol wordt buiten de gebruikersinterface toegekend.
- **Catalogusassistent**: platformbrede definitie van een assistent met icoon, naam,
  type (chat of risico-analyse), beschrijving, voorbeeldvragen, systeeminstructie (in
  deze feature niet bewerkbaar), test-URL en productie-URL. Bestaat onafhankelijk van
  organisaties.
- **Organisatiebeschikbaarheid**: de aan/uit-stand van één catalogusassistent voor één
  organisatie; bepaalde welke gebruikers de assistent zien en kunnen gebruiken.
- **Koppelingen (platformbreed)**: de centrale headernaam, het centrale secret en de
  productie-URL voor documentverwerking. Het secret is alleen schrijfbaar en nooit
  leesbaar.
- **Organisatie**: tenant met eigen gebruikers en kennisbronnen; krijgt bij aanmaken alle
  catalogusassistenten aangezet.
- **Kennisbronkoppeling**: de verbinding tussen een kennisbron van één organisatie en een
  voor die organisatie aangezette catalogusassistent.
- **Gesprek en bericht**: gebruikersgegevens van een adviseur of kantoorbeheerder,
  gekoppeld aan een assistent; blijven leesbaar als de assistent wordt uitgezet.
- **Gebruikersrol**: platformbeheerder, kantoorbeheerder (beheerder van een organisatie)
  of adviseur; bepaalt welke besturing zichtbaar en bereikbaar is en welke handelingen de
  server toestaat.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een platformbeheerder kan een assistent voor een organisatie aan- of
  uitzetten in maximaal drie handelingen vanuit Instellingen, en de stand is na herladen
  van de pagina in 100% van de gevallen bewaard.
- **SC-002**: 100% van de beheeracties van de platformbeheerroute en van het aanmaken van
  een organisatie wordt geweigerd voor iedereen die geen platformbeheerder is —
  verifieerbaar met geautomatiseerde tests die de server rechtstreeks aanroepen.
- **SC-003**: Een uitgezette assistent is in 0 gevallen zichtbaar of bruikbaar voor
  adviseurs en kantoorbeheerders, op alle plekken waar assistenten worden aangeboden
  (assistentoverzicht, startscherm, geschiedenis, directe link) — verifieerbaar met
  geautomatiseerde UI-tests en met een controle buiten de UI om.
- **SC-004**: Het secret is na opslaan in 0 gevallen leesbaar, voor geen enkele rol en via
  geen enkele interface — verifieerbaar met geautomatiseerde tests.
- **SC-005**: 100% van de productie-URL's die niet aan de regels voldoen wordt geweigerd en
  100% van de geldige productie-URL's wordt geaccepteerd; voor test-URL's geldt hetzelfde
  met `/webhook-test/` toegestaan — verifieerbaar met geautomatiseerde tests.
- **SC-006**: Na de migratie ziet 100% van de adviseurs en kantoorbeheerders exact
  dezelfde actieve assistenten als voorheen, en slagen chat en documentverwerking zonder
  dat iemand opnieuw een token invoert — verifieerbaar met een vergelijking voor en na de
  migratie en met de bestaande regressietestsuite.
- **SC-007**: Kantoorbeheerders kunnen kennisbronnen van de eigen organisatie koppelen en
  ontkoppelen, terwijl 0 besturingselementen voor assistentbeheer voor hen zichtbaar of
  via het toetsenbord bereikbaar zijn.
- **SC-008**: Elke nieuwe organisatie heeft direct alle catalogusassistenten aan staan,
  zonder handmatige stappen — verifieerbaar met een geautomatiseerde test.
- **SC-009**: 100% van de nieuwe interfaceteksten is Nederlands in de u-vorm —
  verifieerbaar met een tekstcontrole van de nieuwe schermen.

## Assumptions

**Buiten scope** (vastgelegd in de opdracht):

- Een assistent uit de catalogus verwijderen.
- Een secret per organisatie.
- Het gebruik van de test-URL; dit komt met een testaccount.
- De risico-analyse via n8n laten lopen; dat is een aparte feature.
- Systeeminstructies bewerken.
- De tabel `flow_configs` en de kolom `ai_assistants.n8n_webhook_url` verwijderen.
- Rolbeheer in de gebruikersinterface.

**Aannames en gemaakte keuzes**:

- De platformbeheerder is één rol of bevoegdheid boven de beheerder van een organisatie.
  Toekenning gebeurt buiten de gebruikersinterface, bijvoorbeeld door de beheerder van het
  platform zelf; er komt geen rolbeheer in de UI.
- Instellingen wordt volledig platformbeheerder-only. Kantoorbeheerders verliezen daarmee
  ook het formulier "Nieuwe organisatie" en de per-organisatie webhookinstellingen; die
  functionaliteit verhuist naar de centrale koppelingen.
- De aan/uit-stand per organisatie vervangt de huidige "Actief"-schakelaar van een
  assistent. Er komt geen aparte platformbrede actiefstand.
- Er is één secret voor alle n8n-webhooks, passend bij de huidige n8n-inrichting waarin
  alle webhooks dezelfde headerwaarde controleren. Bij de migratie wordt het bestaande
  token als centraal secret overgenomen; aangenomen wordt dat de bestaande tokens gelijk
  zijn omdat n8n één headerwaarde controleert.
- De migratie neemt de bestaande assistenten op in de catalogus en zet de schakelaar per
  organisatie gelijk aan de vroegere actiefstand. Waar organisaties identieke assistenten
  met dezelfde definitie en URL hadden, worden deze samengevoegd tot één catalogusassistent;
  waar definities of URL's afwijken, blijven het aparte catalogusassistenten. Het aantal
  zichtbare actieve assistenten per organisatie verandert niet.
- Een nieuwe catalogusassistent staat aan bij alle organisaties die op dat moment bestaan;
  organisaties die later worden aangemaakt, krijgen alle dan bestaande
  catalogusassistenten aangezet.
- De systeeminstructie van bestaande assistenten blijft ongewijzigd bewaard en is in deze
  feature niet te bewerken. Nieuwe catalogusassistenten krijgen geen systeeminstructie
  mee via de interface.
- De headernaam heeft een standaardwaarde (de bestaande standaard) wanneer het veld leeg
  wordt opgeslagen.
- Kennisbronkoppelingen blijven aan de organisatie gebonden. Wordt een assistent voor een
  organisatie uitgezet, dan blijven de koppelingen bestaan en werken ze weer zodra de
  assistent opnieuw aan staat.
- De risico-analyse gebruikt een eigen, aparte verbinding en verandert niet in deze
  feature; alleen de beschikbaarheid van risico-analyse-assistenten volgt de schakelaar.
- Het startscherm is de plek waar assistenten worden aangeboden om een gesprek of
  analyse te starten, inclusief de geschiedenisweergave.
- De bestaande foutmeldingen blijven ongewijzigd: bij een uitgezette assistent of een
  niet-toegestaan gesprek de bestaande toegangsfout, en bij een ontbrekende URL
  "Er is geen koppeling geconfigureerd".
- De oude gegevensstructuur voor koppelingen en de oude webhook-URL-kolom blijven bestaan
  maar worden niet meer gebruikt; opruimen valt buiten deze feature.
