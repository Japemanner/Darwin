# Feature Specification: Antwoorden leesbaar, controleerbaar en als CONCEPT gemarkeerd

**Feature Branch**: `013-readable-verifiable-answers`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Antwoorden leesbaar, controleerbaar en als CONCEPT gemarkeerd. Huidige situatie: Antwoorden worden als HTML gesaniteerd (src/components/chat/MessageContent.tsx met sanitizeHtml), maar n8n levert platte tekst of markdown. Het resultaat is één lap tekst met losse sterretjes. Gebruikersberichten gaan door dezelfde HTML-sanitizer; ingetypte tags worden als opmaak getoond. Bij elke bron staat een percentage (bijvoorbeeld 100%). Dat is de zelfbeoordeling van het taalmodel en geen betrouwbaarheid, maar adviseurs lezen het wel zo. Het verificatie-oordeel van n8n (grounded, confidence, issues) wordt niet getoond. Chatantwoorden dragen geen CONCEPT-label, terwijl constitution II dat voor elke gegenereerde output eist. Bronnen zijn een uitklaplijst met titel en fragment; een bron rustig bekijken kan niet. User stories: 1. (P1) Als adviseur zie ik antwoorden met opmaak: alinea's, opsommingen, vet en tabellen. 2. (P1) Elk antwoord draagt zichtbaar het label CONCEPT. 3. (P1) Is een antwoord niet volledig onderbouwd door de bronnen, dan zie ik een duidelijke waarschuwing met de gevonden problemen. Bij een onderbouwd antwoord zie ik 'Gecontroleerd tegen de bronnen'. 4. (P1) Onder elk antwoord staan de bronnen als genummerde knoppen [1], [2] met de documentnaam. Een klik opent een zijpaneel met document, locatie (indien bekend) en de letterlijke passage. 5. (P2) Mijn eigen vraag zie ik precies zoals ik hem typte, met regeleinden. Acceptatiecriteria: Geen percentages of scores meer bij bronnen. Oude berichten zonder verificatiegegevens tonen geen verificatieregel en geen foutmelding. Markdown wordt gesaniteerd met de bestaande sanitizeMarkdown; links openen in een nieuw tabblad met rel='noopener noreferrer'. De waarschuwing verschijnt bij grounded = false of confidence < 0,7; de drempel is een constante in de code. Het bronpaneel is met het toetsenbord te openen en met Escape te sluiten; de focus keert terug naar de bronknop. Nieuwe UI-teksten bevatten geen aanbevelende formuleringen (constitution II). Buiten scope: wijzigingen aan n8n (bronverwijzingen in de tekst, paginanummers), de Geschiedenis-pagina."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Antwoorden met opmaak (Priority: P1)

Als adviseur stel ik een vraag en krijg ik een antwoord dat is opgemaakt zoals het bedoeld is: alinea's, opsommingen, vetgedrukte termen en tabellen. De assistent levert zijn antwoorden al met markdown-structuur, maar de chat toont die nu als één lap tekst met losse sterretjes. Na deze feature lees ik het antwoord zoals een zakelijk document: met witregels tussen alinea's, echte opsommingstekens, vetgedrukte kernbegrippen en netjes uitgelijnde tabellen.

**Why this priority**: Leesbaarheid is de basis van elke andere story. Een waarschuwing, een CONCEPT-label of een bronpaneel bovenop één onleesbare lap tekst blijft onleesbaar. De markdown-structuur is al aanwezig in de data; alleen de weergave is defect.

**Independent Test**: Volledig te testen door in een gesprek een vraag te stellen waarop het antwoord markdown bevat (opsomming, vetgedrukte term, tabel): het antwoord verschijnt met echte opmaak en zonder zichtbare markdown-symbolen.

**Acceptance Scenarios**:

