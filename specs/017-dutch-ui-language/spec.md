# Feature Specification: Eenduidige Nederlandse UI-taal en navigatie

**Feature Branch**: `017-dutch-ui-language`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Eenduidige Nederlandse UI-taal en navigatie. Huidige situatie: Constitution I schrijft Nederlandse UI-tekst in u-vorm voor, maar de app gebruikt grotendeels de je-vorm ('Beheer je AI assistenten', 'Typ je bericht'). Er staan Engelse termen in de UI: 'Roadmap', 'runs', 'Error', en de rolwaarde 'admin'/'member' verschijnt letterlijk in de zijbalk. Roadmap staat tussen de werkpagina's in het hoofdmenu. User stories: (1) Alle UI-tekst is Nederlands in u-vorm. (2) Rollen heten overal 'Beheerder' en 'Adviseur' (zijbalk, Team). (3) Roadmap staat niet meer in het hoofdmenu maar in het gebruikersblok onderaan de zijbalk, als 'Ideeën en wensen'. Acceptatiecriteria: inventaris van alle gewijzigde teksten (oud → nieuw) in de spec-map; geen Engelse woorden in zichtbare UI-tekst behalve productnamen (Darwin, n8n); Playwright-tests die op tekst selecteren bijgewerkt en groen; geen gedragswijzigingen, alleen tekst en menupositie. Buiten scope: inhoud van assistentantwoorden, e-mailteksten van Supabase Auth, public/handleiding.html."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Alle UI-tekst is Nederlands in u-vorm (Priority: P1)

Als gebruiker lees ik op elk scherm Nederlandse tekst in de u-vorm: menu, paginatitels, knoppen, labels, plaatsaanduidingen, lege toestanden, meldingen, bevestigingsdialogen en schermlezerteksten. Geen enkele directe aanspreking staat in de je-vorm en er staan geen Engelse woorden in de tekst, met uitzondering van productnamen (Darwin, n8n) en de afgesproken technische termen.

**Why this priority**: De constitutie schrijft Nederlandse UI-tekst in u-vorm voor. Nu loopt de app op dit punt uit de pas: dezelfde gebruiker wordt op het ene scherm met "je" en op het andere met "u" aangesproken, en Engelse termen als "runs", "features" en "request" staan tussen de Nederlandse tekst. Dat maakt de app inconsistenter en minder professioneel dan bedoeld, en het is de basis van waaruit de andere twee verhalen pas betekenis hebben.

**Independent Test**: Volledig te testen door alle schermen in de app te doorlopen (inloggen, wachtwoord vergeten, wachtwoord opnieuw instellen, Overzicht, Assistenten, gesprek, risico-analyse, Geschiedenis, Kennisbronnen, Team, Instellingen, Ideeën en wensen) en de zichtbare en voorgelezen tekst te controleren op je-vorm en op Engelse woorden buiten de afgesproken lijst.

**Acceptance Scenarios**:

1. **Given** een willekeurig scherm in de app, **When** de tekst wordt gelezen, **Then** staat elke directe aanspreking in de u-vorm ("Beheer uw AI-assistenten", "Typ uw bericht", "Controleer uw inbox").
2. **Given** een willekeurig scherm in de app, **When** de tekst wordt gelezen, **Then** komt de je-vorm (je, jij, jouw, jullie, jezelf) nergens voor.
3. **Given** een willekeurig scherm in de app, **When** de tekst wordt gelezen, **Then** komt er geen Engels woord voor buiten de afgesproken productnamen en technische termen (zie Assumptions).
4. **Given** een melding, foutmelding of bevestigingsdialoog, **When** die verschijnt, **Then** is de volledige tekst Nederlands, ook wanneer de melding voortkomt uit een fout van een externe dienst.
5. **Given** een knop, label, plaatsaanduiding, schermlezertekst of tussentitel, **When** die wordt voorgelezen of getoond, **Then** is de tekst Nederlands en in de u-vorm; dit geldt ook voor tekst die alleen voor schermlezers bedoeld is.
6. **Given** het eerste menu-item en de bijbehorende pagina, **When** de gebruiker inlogt, **Then** heet dat item en de paginatitel "Overzicht" in plaats van "Command Center".
7. **Given** de Geschiedenis-pagina, **When** de gebruiker die opent, **Then** spreekt de tekst over "gesprekken" en niet over "runs".
8. **Given** een risico-analyse-uitvoering (recente uitvoeringen, uitvoeringskaart, uitvoeringspagina), **When** de gebruiker die ziet, **Then** spreekt de tekst over "uitvoeringen" en niet over "runs".

---

### User Story 2 - Rollen heten overal "Beheerder" en "Adviseur" (Priority: P1)

