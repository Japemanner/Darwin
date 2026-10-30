# Feature Specification: Risico-analyse als eigen pagina, met soepelere invoer

**Feature Branch**: `014-risk-analysis-page`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Risico-analyse als eigen pagina, met soepelere invoer. Huidige situatie: De risico-analyse draait in een zijpaneel (src/components/analysis/AnalysisFlow.tsx). Een analyse duurt 1 tot 3 minuten; wie het paneel sluit, ziet nergens dat de analyse klaar is. Recente analyses staan alleen in een lijst binnen het formulier. Het formulier begint met het vraagstuk en de klantreferentie staat onderaan, terwijl een adviseur vanuit de klant denkt. De kennisbronnenkeuze ('De selectie bepaalt het verzekeringstype') is systeemlogica; de adviseur moet zelf bronnen aanvinken. 'Opnieuw' na een mislukte analyse vult het formulier opnieuw, maar laat bijlagen zonder melding weg. De vervaldatum van een resultaat (7 dagen) staat alleen klein in het resultaat zelf. User stories: 1. (P1) Als adviseur start ik een analyse op een eigen pagina en volg ik de status op een eigen adres per analyse. Ik kan wegnavigeren en via dat adres of de lijst terugkeren. 2. (P1) Overal in de app zie ik in de zijbalk hoeveel van mijn analyses sinds mijn laatste bezoek klaar of mislukt zijn; de titel van het browsertabblad toont dat aantal. 3. (P1) In het formulier staat Klantreferentie bovenaan. Adviseur staat als vaste tekst in de kop. 4. (P2) Alle kennisbronnen van de assistent zijn standaard aangevinkt; ik kan er een uitzetten. 5. (P2) Bij 'Opnieuw' zie ik de melding dat bijlagen niet bewaard zijn en opnieuw toegevoegd moeten worden. 6. (P2) In de lijst met recente analyses zie ik per analyse tot wanneer het resultaat beschikbaar is. 7. (P3) Ik kan bestanden ook naar het uploadvak slepen, en het veld Verzekeringsvraagstuk toont een voorbeeldtekst. Acceptatiecriteria: Adressen bevatten alleen run-id's en assistent-id's, nooit klantreferentie of inhoud (constitution III). De tabbladtitel bevat nooit een klantreferentie. Het CONCEPT-label blijft overal staan waar het nu staat (constitution II). De statusindicator pollt alleen zolang er lopende analyses zijn. Slepen en neerzetten heeft een toetsenbordalternatief: de bestaande knop blijft. De bestaande Playwright-tests in tests/e2e/analysis-*.spec.ts blijven slagen, aangepast aan de nieuwe routes waar nodig. Buiten scope: wijzigingen aan het backendcontract (behalve het veld expires_at in de lijst, zie plan), de inhoud van het resultaat, de Geschiedenis-pagina."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Eigen pagina met vast adres per analyse (Priority: P1)

Als adviseur start ik een risico-analyse vanaf een eigen pagina en volg ik de voortgang op een vast adres dat bij deze ene analyse hoort. Het formulier en de statusweergave verhuizen uit het tijdelijke zijpaneel naar die pagina: wie wegnavigeert — naar een andere pagina in de app, een andere tab of een uur later terugkeert — verliest niets. Terugkeren kan via het adres zelf (herladen, browserterug, bladwijzer) of via de lijst met recente analyses. De statuspagina toont zolang de analyse loopt de bestaande statusinformatie (wachtrij, bezig, verstreken tijd) en zodra de analyse klaar is het resultaat, ongewijzigd aan de huidige weergave.

**Why this priority**: Een analyse duurt 1 tot 3 minuten. Nu betekent het sluiten van het paneel het verlies van elk zicht op de voortgang, en meldt de app nergens dat de analyse klaar is. Het vaste adres is de oplossing voor het grootste productprobleem: de analyse overleeft navigatie.