1. **Given** een antwoord dat markdown bevat (alinea's, opsommingen, vet, tabel), **When** het antwoord wordt weergegeven, **Then** zijn alinea's, opsommingen, vetgedrukte tekst en tabellen als zodanig zichtbaar en zijn er geen losse markdown-symbolen (zoals sterretjes of hekjes) in de weergave.
2. **Given** een antwoord met een link in de markdown, **When** de adviseur de link activeert, **Then** opent de link in een nieuw tabblad met `rel="noopener noreferrer"`.
3. **Given** een antwoord met alleen platte tekst en regeleinden, **When** het wordt weergegeven, **Then** blijft de tekst leesbaar en behoudt hij zijn alinea-indeling.
4. **Given** een antwoord waarin HTML-achtige tekst voorkomt, **When** het wordt weergegeven, **Then** is die tekst gesanitiseerd volgens de bestaande markdown-sanitatie (sanitizeMarkdown) en veroorzaakt hij geen foutmelding.

---

### User Story 2 - CONCEPT-label op elk antwoord (Priority: P1)

Als adviseur zie ik bij elk gegenereerd antwoord zichtbaar het label CONCEPT. Constitution II eist dat elke gegenereerde output als concept is gemarkeerd; in de chat ontbreekt dat label nu volledig. Het label staat bij het antwoord zelf, zodat bij print, screenshot of teruglezen altijd duidelijk blijft dat het om een machinegegenereerd ontwerp gaat dat door de adviseur geaccordeerd moet worden — niet om een advies.

**Why this priority**: Constitution II is ononderhandelbaar: elk antwoord zonder label is een compliance-schending en suggereert onterecht een advieskarakter. Dit is een juridisch risico voor de organisatie.

**Independent Test**: Volledig te testen door een gesprek te openen en te controleren dat elk afgeronde antwoord het CONCEPT-label draagt — zowel direct na aankomst als na herladen van een bestaand gesprek.

**Acceptance Scenarios**:

1. **Given** een afgerond antwoord in de chat, **When** de adviseur het bekijkt, **Then** draagt het antwoord zichtbaar het label CONCEPT.
2. **Given** een bestaand gesprek dat opnieuw wordt geopend (herladen), **When** de adviseur de antwoorden bekijkt, **Then** dragen ook die oudere antwoorden het CONCEPT-label.
3. **Given** een bericht dat nog in behandeling is of mislukt is, **When** de adviseur het bekijkt, **Then** is er nog geen gegenereerde antwoordtekst zichtbaar en is dus geen label nodig; zodra het antwoord afgerond is, verschijnt het label.

---

### User Story 3 - Onderbouwing zichtbaar per antwoord (Priority: P1)

Als adviseur zie ik bij elk antwoord hoe het verificatie-oordeel luidt. Is het antwoord niet volledig onderbouwd door de bronnen, dan verschijnt een duidelijke waarschuwing waarin de gevonden problemen worden benoemd. Is het antwoord wél onderbouwd, dan lees ik "Gecontroleerd tegen de bronnen". Het percentage bij bronnen — de zelfbeoordeling van het taalmodel — verdwijnt; in plaats daarvan toont de chat het echte verificatie-oordeel (onderbouwd, betrouwbaarheidsindicatie, gevonden problemen) dat de assistent-service al meelevert maar nu onzichtbaar blijft.

**Why this priority**: Dit is de kern van controleerbaarheid. Adviseurs lezen de huidige percentages als betrouwbaarheid en nemen daardoor mogelijk onjuiste antwoorden over. Het echte oordeel is al beschikbaar; het ontbreekt alleen in de weergave.

**Independent Test**: Volledig te testen met antwoorden met verschillende verificatie-oordelen: een niet-onderbouwd antwoord toont de waarschuwing met problemen; een onderbouwd antwoord toont "Gecontroleerd tegen de bronnen"; een antwoord zonder verificatiegegevens toont geen enkele regel.

**Acceptance Scenarios**:

1. **Given** een antwoord met verificatie-oordeel grounded = false, **When** het wordt weergegeven, **Then** toont het antwoord een duidelijke waarschuwing met de gevonden problemen (issues).
2. **Given** een antwoord met grounded = true en confidence op of boven de drempel, **When** het wordt weergegeven, **Then** toont het antwoord de tekst "Gecontroleerd tegen de bronnen".
3. **Given** een antwoord met grounded = true maar confidence onder de drempel, **When** het wordt weergegeven, **Then** toont het antwoord de waarschuwing.
4. **Given** de waarschuwingsregel, **When** ontwikkelaars de drempel nalezen, **Then** is de drempel (0,7) een benoemde constante in de code.
5. **Given** een oud bericht zonder verificatiegegevens, **When** het wordt weergegeven, **Then** toont het bericht geen verificatieregel en geen foutmelding.
6. **Given** een oud bericht wél met verificatiegegevens (opgeslagen sinds de vorige feature), **When** het wordt weergegeven, **Then** gelden dezelfde regels als voor nieuwe antwoorden: waarschuwing of "Gecontroleerd tegen de bronnen".

---

### User Story 4 - Bronnen als genummerde knoppen met zijpaneel (Priority: P1)

Als adviseur zie ik onder elk antwoord de bronnen als genummerde knoppen [1], [2] met de documentnaam. Klik ik op een knop, dan opent een zijpaneel waarin ik de bron rustig nasla: de documentnaam, de locatie in het document (indien bekend) en de letterlijke passage. De huidige uitklaplijst met percentages en afgekapte fragmenten verdwijnt; een bron bekijken wordt een rustige, gerichte handeling naast de chat.

**Why this priority**: Bronverificatie is de kern van het beroep van de adviseur. Nu kan een bron niet kalm worden nagelezen (drie afgekapte regels) en suggereren percentages een betrouwbaarheid die ze niet hebben. De documentnaam direct op de knop maakt de antwoordbasis in één oogopslag zichtbaar.

**Independent Test**: Volledig te testen door in een antwoord met bronnen op bronknop [1] te klikken: het zijpaneel opent met documentnaam en letterlijke passage; Escape sluit het paneel en de focus keert terug naar de bronknop.

**Acceptance Scenarios**:

1. **Given** een antwoord met twee of meer bronnen, **When** het wordt weergegeven, **Then** staan onder het antwoord genummerde knoppen [1], [2] met per knop de documentnaam van de betreffende bron.
2. **Given** de bronknoppen onder een antwoord, **When** de adviseur een knop activeert (met muis of toetsenbord), **Then** opent een zijpaneel met de documentnaam, de locatie (indien bekend) en de letterlijke passage van die bron.
3. **Given** een geopend zijpaneel, **When** de adviseur opnieuw een (andere) bronknop activeert, **Then** toont het paneel de nieuw gekozen bron; er is nooit meer dan één paneel tegelijk open.
4. **Given** een geopend zijpaneel, **When** de adviseur Escape indrukt, **Then** sluit het paneel en keert de focus terug naar de bronknop die het paneel opende.
5. **Given** willekeurig welke bron in de chat, **When** de bronnen worden weergegeven, **Then** is bij geen enkele bron een percentage of score zichtbaar.

---

### User Story 5 - Eigen vraag letterlijk zichtbaar (Priority: P2)

Als adviseur zie ik mijn eigen vraag in de chat precies zoals ik die typte, met regeleinden. Nu worden ingetypte tags als opmaak geïnterpreteerd; mijn vraag verandert daarmee van inhoud en bij teruglezen weet ik niet meer wat ik precies heb gevraagd. Na deze feature is mijn vraag een letterlijke weergave van mijn invoer: regeleinden blijven staan en tekens zoals `<voorbeeld>` zijn zichtbaar als tekst, niet als opmaak.

**Why this priority**: De vraag is de context van het antwoord; een gewijzigde weergave ondermijnt de terugleesbaarheid van het gesprek. Dit is minder ernstig dan de defecten in de antwoordweergave zelf en daarom P2.

**Independent Test**: Volledig te testen door een vraag te sturen met meerdere regeleinden en een tag-achtige tekst erin: de getoonde vraag bevat beide letterlijk.

**Acceptance Scenarios**:

1. **Given** een vraag die is ingetypt met regeleinden, **When** de vraag is verstuurd, **Then** toont de chat de vraag letterlijk inclusief die regeleinden.
2. **Given** een vraag met HTML-achtige tekst (bijvoorbeeld `<b>test</b>`), **When** de vraag is verstuurd, **Then** toont de chat die tekens letterlijk als tekst en niet als opmaak.
3. **Given** een bestaand gesprek dat opnieuw wordt geopend, **When** de adviseur zijn eerdere vragen terugleest, **Then** blijven de vragen letterlijk zichtbaar zoals ze zijn verstuurd.

---

### Edge Cases

- **Antwoord zonder bronnen**: er verschijnen geen bronknoppen; het antwoord draagt gewoon het CONCEPT-label en de verificatieregel volgt de reguliere regels.
- **Niet-onderbouwd antwoord zonder benoemde problemen** (grounded = false met een lege issues-lijst): de waarschuwing verschijnt; de lijst met problemen wordt alleen getoond als er problemen zijn genoemd.
- **Bron zonder titel**: knop en paneel tonen een neutrale naam (zoals "Zonder titel") in plaats van een leeg veld.
- **Bron zonder passage**: het paneel toont de documentnaam; het passage-onderdeel ontbreekt zonder foutmelding.
- **Bron zonder locatie** (de huidige situatie, omdat locatiegegevens buiten scope van n8n liggen): het paneel toont documentnaam en passage; het locatie-onderdeel ontbreekt zonder foutmelding.
- **Zeer lange passage**: het zijpaneel is intern scrollbaar; de chat erachter blijft op zijn plaats.
- **Confidence exact op de drempel** (0,7) met grounded = true: er verschijnt géén waarschuwing — de waarschuwing geldt alleen bij confidence strikt ónder de drempel of grounded = false.
- **Antwoord met ongepaste HTML in de opmaak** (zoals een script-tag): de bestaande sanitatie verwijdert dit; er is geen foutmelding en de code wordt nooit uitgevoerd.
- **Verificatiegegevens in onverwacht formaat** (corrupt of incomplement): het bericht toont geen verificatieregel en geen foutmelding — het gedraagt zich als een bericht zonder verificatiegegevens.
- **Toetsenbordnavigatie langs meerdere bronnen**: elke bronknop is bereikbaar en activeerbaar met het toetsenbord; het paneel sluit met Escape met focusterugkeer naar de desbetreffende bronknop.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Het systeem MOET assistent-antwoorden weergeven met markdown-opmaak (alinea's, opsommingen, vetgedrukte tekst en tabellen), gesanitiseerd via de bestaande markdown-sanitatie (sanitizeMarkdown).
- **FR-002**: Het systeem MOET links in antwoorden laten openen in een nieuw tabblad met `rel="noopener noreferrer"`.
- **FR-003**: Het systeem MOET vragen van de gebruiker letterlijk weergeven — inclusief regeleinden — zonder enige HTML-interpretatie.
- **FR-004**: Het systeem MOET elk afgeronden assistent-antwoord een zichtbaar CONCEPT-label geven, zowel direct na aankomst als bij het opnieuw openen van een bestaand gesprek.
- **FR-005**: Het systeem MOET bij een antwoord met grounded = false of confidence strikt onder 0,7 een duidelijke waarschuwing tonen met de gevonden problemen (issues); de drempel 0,7 MOET vastliggen als een benoemde constante in de code.
- **FR-006**: Het systeem MOET bij een antwoord met grounded = true en confidence op of boven de drempel de tekst "Gecontroleerd tegen de bronnen" tonen.
- **FR-007**: Het systeem MOET berichten zonder (bruikbare) verificatiegegevens zonder verificatieregel en zonder foutmelding tonen.
- **FR-008**: Het systeem MOET bronnen onder elk antwoord tonen als genummerde knoppen ([1], [2], ...) met de documentnaam, en MOET géén percentages of scores bij bronnen tonen.
- **FR-009**: Het systeem MOET bij het activeren van een bronknop een zijpaneel openen met de documentnaam, de locatie (indien bekend) en de letterlijke passage van die bron.
- **FR-010**: Het systeem MOET het zijpaneel volledig met het toetsenbord bedienbaar maken: te openen via de bronknop, te sluiten met Escape, waarna de focus terugkeert naar de geactiveerde bronknop.
- **FR-011**: Het systeem MOET alle nieuwe UI-teksten vrij houden van aanbevelende of adviserende formuleringen (constitution II).
- **FR-012**: Het systeem MOET hooguit één zijpaneel tegelijk tonen; het activeren van een andere bronknop wisselt de getoonde bron.
- **FR-013**: Het systeem MOET voldoen aan WCAG 2.1 niveau AA voor alle nieuwe onderdelen (CONCEPT-label, waarschuwing, bronknoppen, zijpaneel): toetsenbordbediening, focusbeheer, contrast en semantische opmaak.

### Key Entities

- **Bericht**: één beurt in een gesprek; heeft een rol (adviseur of assistent), tekst, status (in behandeling, afgerond, mislukt), optioneel bronnen en — voor antwoorden — een optioneel verificatie-oordeel.
- **Bron**: een kennisdocument dat aan een antwoord ten grondslag ligt; kent een documentnaam, een letterlijke passage (fragment), optioneel een locatie in het document en een score uit de zoekresultaten (die niet meer wordt getoond).
- **Verificatie-oordeel**: het oordeel van de assistent-service over de onderbouwing van een antwoord; bestaat uit onderbouwd (grounded, ja/nee), een betrouwbaarheidsindicatie (confidence, getal tussen 0 en 1) en een lijst gevonden problemen (issues).
- **Zijpaneel** (UI-toestand): de momenteel geopende bron bij een antwoord, met de bronknop die het paneel opende (voor focusterugkeer).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% van de afgeronde antwoorden in de chat draagt een zichtbaar CONCEPT-label, direct na aankomst én na het herladen van een bestaand gesprek.
- **SC-002**: Elk antwoord mét verificatiegegevens toont exact één verificatieregel (waarschuwing met problemen, óf "Gecontroleerd tegen de bronnen"); elk antwoord zónder verificatiegegevens toont geen enkele verificatieregel en geen foutmelding.
- **SC-003**: Adviseurs openen elke bron binnen één handeling (klik of toetsaanslag) en kunnen de documentnaam en letterlijke passage lezen zonder de chat te verlaten.
- **SC-004**: In geen enkel gesprek is bij een bron nog een percentage of score zichtbaar (volledige afschaffing, geen uitzonderingen).
- **SC-005**: Antwoorden met structuuraanduidingen (alinea's, opsommingen, vet, tabellen) worden voor 100% als opgemaakte tekst weergegeven; er zijn geen zichtbare markdown-symbolen meer in antwoorden.
- **SC-006**: De volledige kernflow — vraag stellen, antwoord lezen, verificatieregel zien, bron openen, bron sluiten — is volledig met alleen het toetsenbord uitvoerbaar, inclusief sluiten met Escape en focusterugkeer.
- **SC-007**: De adviseur ziet zijn eigen vraag in 100% van de gevallen letterlijk zoals getypt, inclusief regeleinden.

## Assumptions

- Het CONCEPT-label sluit aan bij de bestaande formulieringsconventie in de risico-analyse ("CONCEPT, door adviseur te accorderen"); minimaal het woord CONCEPT is altijd zichtbaar. De exacte plaatsing (in de antwoordballon of direct ernaast) is een ontwerpbeslissing voor de planfase.
- Verificatiegegevens zijn al aanwezig in de berichtgegevens (meegeleverd door de chat-koppeling en sinds feature 012 opgeslagen bij elk bericht); er is geen nieuw backend-werk nodig om ze te tonen.
- De waarschuwingsdrempel is 0,7 voor confidence; grounded = false triggert de waarschuwing altijd, onafhankelijk van confidence.
- Bronnen bevatten op dit moment geen locatiegegevens; het paneel toont de locatie zodra beschikbaar en laat het onderdeel weg zodra niet beschikbaar (n8n-wijzigingen zijn buiten scope).
- De genummerde bronknoppen vervangen de huidige uitklapbare bronnenlijst volledig; de lijst met percentages verdwijnt.
- "Zijpaneel" betekent een paneel naast de chat waarin één bron in detail wordt getoond; de exacte layout (overlay, breedte, mobiele weergave) wordt bepaald in de planfase binnen de WCAG 2.1 AA-eis.
- De Geschiedenis-pagina wordt niet gewijzigd; alle wijzigingen gelden uitsluitend de chatweergave van berichten.
- Berichten die nog in behandeling zijn of mislukt zijn tonen nog geen antwoord en hebben daarom geen CONCEPT-label, verificatieregel of bronknoppen nodig.