Als gebruiker zie ik in de zijbalk onder mijn naam mijn rol in het Nederlands: "Beheerder" of "Adviseur". Op de Teampagina zie ik bij elk teamlid en bij elke openstaande uitnodiging dezelfde Nederlandse rolnaam, en bij het uitnodigen van een collega kies ik uit "Adviseur" en "Beheerder". De onderliggende rolwaarden veranderen niet.

**Why this priority**: De rolwaarde "admin" of "member" staat nu letterlijk in de zijbalk en in Team. Dat is Engels en het is jargon dat de gebruiker niet hoort te zien. De rol bepaalt bovendien wie wat mag beheren, dus de naam moet op elke plek waar de rol zichtbaar is hetzelfde zijn; anders ontstaat verwarring over rechten.

**Independent Test**: Volledig te testen door in te loggen als beheerder en als adviseur: de zijbalk toont "Beheerder" respectievelijk "Adviseur", Team toont bij leden en uitnodigingen dezelfde namen, en de rolkeuze bij uitnodigen en bij het aanmaken van een organisatie toont "Adviseur" en "Beheerder".

**Acceptance Scenarios**:

1. **Given** een ingelogde beheerder, **When** de zijbalk onderaan wordt bekeken, **Then** staat daar "Beheerder" en niet "admin".
2. **Given** een ingelogde adviseur, **When** de zijbalk onderaan wordt bekeken, **Then** staat daar "Adviseur" en niet "member".
3. **Given** de Teampagina met teamleden, **When** de rollen worden bekeken, **Then** toont elk lid "Beheerder" of "Adviseur" en komt de ruwe rolwaarde nergens voor.
4. **Given** de Teampagina met openstaande uitnodigingen, **When** de rollen worden bekeken, **Then** tonen die dezelfde Nederlandse rolnaam als bij teamleden.
5. **Given** het uitnodigingsdialoog op de Teampagina, **When** de rolkeuze wordt geopend, **Then** zijn de opties "Adviseur" en "Beheerder", met "Adviseur" als standaardkeuze.
6. **Given** het scherm waarop een nieuwe organisatie met gebruiker wordt aangemaakt, **When** de rolkeuze wordt geopend, **Then** zijn de opties "Beheerder" en "Adviseur" en blijven de onderliggende rolwaarden ongewijzigd.
7. **Given** een gebruiker zonder rol, **When** de zijbalk wordt bekeken, **Then** staat er een Nederlandse melding ("Geen rol") en geen lege of Engelse waarde.

---

### User Story 3 - "Ideeën en wensen" staat in het gebruikersblok, niet in het hoofdmenu (Priority: P2)

Als gebruiker vind ik de Roadmap niet meer tussen de werkpagina's in het hoofdmenu. De ingang staat onderaan de zijbalk in het gebruikersblok, met het label "Ideeën en wensen", en brengt mij naar dezelfde pagina als voorheen.

**Why this priority**: Roadmap is geen werkpagina maar een feedbackkanaal. Tussen Assistenten, Kennisbronnen, Geschiedenis, Team en Instellingen trekt het aandacht weg van het dagelijks werk. De verplaatsing is klein maar maakt het menu rustiger en de bestemming logischer. Het is P2 omdat het de taal- en rolnamen niet blokkeert.

**Independent Test**: Volledig te testen door de zijbalk op desktop en op mobiel te openen: Roadmap staat niet in de lijst met werkpagina's, "Ideeën en wensen" staat in het gebruikersblok onderaan, en een klik opent dezelfde pagina als voorheen.

**Acceptance Scenarios**:

1. **Given** een ingelogde gebruiker op een scherm breder dan de mobiele onderbreking, **When** de zijbalk wordt bekeken, **Then** staat "Roadmap" niet tussen de werkpagina's en staat "Ideeën en wensen" in het gebruikersblok onderaan.
2. **Given** een ingelogde gebruiker op een smal scherm, **When** het uitklapmenu wordt geopend, **Then** geldt dezelfde indeling: geen Roadmap in het hoofdmenu, "Ideeën en wensen" in het gebruikersblok.
3. **Given** de ingang "Ideeën en wensen", **When** de gebruiker erop klikt, **Then** opent dezelfde pagina als voorheen, met dezelfde inhoud en dezelfde rechten.
4. **Given** de pagina "Ideeën en wensen", **When** die opent, **Then** gebruikt de paginatitel dezelfde naam als de menu-ingang en is de rest van de paginatekst Nederlands in de u-vorm.
5. **Given** de overige menu-items, **When** de zijbalk wordt bekeken, **Then** zijn hun volgorde, zichtbaarheid en werking ongewijzigd.

---

### Edge Cases