**Independent Test**: Volledig te testen door een analyse te starten, weg te navigeren, en daarna terug te keren via het adres én via de lijst: in beide gevallen toont de pagina de actuele status van dezelfde analyse.

**Acceptance Scenarios**:

1. **Given** een risico-analyse-assistent, **When** de adviseur de analyse start vanuit de assistent, **Then** opent de eigen analysepagina om het formulier in te vullen (het zijpaneel bestaat niet meer).
2. **Given** een ingediende analyse, **When** de analyse is gestart, **Then** opent het vaste adres van die analyse (uitsluitend run-id, eventueel assistent-id — nooit klantreferentie of inhoud, constitution III) met de statusweergave.
3. **Given** een lopende analyse, **When** de adviseur wegnavigeert en later via het adres terugkeert (herladen, browserterug, bladwijzer), **Then** is op hetzelfde adres de actuele status zichtbaar.
4. **Given** de lijst met recente analyses, **When** de adviseur op een analyse klikt, **Then** opent de statuspagina van die analyse op het vaste adres.
5. **Given** een adres van een analyse die niet bestaat of niet van de adviseur is, **When** het wordt geopend, **Then** volgt een nette melding ("niet gevonden"/"geen toegang") zonder enige inhoud van anderen.
6. **Given** een geslaagde analyse, **When** de adviseur de statuspagina bekijkt, **Then** is het resultaat daar te bekijken, inhoudelijk ongewijzigd aan de huidige weergave inclusief alle bestaande CONCEPT-labels (constitution II).

---

### User Story 2 - Klaar-meldingen in de zijbalk en tabbladtitel (Priority: P1)

Als adviseur werk ik na het starten van een analyse elders in de app verder. Overal zie ik in de zijbalk hoeveel van mijn analyses sinds mijn laatste bezoek klaar of mislukt zijn, en de titel van het browsertabblad toont datzelfde aantal — ook als ik in een ander tabblad of een andere applicatie aan het werk ben en even terugkeert. Zodra ik mijn analyses bekijk, is de telling gereset en wacht hij op nieuwe afrondingen.

**Why this priority**: Dit is de compensatie voor de wachttijd van 1 tot 3 minuten: de adviseur hoeft niet meer in het paneel te blijven wachten en krijgt vanzelf te zien dat er iets klaarstaat. Zonder deze story lost het vaste adres alleen het verlies op, niet de zichtbaarheid.

**Independent Test**: Volledig te testen door analyses te laten afronden terwijl de adviseur op een andere pagina is: de zijbalk en de tabbladtitel tonen het aantal; na het bekijken van de analyses is de telling weg.

**Acceptance Scenarios**:

1. **Given** een of meer analyses van de adviseur zijn klaar of mislukt sinds zijn laatste bezoek, **When** de adviseur zich ergens in de app bevindt, **Then** toont de zijbalk bij de analyses-verwijzing het aantal van deze analyses.
2. **Given** hetzelfde aantal ongeziene afrondingen, **When** de adviseur het browsertabblad bekijkt, **Then** toont de tabbladtitel dat aantal (en nooit een klantreferentie of andere klantinhoud — constitution III).
3. **Given** de adviseur bekijkt zijn analyses (de lijst of een statuspagina), **When** hij daarna elders in de app verder werkt, **Then** is de telling gereset naar nul totdat er nieuwe analyses afgerond zijn.
4. **Given** er zijn geen ongeziene afrondingen, **When** de zijbalk en tabbladtitel worden getoond, **Then** toont geen van beide een aantal (geen lege "0").
5. **Given** er lopen analyses (wachtrij of bezig), **When** de app actief is, **Then** controleert de statusindicator de status van die analyses; **Given** er lopen géén analyses, **Then** voert de indicator geen statusverzoeken uit (pollen alleen zolang er lopende analyses zijn).

---

### User Story 3 - Formulier: Klantreferentie bovenaan, Adviseur in de kop (Priority: P1)

