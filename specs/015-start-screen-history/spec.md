# Feature Specification: Startscherm rond de vraag en één overzicht van eerder werk

**Feature Branch**: `015-start-screen-history`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Startscherm rond de vraag en één overzicht van eerder werk. Huidige situatie: Command Center (src/pages/CommandCenterPage.tsx) toont tellers (assistenten, kennisbronnen, teamleden) en een placeholder 'Taken'. Daar heeft een adviseur niets aan. Geschiedenis (src/pages/HistoryPage.tsx) belooft 'alle eerdere runs' maar toont alleen chatgesprekken; risico-analyses ontbreken. De badge Nieuw/Afgerond zegt niets. Gesprekken openen alleen-lezen in een paneel, verdergaan kan niet, en zoeken kan niet. Rijen zijn klikbare kaarten die niet met het toetsenbord bereikbaar zijn."

**User stories samengevat**: (1) Na inloggen landt de adviseur op een startscherm met één vraagveld en een keuze uit de actieve chat-assistenten; versturen opent een nieuw gesprek met die vraag. (2) Het startscherm toont de vijf laatste gesprekken, de vijf laatste risico-analyses met status, en een knop "Nieuwe risico-analyse" als er een risico-analyse-assistent is. (3) Geschiedenis toont gesprekken en risico-analyses in twee tabbladen; een gesprek openen brengt de adviseur naar het gesprek zelf, waar hij verder kan. (4) De adviseur kan in Geschiedenis zoeken op gesprekstitel of klantreferentie.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Starten vanuit één vraag (Priority: P1)

Als adviseur kom ik na inloggen op een startscherm dat mij direct laat beginnen: één vraagveld en een keuze uit de actieve chat-assistenten. Ik typ mijn vraag, kies de assistent en verstuur. De app opent een nieuw gesprek met die assistent en stuurt mijn vraag als eerste bericht. Ik hoef niet eerst naar een assistentenoverzicht of een tellerpagina.

**Why this priority**: Dit is de kern van het dagelijkse gebruik: de adviseur komt voor een vraag, niet voor een dashboard. Zonder deze story verandert het startscherm alleen van inhoud en niet van taak.

**Independent Test**: Volledig te testen door in te loggen, een vraag te typen, een actieve chat-assistent te kiezen en te versturen: het gesprek opent met de vraag als eerste bericht bij de gekozen assistent.

**Acceptance Scenarios**:

1. **Given** een ingelogde adviseur met minstens één actieve chat-assistent, **When** het startscherm opent, **Then** ziet hij één vraagveld en een keuze uit de actieve chat-assistenten.
2. **Given** een getypte vraag en een gekozen assistent, **When** de adviseur verstuurt, **Then** opent een nieuw gesprek met die assistent en wordt de vraag als eerste bericht verstuurd.
3. **Given** een leeg of alleen-whitespace vraagveld, **When** de adviseur probeert te versturen, **Then** kan hij niet versturen en blijft hij op het startscherm.
4. **Given** een verzonden vraag, **When** de adviseur het adres, localStorage/sessionStorage/cookies of de analytics bekijkt, **Then** komt de vraag daar nergens in voor; de tijdelijke React Router-state is dan al gewist (constitution III).
5. **Given** er is precies één actieve chat-assistent, **When** het startscherm opent, **Then** is die assistent al gekozen maar blijft de keuze zichtbaar en wijzigbaar.
6. **Given** er is geen actieve chat-assistent, **When** het startscherm opent, **Then** legt een korte melding uit dat er geen chat-assistent beschikbaar is en biedt de pagina een passende actie (bijvoorbeeld naar het assistentenoverzicht).

---

### User Story 2 - Overzicht van eerder werk op het startscherm (Priority: P1)

Op hetzelfde startscherm zie ik waar ik gebleven ben: mijn vijf laatste gesprekken en mijn vijf laatste risico-analyses met hun status. Een gesprek opent het gesprek zelf; een analyse opent de analysepagina. Als er een risico-analyse-assistent is, biedt het startscherm direct de knop "Nieuwe risico-analyse". Zo hoef ik voor eerder werk of een nieuwe analyse niet meer naar losse pagina's te zoeken.

**Why this priority**: Het startscherm moet niet alleen starten maar ook hervatten. Zonder dit overzicht blijft de adviseur voor eerder werk aangewezen op de Geschiedenis-pagina en ontbreekt de directe ingang naar een nieuwe analyse.