- **Foutmeldingen van externe diensten**: een dienst antwoordt met Engelse tekst (bijvoorbeeld een inlogfout of een netwerkfout). De gebruiker ziet een Nederlandse melding; de Engelstalige technische details verdwijnen uit beeld en de fouttoestand blijft zichtbaar (geen stil falen).
- **Schermlezertekst en verborgen labels**: tekst die alleen via een schermlezer of als toegankelijkheidsnaam beschikbaar is, telt mee als UI-tekst en moet ook Nederlands in de u-vorm zijn.
- **Lange Nederlandse samenstellingen**: vervangende teksten zoals "Ideeën en wensen" en "AI-assistenten" moeten leesbaar blijven zonder afkapping op smalle schermen en in de zijbalk.
- **Onbekende of ontbrekende rol**: een gebruiker zonder rol ziet "Geen rol" in plaats van een lege plek of een Engelse waarde.
- **Beheerder versus adviseur**: beide rollen zien dezelfde nieuwe teksten; de zichtbaarheid van menu-items en pagina's verandert niet.
- **Tests die op oude tekst selecteren**: bestaande tests die "Roadmap", "Admin", "Lid", "runs" of je-vormteksten gebruiken, falen na de wijziging. Ze moeten op de nieuwe tekst worden bijgewerkt zonder de controle zelf te verzwakken.
- **Pagina rechtstreeks openen**: de pagina "Ideeën en wensen" blijft bereikbaar via het bestaande adres, ook zonder via het menu te navigeren.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Alle zichtbare UI-tekst MUST in het Nederlands staan, in een zakelijke u-vorm, op alle schermen binnen de app: inloggen, wachtwoord vergeten, wachtwoord opnieuw instellen, zijbalk, Overzicht, Assistenten, gesprek, risico-analyse, Geschiedenis, Kennisbronnen, Team, Instellingen en Ideeën en wensen.
- **FR-002**: UI-tekst MUST de je-vorm vermijden. Vormen als "je", "jij", "jouw", "jullie" en "jezelf" mogen niet in zichtbare of voorgelezen tekst voorkomen.
- **FR-003**: UI-tekst MUST Nederlandse termen gebruiken in plaats van gewone Engelse woorden. "Command Center" wordt "Overzicht"; "Roadmap" wordt "Ideeën en wensen"; "runs" wordt per context "gesprekken" (Geschiedenis) of "uitvoeringen" (risico-analyses); "features" en "request" worden "ideeën", "wensen" en "verzoeken".
- **FR-004**: UI-tekst MAG alleen Engelse woorden bevatten die op de afgesproken lijst staan: productnamen (Darwin, n8n), de afkorting AI, en de technische termen webhook, URL, token, CORS, header, PDF en DOCX, plus letterlijke labels van de n8n-interface wanneer de app uitlegt welke instelling in n8n nodig is. Alle andere Engelse woorden MUST worden vertaald.
- **FR-005**: De zichtbare rolnaam MUST "Beheerder" zijn voor de beheerdersrol en "Adviseur" voor de adviesrol, op elke plek waar de rol zichtbaar is: zijbalk (desktop en mobiel), Teampagina bij leden, Teampagina bij openstaande uitnodigingen, rolkeuze bij uitnodigen en rolkeuze bij het aanmaken van een organisatie.
- **FR-006**: De opgeslagen rolwaarden MUST ongewijzigd blijven; alleen de weergegeven naam verandert.
- **FR-007**: "Ideeën en wensen" MUST in het gebruikersblok onderaan de zijbalk staan, in zowel de vaste zijbalk als het mobiele uitklapmenu, en MUST NIET meer in de lijst met werkpagina's staan.
- **FR-008**: De ingang "Ideeën en wensen" MUST naar dezelfde pagina en hetzelfde adres leiden als de huidige Roadmap-ingang, met dezelfde zichtbaarheid voor beheerders en adviseurs.
- **FR-009**: De pagina "Ideeën en wensen" MUST dezelfde naam gebruiken als de menu-ingang, in de paginatitel en in de bijbehorende knoppen, dialoogteksten en lege toestand.
- **FR-010**: Meldingen, bevestigingsdialogen, lege toestanden, plaatsaanduidingen, labels, knopteksten, tussentitels en schermlezerteksten MUST onderdeel zijn van de taalwijziging; geen enkele gebruikersgerichte tekst blijft buiten beschouwing.
- **FR-011**: Wanneer een externe dienst een Engelstalige fout teruggeeft, MUST de gebruiker een Nederlandse melding zien; de technische details MAY voor diagnose worden vastgelegd, maar MUST NOT als zichtbare UI-tekst verschijnen.
- **FR-012**: De feature MUST een inventaris opleveren in de spec-map die elke gewijzigde tekst als oud → nieuw vastlegt, gegroepeerd per scherm, inclusief de gebruikte termenlijst en de afgesproken uitzonderingen.
- **FR-013**: Alle bestaande geautomatiseerde tests die op gewijzigde tekst selecteren MUST worden bijgewerkt naar de nieuwe tekst en MUST groen zijn; tests mogen niet worden verwijderd, overgeslagen of verzwakt om ze groen te krijgen.
- **FR-014**: De feature MUST geen gedragswijziging introduceren: geen andere routes, geen andere rechten, geen andere gegevens, geen andere validatie en geen andere functionaliteit. Alleen tekst en de positie van de Roadmap-ingang veranderen.
- **FR-015**: Dezelfde term MUST voor hetzelfde begrip worden gebruikt op alle schermen (assistent, kennisbron, gesprek, uitvoering, analyse, teamlid, organisatie); synoniemen die door elkaar lopen worden gelijkgetrokken.
- **FR-016**: De wijziging MUST de bestaande toegankelijkheid behouden: knoppen en ingangen houden een begrijpelijke toegankelijkheidsnaam in het Nederlands, en langere teksten veroorzaken geen afkapping of onleesbare labels.
- **FR-017**: De feature MUST zich onthouden van de inhoud van assistentantwoorden, de e-mailteksten van Supabase Auth en `public/handleiding.html`; die vallen buiten de wijziging.