Als adviseur denk ik vanuit de klant. Daarom staat Klantreferentie bovenaan het formulier — het eerste veld dat ik invul — en volgt daarna pas het verzekeringsvraagstuk. De adviseursnaam staat als vaste tekst in de kop van de analysepagina: ik ben ingelogd, dus het systeem weet wie ik ben; het invoerveld onderaan het formulier verdwijnt.

**Why this priority**: De veldvolgorde bepaalt de eerste indruk van elke analyse; de klant-referentie bovenaan maakt direct duidelijk over wie het gaat en maakt hergebruik van eerdere invoer makkelijker. Dit is een lichte wijziging met direct dagelijks effect.

**Independent Test**: Volledig te testen door een nieuwe analyse te openen: het eerste veld is Klantreferentie, de kop toont de adviseurnaam als vaste tekst en het oude invoerveld "Adviseur" onderaan bestaat niet meer.

**Acceptance Scenarios**:

1. **Given** een nieuw analysescherm, **When** het formulier opent, **Then** staat Klantreferentie als eerste veld bovenaan, vóór het verzekeringsvraagstuk.
2. **Given** de analysepagina, **When** de kop zichtbaar is, **Then** staat de naam van de ingelogde adviseur als vaste tekst in de kop — niet als invoerveld.
3. **Given** het formulier, **When** ingevuld en verzonden, **Then** gelden de bestaande validatieregels ongewijzigd (verplichte klantreferentie, verplicht vraagstuk, groepsvalidatie) — alleen de volgorde en de presentatie van de adviseurnaam zijn gewijzigd.

---

### User Story 4 - Kennisbronnen standaard aangevinkt (Priority: P2)

Als adviseur hoef ik bij een nieuwe analyse geen kennisbronnen meer te zoeken en aan te vinken: alle kennisbronnen van de assistent staan standaard aangevinkt. Ik denk per klant na en vink hooguit de bronnen úít die ik voor deze analyse niet wil meenemen. De systeemlogica-tekst ("De selectie bepaalt het verzekerings­type") verdwijnt: de keuze is aan mij en de app dringt geen interpretatie op.

**Why this priority**: De meeste analyses gebruiken alle beschikbare bronnen; nu kost elke start onnodige kliks en introduceert de hint-verwarring. Minder frictie dan de P1-stories, maar duidelijke dagelijkse winst.

**Independent Test**: Volledig te testen door een nieuwe analyse te openen: alle gekoppelde kennisbronnen staan aangevinkt; één uitzetten en starten levert een analyse met precies de overgebleven selectie.

**Acceptance Scenarios**:

1. **Given** een nieuwe analyse met N kennisbronnen gekoppeld aan de assistent, **When** het formulier opent, **Then** staan alle N kennisbronnen aangevinkt.
2. **Given** de aangevinkte bronnen, **When** de adviseur één of meer bronnen uitzet en start, **Then** draait de analyse met precies de overgebleven selectie; de bestaande regel "minimaal één kennisbron" blijft gehandhaafd.
3. **Given** het kennisbronnenonderdeel, **When** zichtbaar, **Then** is de systeemlogica-tekst ("De selectie bepaalt het verzekerings­type") niet meer aanwezig.
4. **Given** "Opnieuw" na een mislukte analyse, **When** het formulier herstelt, **Then** staan precies de bronnen aangevinkt die in die eerdere poging geselecteerd waren — de standaard-alles-aangevinkt geldt alleen voor nieuwe analyses.

---

### User Story 5 - Melding bij "Opnieuw": bijlagen niet bewaard (Priority: P2)

Als adviseur klik ik na een mislukte analyse op "Opnieuw". Het formulier vult zich met de eerdere invoer — maar bijlagen kunnen niet bewaard worden en dat hoor en zie ik nu duidelijk: een melding vertelt dat de bijlagen niet zijn bewaard en opnieuw toegevoegd moeten worden. Ik voorkom zo dat ik ongemerkt een hernieuwde analyse start zonder de documenten erbij.