**Independent Test**: Volledig te testen met bestaande gesprekken en analyses: het startscherm toont er maximaal vijf van elk met de juiste status, elke rij opent het juiste item, en de analyseknop verschijnt uitsluitend als er een risico-analyse-assistent is.

**Acceptance Scenarios**:

1. **Given** de adviseur heeft meer dan vijf gesprekken, **When** het startscherm opent, **Then** toont het de vijf meest recente gesprekken met titel, assistent en datum.
2. **Given** de adviseur heeft meer dan vijf risico-analyses, **When** het startscherm opent, **Then** toont het de vijf meest recente analyses met klantreferentie (indien beschikbaar), status en starttijd.
3. **Given** een gesprek in het overzicht, **When** de adviseur het opent, **Then** opent het gesprek zelf op zijn eigen pagina.
4. **Given** een risico-analyse in het overzicht, **When** de adviseur die opent, **Then** opent de analysepagina van die analyse.
5. **Given** er is minstens één risico-analyse-assistent, **When** het startscherm wordt getoond, **Then** is de knop "Nieuwe risico-analyse" zichtbaar en start die een nieuwe analyse.
6. **Given** er is geen risico-analyse-assistent, **When** het startscherm wordt getoond, **Then** is de knop "Nieuwe risico-analyse" niet aanwezig.
7. **Given** er zijn nog geen gesprekken of analyses, **When** het startscherm opent, **Then** legt een korte lege toestand per onderdeel uit wat daar komt te staan en biedt een actie om te beginnen.

---

### User Story 3 - Geschiedenis als één overzicht van gesprekken en analyses (Priority: P1)

In Geschiedenis zie ik al mijn eerdere werk op één plek, verdeeld over twee tabbladen: Gesprekken en Risico-analyses. Een gesprek openen brengt mij naar het gesprek zelf, waar ik gewoon verder kan chatten. Een analyse openen brengt mij naar de analysepagina met de actuele status. De misleidende badge Nieuw/Afgerond verdwijnt; elke rij toont nuttige herkenning in plaats van een label zonder betekenis.

**Why this priority**: De pagina belooft nu "alle eerdere runs" maar toont alleen gesprekken. Zonder beide tabbladen is er geen enkel overzicht van analyses, en zonder navigatie naar het gesprek zelf is hervatten onmogelijk.

**Independent Test**: Volledig te testen door Geschiedenis te openen met zowel gesprekken als analyses: beide tabbladen tonen hun items, een gesprek opent de chatpagina en laat verder chatten toe, en een analyse opent de analysepagina.

**Acceptance Scenarios**:

1. **Given** de adviseur opent Geschiedenis, **When** de pagina laadt, **Then** ziet hij twee tabbladen: Gesprekken en Risico-analyses.
2. **Given** het tabblad Gesprekken, **When** de adviseur een gesprek opent, **Then** navigeert de app naar het gesprek zelf op zijn eigen pagina en kan de adviseur daar verder chatten.
3. **Given** het tabblad Risico-analyses, **When** de adviseur een analyse opent, **Then** navigeert de app naar de analysepagina van die analyse.
4. **Given** een rij in een van beide tabbladen, **When** de adviseur die bekijkt, **Then** ziet hij herkenbare gegevens (titel of klantreferentie, assistent of status, datum) en géén badge "Nieuw"/"Afgerond".
5. **Given** een leeg tabblad, **When** de adviseur het opent, **Then** legt een korte lege toestand uit wat daar verschijnt en biedt een actie om te beginnen.
6. **Given** het tabblad Risico-analyses, **When** een analyse de status wachtrij, bezig, klaar of mislukt heeft, **Then** toont de rij die status in begrijpelijke Nederlandse tekst.

---

### User Story 4 - Zoeken in Geschiedenis (Priority: P2)

Als adviseur kan ik in Geschiedenis zoeken op gesprekstitel of klantreferentie. Terwijl ik typ, versmalt de lijst in het actieve tabblad zich tot de items die matchen. Het zoeken gebeurt op de lijst die al geladen is; er gaat geen zoekterm naar de server en de zoekterm komt niet in het adres terecht.

**Why this priority**: Bij meer dan een handvol runs is terugvinden de belangrijkste reden om Geschiedenis te openen. Minder kritisch dan de twee tabbladen en de navigatie, maar direct dagelijkse winst.