### Key Entities *(include if feature involves data)*

- **UI-tekst**: een gebruikersgerichte tekst op een bepaald scherm of in een bepaald onderdeel, met de oude en de nieuwe formulering. De inventaris (FR-012) is de volledige verzameling van deze wijzigingen.
- **Rol**: de bestaande gebruikersrol met een vaste opslagwaarde (beheerder of adviesrol) en een zichtbare Nederlandse naam ("Beheerder" of "Adviseur"). De opslagwaarde verandert niet; de zichtbare naam wel.
- **Navigatie-ingang**: een item in de zijbalk met een label, een positie (hoofdmenu of gebruikersblok) en een bestemming. Alleen label en positie van de ingang "Ideeën en wensen" veranderen; de bestemming blijft gelijk.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een controle van alle schermen levert nul voorkomens van de je-vorm op in zichtbare of voorgelezen tekst.
- **SC-002**: Een controle van alle schermen levert nul Engelse woorden op buiten de afgesproken productnamen, afkorting en technische termen.
- **SC-003**: In de zijbalk, op de Teampagina en in beide rolkeuzes staat de rol 100% van de keren als "Beheerder" of "Adviseur"; de ruwe waarden "admin" en "member" komen nul keer in beeld.
- **SC-004**: "Roadmap" komt nul keer voor in het hoofdmenu, op zowel brede als smalle schermen; "Ideeën en wensen" staat in het gebruikersblok en opent de bestaande pagina.
- **SC-005**: De inventaris in de spec-map bevat 100% van de gewijzigde teksten; een steekproef van tien willekeurige regels komt overeen met wat de app toont.
- **SC-006**: De volledige geautomatiseerde testsuite slaagt (100% groen, nul overgeslagen of verwijderde tests), en geen test selecteert nog op een oude tekst.
- **SC-007**: Een doorloop van de belangrijkste taken (inloggen, een gesprek starten, een risico-analyse openen, een kennisbron bekijken, een teamlid uitnodigen, een idee insturen) levert dezelfde uitkomsten op als voor de wijziging.
- **SC-008**: Tijdens een controle van tien schermen door een Nederlandse lezer wordt geen onvertaalde of onduidelijke term gevonden.

## Assumptions

- De u-vorm geldt voor elke directe aanspreking van de gebruiker; de productnaam "Darwin" blijft onveranderd.
- Voor "runs" is per context gekozen: "gesprekken" op de Geschiedenis-pagina (die gesprekken toont) en "uitvoeringen" in de risico-analyse (recente uitvoeringen, uitvoeringskaart, uitvoeringspagina).
- Voor "Command Center" is gekozen voor "Overzicht", zowel in het menu als als paginatitel.
- De termenlijst met uitzonderingen is: Darwin, n8n, AI, webhook, URL, token, CORS, header, PDF, DOCX. Ook letterlijke labels van de n8n-interface blijven staan wanneer de app uitlegt welke n8n-instelling nodig is, omdat de gebruiker die labels in n8n zelf terugziet. "E-mail", "team" en "analyse" zijn Nederlandse woorden en vallen niet onder de uitzonderingen.
- De adressen van pagina's blijven gelijk (de pagina "Ideeën en wensen" blijft op het bestaande adres bereikbaar); alleen labels en de menupositie veranderen.
- De opgeslagen rolwaarden en de rechten die daaraan hangen blijven ongewijzigd; alleen de weergave verandert.
- De inventaris van gewijzigde teksten wordt als document in de spec-map van deze feature opgeleverd.
- Buiten scope: de inhoud van assistentantwoorden, de e-mailteksten van Supabase Auth en `public/handleiding.html`.
- Er is geen nieuwe functionaliteit nodig; de bestaande pagina's, routes en rechten blijven zoals ze zijn.