**Why this priority**: Het stille verlies van bijlagen leidt tot onvolledige analyses die pas bij het resultaat opvallen — fouten die de melding voorkomt. Kleine wijziging, groot risico dat wordt weggenomen.

**Independent Test**: Volledig te testen door een mislukte analyse mét bijlagen te herstarten met "Opnieuw": de melding verschijnt en het bestandslijstje is leeg; dezelfde poging zonder bijlagen toont géén melding.

**Acceptance Scenarios**:

1. **Given** een mislukte analyse die was gestart mét bijlagen, **When** de adviseur op "Opnieuw" klikt, **Then** keert het formulier terug met de eerdere invoer én een duidelijke melding dat bijlagen niet zijn bewaard en opnieuw toegevoegd moeten worden.
2. **Given** een mislukte analyse die zónder bijlagen was gestart, **When** de adviseur op "Opnieuw" klikt, **Then** verschijnt géén bijlagen-melding.
3. **Given** de bijlagen-melding, **When** de adviseur zonder nieuwe bijlagen opnieuw start, **Then** kan de analyse gewoon gestart worden (mits de bestaande groepsvalidatie slaagt) — de melding is informatief en blokkeert niet.

---

### User Story 6 - Vervaldatum van het resultaat in de lijst (Priority: P2)

Als adviseur zie ik in de lijst met recente analyses per analyse tot wanneer het resultaat beschikbaar is. De bewaartermijn van zeven dagen staat nu alleen klein in het resultaat zelf; in de lijst weet ik niet welke resultaten ik binnenkort mis. Met de vervaldatum in de lijst kan ik op tijd downloaden wat ik wil bewaren.

**Why this priority**: Belangrijk voor werkvoorbereiding maar niet blokkerend voor de kernproblemen (zichtbaarheid en invoer). Hiervoor is de enige backendcontractwijziging nodig: de lijst krijgt het veld expires_at erbij.

**Independent Test**: Volledig te testen door de lijst te openen na een geslaagde analyse: de rij toont de datum tot wanneer het resultaat beschikbaar is, overeenkomstig de termijn die ook in het resultaat zelf staat.

**Acceptance Scenarios**:

1. **Given** een geslaagde analyse in de lijst, **When** de rij zichtbaar is, **Then** toont de rij tot wanneer (datum) het resultaat beschikbaar is.
2. **Given** een analyse in de wachtrij, bezig of mislukt, **When** de rij zichtbaar is, **Then** toont de rij géén vervaldatum (er is nog geen resultaat).
3. **Given** de bestaande rij-informatie (herkenning, status, starttijd), **When** de vervaldatum erbij komt, **Then** blijft de bestaande informatie ongewijzigd aanwezig.
4. **Given** de lijst, **When** een resultaat verlopen is, **Then** blijft de analyse in de lijst staan en toont de statuspagina de bestaande verwijdermelding van het resultaat (resultaatinhoud buiten scope, bestaand gedrag).

---

### User Story 7 - Bestanden slepen en voorbeeldtekst (Priority: P3)

Als adviseur sleep ik documenten direct op het uploadvak in plaats van via de knop te bladeren — met dezelfde controles en meldingen als voorheen. De bestaande knop "Bestanden kiezen" blijft bestaan als toetsenbordalternatief. En het lege veld Verzekeringsvraagstuk toont een voorbeeldtekst die mij helpt het vraagstuk scherp te formuleren.

**Why this priority**: Gemak en vindbaarheid, geen blokkerende tekortkoming; de knop blijft volwaardig werken.

**Independent Test**: Volledig te testen door een bestand op het uploadvak te slepen (het wordt toegevoegd) en te controleren dat het lege vraagstukveld een voorbeeldtekst toont.

**Acceptance Scenarios**:

1. **Given** het bestandsonderdeel, **When** de adviseur bestanden op het uploadvak sleept en loslaat, **Then** worden die bestanden toegevoegd, met dezelfde controles (toegestane typen, maximale groottes) en dezelfde foutmeldingen als via de knop.
2. **Given** gesleepte bestanden die niet voldoen (verkeerd type of te groot), **When** ze worden losgelaten, **Then** volgt dezelfde foutmelding als bij de knop en gebeurt er niets met de bestanden.
3. **Given** de bestandskeuze, **When** met het toetsenbord gewerkt wordt, **Then** blijft de bestaande knop volledig functioneren als toetsenbordalternatief (acceptatiecriterium).
4. **Given** het veld Verzekeringsvraagstuk, **When** het veld leeg is, **Then** toont het veld een voorbeeldtekst die de adviseur helpt het vraagstuk te formuleren; zodra getypt wordt, verdwijnt de voorbeeldtekst (standaardgedrag van voorbeeldteksten).

---

### Edge Cases

- **Twee of meer analyses tegelijk**: elke analyse heeft zijn eigen adres; de telling in zijbalk/tabbladtitel telt alle afrondingen sinds het laatste bezoek; zolang er minstens één loopt, blijft de statusindicator actief.
- **Eerste gebruik ooit** ("laatste bezoek" bestaat nog niet): de telling begint bij de afrondingen na de eerste keer bekijken; analyses van vóór de eerste sessie tellen niet.
- **Alle kennisbronnen uitgevinkt**: de bestaande validatie ("Selecteer minimaal één kennisbron") blokkeert het starten — ongewijzigd gedrag.
- **"Opnieuw" na een mislukte poging mét bijlagen en mét klantsituatie-tekst**: formulier herstelt tekst en bronselectie, bijlagen blijven weg mét de nieuwe melding; de groepsvalidatie slaagt via de herstelde tekst.
- **Direct geopend adres van een verlopen resultaat**: de statuspagina toont de bestaande automatische-verwijdermelding van het resultaat; de run-informatie (status, starttijd) blijft zichtbaar — bestaand gedrag, ongewijzigd.
- **Adres met ongeldig run-id-formaat**: dezelfde nette niet-gevonden-behandeling als een onbekend id — geen technische foutmelding.
- **Statusindicatie zonder lopende analyses**: er vinden géén periodieke statusverzoeken plaats; het openen van een statuspagina haalt de status op bij binnenkomst (acceptatiecriterium polling).
- **Slepen van een map of ongeldig item op het uploadvak**: geen toevoeging, dezelfde nette afhandeling als een geweigerd bestand.
- **Gelijktijdig openstaande tabbladen**: de tabbladtitel toont de telling zoals die gold bij de laatste statusupdate van dat tabblad; geen live synchronisatie tussen tabbladen onderling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Het systeem MOET de risico-analyse draaien op een eigen pagina (het zijpaneel verdwijnt) en per analyse een vast adres met de statusweergave bieden.
- **FR-002**: Adressen van analyses MOETEN uitsluitend run-id's en assistent-id's bevatten — nooit klantreferentie, vraagstuk of andere klantinhoud (constitution III).
- **FR-003**: Het systeem MOET de adviseur via het vaste adres (herladen, browserterug, bladwijzer) én via de lijst met recente analyses naar de statuspagina van een analyse laten terugkeren, zonder verlies van status of resultaat.
- **FR-004**: Het systeem MOET bij een onbekend adres of een analyse van een andere adviseur een nette melding tonen zonder enige inhoud van anderen.
- **FR-005**: De zijbalk MOET overal in de app het aantal analyses tonen dat sinds het laatste bezoek van de adviseur klaar of mislukt is, en de tabbladtitel MOET datzelfde aantal tonen; geen van beide toont ooit een klantreferentie of klantinhoud (constitution III).
- **FR-006**: De telling MOET resetten zodra de adviseur zijn analyses bekijkt, en MOET géén aantal tonen zodra er niets ongeziens is afgerond.
- **FR-007**: De statusindicator MOET uitsluitend pollen zolang er lopende analyses (wachtrij/bezig) zijn; zonder lopende analyses vinden geen periodieke statusverzoeken plaats.
- **FR-008**: Het formulier MOET Klantreferentie als eerste veld tonen en de naam van de ingelogde adviseur als vaste tekst in de kop van de analysepagina; het invoerveld Adviseur onderaan verdwijnt.
- **FR-009**: Bij een nieuwe analyse MOETEN alle kennisbronnen van de assistent standaard aangevinkt zijn, uitzetten moet kunnen, en MOET de systeemlogica-tekst verdwijnen; bij "Opnieuw" herstelt de eerdere selectie.
- **FR-010**: "Opnieuw" na een mislukte analyse MOET een duidelijke melding tonen dat bijlagen niet zijn bewaard en opnieuw toegevoegd moeten worden — alleen als de eerdere poging bijlagen had; de melding blokkeert niet.
- **FR-011**: De lijst met recente analyses MOET per geslaagde analyse tot wanneer het resultaat beschikbaar is tonen (toevoeging van expires_at aan de lijst — de enige toegestane backendcontractwijziging).
- **FR-012**: Het systeem MOET bestanden via slepen-en-neerzetten op het uploadvak accepteren met identieke controles en meldingen; de bestaande knop blijft het toetsenbordalternatief.
- **FR-013**: Het veld Verzekeringsvraagstuk MOET zolang het leeg is een voorbeeldtekst tonen.
- **FR-014**: Alle bestaande CONCEPT-labels MOETEN ongewijzigd blijven (constitution II); de resultaatinhoud zelf blijft buiten scope.
- **FR-015**: De bestaande Playwright-tests voor de analyse (tests/e2e/analysis-*.spec.ts) MOETEN blijven slagen, aangepast aan de nieuwe routes waar nodig.
- **FR-016**: Alle nieuwe onderdelen (badge in de zijbalk, tabbladtitelaanvulling, sleepinteractie) MOETEN voldoen aan WCAG 2.1 AA — toetsenbordbediening, geen kleur-only signalen (het aantal is als tekst zichtbaar), focusstates en contrast.