**Independent Test**: Volledig te testen door in elk tabblad een bestaande titel of klantreferentie te typen: alleen de matchende rijen blijven zichtbaar, zonder dat de zoekterm in het adres of in een verzoek-URL verschijnt.

**Acceptance Scenarios**:

1. **Given** het tabblad Gesprekken met meerdere gesprekken, **When** de adviseur een deel van een gesprekstitel typt, **Then** toont het tabblad uitsluitend de gesprekken waarvan de titel matcht.
2. **Given** het tabblad Risico-analyses met meerdere analyses, **When** de adviseur een deel van een klantreferentie typt, **Then** toont het tabblad uitsluitend de analyses waarvan de klantreferentie matcht.
3. **Given** een zoekterm, **When** de adviseur het adres of een netwerkverzoek bekijkt, **Then** komt de zoekterm daar niet in voor; het filteren gebeurt volledig in de browser op de al geladen lijst.
4. **Given** een zoekterm zonder resultaten, **When** de lijst leeg raakt, **Then** legt een korte melding uit dat er niets matcht en kan de adviseur de zoekterm in één actie wissen.
5. **Given** een zoekterm met andere hoofdletters of diakritische tekens, **When** de adviseur zoekt, **Then** matcht de zoekopdracht hoofdletterongevoelig en waar zinvol diakrietongevoelig.

---

### Edge Cases