### Key Entities

- **Analyse (run)**: één analyse-opdracht; kent een id (run-id), de assistent, een status (in wachtrij, bezig, klaar, mislukt), starttijd, foutcode/-melding bij mislukken en — bij een resultaat — een vervaldatum (bewaartermijn van zeven dagen). De klantreferentie hoort bij de analyse maar verschijnt uitsluitend als tekst in de app-UI, nooit in adressen of de tabbladtitel.
- **Lijstitem recente analyse**: de rij in de lijst met recente analyses: herkenning (klantreferentie), status, starttijd en — nieuw — de vervaldatum van het resultaat.
- **Telling ongeziene afrondingen**: het aantal analyses van de adviseur dat sinds zijn laatste bezoek klaar of mislukt is; zichtbaar in de zijbalk en tabbladtitel; reset bij het bekijken van de analyses. (Hoe het "laatste bezoek" bewaard wordt is een planbeslissing binnen constitution III: geen klantinhoud, geen browseropslag buiten de sessie.)
- **Formulierinvoer**: klantreferentie (verplicht, eerste veld), verzekeringsvraagstuk (verplicht, met voorbeeldtekst), kennisbronselectie (nieuwe analyses: alles standaard; "Opnieuw": eerdere selectie), klantsituatie, bijlagen (uitsluitend binnen de sessie bewaard), URL's; de adviseurnaam komt vast uit het ingelogde profiel.
- **Vast analyse-adres**: het adres van de statuspagina van één analyse, opgebouwd uitsluitend uit run-id (en assistent-id voor een nieuwe analyse).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% van de analyses heeft een vast adres met uitsluitend run-/assistent-id's; herladen of terugkeren via de lijst toont de actuele status zonder informatieverlies.
- **SC-002**: De adviseur ziet op elke pagina van de app het aantal sinds het laatste bezoek afgeronde ongeziene analyses, in de zijbalk én in de tabbladtitel; na het bekijken van de analyses is de telling weg (0 zonder "0"-weergave).
- **SC-003**: Geen enkel analyse-adres en geen tabbladtitel bevat ooit klantreferenties of klantinhoud — verifieerbaar over alle routes en schermtoestanden (constitution III).
- **SC-004**: Bij een nieuwe analyse starten zijn alle kennisbronnen standaard geselecteerd: het aantal handelingen voor de bronselectie daalt van N aanvinkacties naar 0 (uitvinken alleen op verzoek).
- **SC-005**: Bij elke "Opnieuw" van een mislukte analyse mét bijlagen verschijnt de bijlagen-melding (100% van de gevallen); zonder eerdere bijlagen verschijnt ze nooit.
- **SC-006**: 100% van de geslaagde analyses in de lijst toont de vervaldatum van het resultaat; overige status tonen geen vervaldatum.
- **SC-007**: Zolang er geen lopende analyses zijn, voert de app nul periodieke statusverzoeken uit (pollen uitsluitend bij lopende analyses).
- **SC-008**: De volledige analyse-flow — starten, wegnavigeren, terugkeren, bestanden slepen én kiezen, opnieuw proberen — is volledig met het toetsenbord uitvoerbaar.
- **SC-009**: De geautomatiseerde end-to-enddekking van de analyseflow slaagt na aanpassing aan de nieuwe routes (0 falende gevallen); geen enkele bestaande dekking wordt geschrapt.