- **Geen actieve chat-assistenten**: het vraagveld is niet bruikbaar en een korte uitleg met actie (naar het assistentenoverzicht) vervangt het formulier; er verschijnt geen technische foutmelding.
- **Meerdere risico-analyse-assistenten**: de knop "Nieuwe risico-analyse" leidt naar een keuze van de assistent of naar het bestaande assistentenoverzicht; de adviseur start nooit per ongeluk met de verkeerde assistent.
- **Vraag met alleen spaties of regeleinden**: versturen is geblokkeerd; de adviseur blijft op het startscherm met zijn tekst intact.
- **Vraag versturen terwijl de assistent intussen inactief is geworden**: de adviseur krijgt een zichtbare melding en verliest zijn vraag niet (constitution V: geen stille fouten).
- **Gesprek van een inmiddels verwijderde assistent**: de rij blijft openen; de assistent wordt als "Onbekend" getoond (bestaand gedrag).
- **Analyse met een verlopen resultaat**: de rij blijft in het overzicht staan en de analysepagina toont de bestaande melding over het verwijderde resultaat.
- **Zeer lange titels of klantreferenties**: de rij blijft leesbaar zonder de rest van de rij te verdringen (afkappen met volledige tekst beschikbaar via de gebruikelijke toegankelijkheidsmiddelen).
- **Zoeken terwijl er nog wordt geladen**: de zoekfunctie is pas actief zodra de lijst geladen is; tijdens laden is de bestaande laadtoestand zichtbaar.
- **Zoekterm wissen of tabblad wisselen**: de zoekterm geldt per tabblad en wordt bij het wisselen niet op de andere lijst toegepast; wissen herstelt de volledige geladen lijst.
- **Direct naar /command-center navigeren** (bladwijzer, oude link): de app verwijst door naar het startscherm, ook voor onbekende routes die nu naar /command-center verwijzen.
- **Startscherm met meer dan vijf gesprekken of analyses**: uitsluitend de vijf meest recente verschijnen; de volledige lijst blijft bereikbaar via Geschiedenis.
- **Analyse zonder klantreferentie**: de rij toont een neutrale aanduiding in plaats van een lege plek.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Het systeem MOET na inloggen een startscherm tonen met één vraagveld en een keuze uit de actieve chat-assistenten (assistenten van het type chat die actief zijn).
- **FR-002**: Het startscherm MOET versturen pas toestaan bij een niet-lege vraag en een gekozen assistent; versturen MOET een nieuw gesprek openen en de vraag als eerste bericht naar de gekozen assistent sturen.
- **FR-003**: De vraag van het startscherm MAG NIET in het adres, localStorage/sessionStorage/cookies, analytics of logs terechtkomen. De vraag mag uitsluitend tijdelijk in React Router-state (tab-gebonden geheugen) staan en MOET direct bij binnenkomst van de chatpagina met `replace` gewist worden voordat de vraag verstuurd wordt (constitution III).
- **FR-004**: Het startscherm MOET de vijf meest recente gesprekken van de adviseur tonen met titel, assistent en datum, en elk gesprek MOET openen op de eigen gesprekspagina.
- **FR-005**: Het startscherm MOET de vijf meest recente risico-analyses van de adviseur tonen met klantreferentie (indien beschikbaar), status en starttijd, en elke analyse MOET openen op de eigen analysepagina.
- **FR-006**: Het startscherm MOET een knop "Nieuwe risico-analyse" tonen als er minstens één risico-analyse-assistent bestaat, en die knop MOET een nieuwe analyse starten; zonder zo'n assistent is de knop afwezig.
- **FR-007**: Het startscherm MOET per onderdeel (gesprekken, analyses) een lege toestand met korte uitleg en een actie tonen wanneer er nog niets is.
- **FR-008**: Geschiedenis MOET twee tabbladen bieden: Gesprekken en Risico-analyses; elk tabblad toont de bijbehorende items van de ingelogde adviseur.
- **FR-009**: Een gesprek openen in Geschiedenis MOET navigeren naar het gesprek zelf, waar de adviseur verder kan chatten; het alleen-lezen paneel vervalt.
- **FR-010**: Een risico-analyse openen in Geschiedenis MOET navigeren naar de analysepagina van die analyse, met de actuele status.
- **FR-011**: Geschiedenis MOET per rij nuttige herkenning tonen (titel of klantreferentie, assistent of status, datum) en de badge "Nieuw"/"Afgerond" MOET verdwijnen.
- **FR-012**: Geschiedenis MOET zoeken op gesprekstitel (tabblad Gesprekken) en klantreferentie (tabblad Risico-analyses).
- **FR-013**: Zoeken MOET volledig in de browser gebeuren op de al geladen lijst; de zoekterm MAG NIET in een verzoek-URL, het adres of browseropslag terechtkomen.
- **FR-014**: Zoeken MOET hoofdletterongevoelig zijn en per tabblad gelden; een lege zoekuitkomst MOET een korte uitleg en een actie "Zoekterm wissen" tonen.
- **FR-015**: De route /command-center MOET doorverwijzen naar het startscherm; ook de bestaande terugvalroute voor onbekende paden MOET naar het startscherm verwijzen.
- **FR-016**: Rijen en kaarten in het startscherm en in Geschiedenis MOETEN links of knoppen zijn, bereikbaar met Tab en te openen met Enter, met een zichtbare focusindicatie (constitution IV).
- **FR-017**: Alle nieuwe en gewijzigde schermen MOETEN voldoen aan WCAG 2.1 AA: toetsenbordbediening, semantische markup, contrast en focusstates.
- **FR-018**: Alle gebruikersgerichte teksten MOETEN in het Nederlands zijn, zakelijk en met "u" (constitution I).
- **FR-019**: Bestaande CONCEPT-labels en de betekenis daarvan MOETEN ongewijzigd blijven; deze feature toont geen advies of aanbeveling (constitution II).
- **FR-020**: De bestaande geautomatiseerde end-to-enddekking voor chat, analyse, assistenten en geschiedenis MOET blijven slagen, aangepast aan de nieuwe startroute waar nodig.
- **FR-021**: Fouten bij het laden van gesprekken of analyses MOETEN zichtbaar worden gemaakt met een begrijpelijke melding en een herhaalactie; geen stille fouten (constitution V).

### Key Entities

- **Startvraag**: de tekst die de adviseur op het startscherm typt om een gesprek te beginnen. Bestaat uitsluitend tijdelijk in React Router-state (tab-gebonden geheugen), wordt direct bij binnenkomst van de chatpagina gewist en wordt nooit in het adres, localStorage/sessionStorage/cookies, analytics of logs bewaard.
- **Chat-assistent**: een actieve assistent van het type chat, met id, naam en icoon; de keuze op het startscherm.
- **Gesprek**: een bestaand chatgesprek van de adviseur met een titel, de gebruikte assistent en een aanmaakdatum; te openen en voort te zetten op de eigen pagina.
- **Risico-analyse (run)**: een analyse van de adviseur met een run-id, klantreferentie, status (wachtrij, bezig, klaar, mislukt), starttijd en eventueel een vervaldatum van het resultaat; te openen op de eigen analysepagina.
- **Lijstitem in Geschiedenis**: een rij in het tabblad Gesprekken of Risico-analyses met de herkenning die nodig is om het item te vinden en te openen.
- **Zoekterm**: de tekst waarmee de adviseur de al geladen lijst in de browser filtert; nooit onderdeel van een verzoek of adres.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% van de adviseurs landt na inloggen binnen één stap op het startscherm met een bruikbaar vraagveld.
- **SC-002**: Een adviseur start vanuit een getypte vraag in maximaal twee handelingen (typen en versturen, inclusief assistentkeuze) een gesprek waarin de vraag als eerste bericht staat.
- **SC-003**: In 0 gevallen is de startvraag terug te vinden in het adres, localStorage/sessionStorage/cookies, analytics of logs — verifieerbaar over de volledige startflow.
- **SC-004**: Het startscherm toont altijd precies de vijf meest recente gesprekken en de vijf meest recente analyses (of minder als er minder bestaan), elk met de juiste status of datum.
- **SC-005**: 100% van de gesprekken in Geschiedenis opent de gesprekspagina waar verder chatten mogelijk is; 100% van de analyses opent de bijbehorende analysepagina.
- **SC-006**: Zoeken versmalt de geladen lijst binnen één seconde na de laatste toetsaanslag, met nul netwerkverzoeken die de zoekterm bevatten.
- **SC-007**: De volledige bediening van het startscherm en Geschiedenis — vraag typen, assistent kiezen, versturen, tabbladen wisselen, zoeken, een rij openen en een zoekterm wissen — is zonder muis uitvoerbaar met Tab en Enter.
- **SC-008**: 100% van de lege toestanden (geen gesprekken, geen analyses, geen zoekresultaat, geen chat-assistent) bevat een korte uitleg én een concrete actie.
- **SC-009**: De bestaande end-to-enddekking van chat, analyse en geschiedenis blijft groen na de route- en navigatiewijzigingen (0 falende tests; geen dekking geschrapt).

## Assumptions

- Het startscherm vervangt het Command Center als landingspagina na inloggen; de exacte route (bijvoorbeeld de root) is een planbeslissing. De oude route /command-center blijft bestaan als doorverwijzing, zodat bestaande links en bladwijzers blijven werken.
- De tellers en de placeholder "Taken" van het Command Center verdwijnen volledig; beheerdersstatistieken zijn buiten scope.
- Alleen actieve assistenten van het type chat zijn kiesbaar op het startscherm. Risico-analyse-assistenten worden niet als chatkeuze aangeboden.
- Bij meerdere risico-analyse-assistenten leidt "Nieuwe risico-analyse" naar een keuze of het bestaande assistentenoverzicht; de exacte vorm is een plan- en ontwerpbeslissing en valt binnen de bestaande analyseflow.
- De overzichten op het startscherm hergebruiken de bestaande gegevensbronnen en limieten (gesprekken van de ingelogde gebruiker, recente analyses van de ingelogde adviseur); de feature introduceert geen nieuwe backendcontracten.
- De Geschiedenis-pagina behoudt de bestaande laadlimiet voor de lijsten. Zoeken werkt op de al geladen lijst; items buiten die limiet zijn via de bestaande lijstmechanismen bereikbaar, niet via zoeken.
- "Klantreferentie" is een gegeven van een risico-analyse; gesprekken hebben een titel. Zoeken filtert per tabblad op het bijbehorende veld.
- De chatpagina en de analysepagina blijven inhoudelijk ongewijzigd. De enige aanpassing aan de chatpagina is het eenmalig ontvangen en versturen van de startvraag via tijdelijk geheugen, zonder wijziging van het bestaande chatgedrag of de weergave.
- De vraag wordt bij versturen direct als eerste bericht verzonden; er is geen tussenstap waarin de adviseur de vraag op de chatpagina opnieuw moet bevestigen.
- De zoekterm wordt niet bewaard: bij het verlaten of herladen van Geschiedenis begint de adviseur met een lege zoekterm. Ook de zoekterm komt niet in browseropslag terecht.
- Statuslabels voor analyses worden in begrijpelijk Nederlands getoond (wachtrij, bezig, klaar, mislukt), consistent met de bestaande analyseweergave.
- Buiten scope: tellers of statistieken voor beheerders, filters naast zoeken, en wijzigingen aan de chat- of analysepagina (afgezien van het eenmalig doorgeven van de startvraag).