## Assumptions

- Starten van een analyse blijft gebeuren vanuit de assistentenpagina: de bestaande actie op een risico-analyse-assistent navigeert naar de analysepagina voor een nieuwe run; het huidige zijpaneel verdwijnt volledig.
- De lijst met recente analyses blijft inhoudelijk bestaan (nu op de analysepagina) en krijgt een vaste, altijd bereikbare plek via een analyses-verwijzing in de zijbalk — dat is de natuurlijke plek voor de badge uit US2; de exacte plaatsing en vorm zijn plan- en ontwerpbeslissingen.
- "Laatste bezoek" is het laatste moment waarop de adviseur zijn analyses bekeek (lijst of statuspagina); bekijken reset de telling. Het bewaren van dat moment (sessie- of serverzijds) is een planbeslissing binnen constitution III (geen klantinhoud, niets in browseropslag buiten de sessie).
- De telling en de tabbladtitel tonen uitsluitend het aantal in een neutraal formaat (bijvoorbeeld "(2) <appnaam>"); de exacte opmaak is ontwerpkeuze.
- De adviseurnaam in de kop is de naam van de ingelogde gebruiker (profiel); geen invoer, geen keuze.
- Bijlagen zijn om privacyredenen bewust niet bewaarbaar buiten de sessie (constitution III) — daarom kiest de feature voor een duidelijke melding bij "Opnieuw" in plaats van bewaren.
- De vervaldatum in de lijst komt uit het bestaande veld expires_at van een run; het toevoegen van dit veld aan de lijst-API is de enige backendcontractwijziging die de gebruiker expliciet toestaat. Voor wachtrij/bezig/mislukte analyses wordt geen vervaldatum getoond.
- Alle bestaande validatieregels (verplichte klantreferentie, verplicht vraagstuk, minimaal één kennisbron, groepsvalidatie) blijven ongewijzigd gelden; alleen volgorde, standaardselectie en presentatie wijzigen.
- De resultaatweergave, het download-label en alle CONCEPT-markeringen blijven inhoudelijk ongewijzigd (constitution II; resultaatinhoud is buiten scope).
- De voorbeeldtekst voor het verzekeringsvraagstuk is een concreet Nederlands voorbeeld (placeholder); de exacte tekst wordt in de planfase vastgesteld.
- Gelijktijdig openstaande tabbladen synchroniseren de tabbladtitel niet live onderling; elk tabblad toont de telling bij zijn laatste statusupdate.
- Buiten scope: verdere backendcontractwijzigingen, de inhoud van het resultaat en de Geschiedenis-pagina (chatgesprekken) — deze blijven onaangeroerd.