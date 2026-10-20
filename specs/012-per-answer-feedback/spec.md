# Feature Specification: Feedback per antwoord, en vastleggen hoe een antwoord tot stand kwam

**Feature Branch**: `012-per-answer-feedback`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Huidige situatie: Feedback (feedback_interactions) hoort bij een heel gesprek. Na één duim kan niets meer beoordeeld worden en is niet te zien welk antwoord fout was. Een duim omlaag vereist verplicht tekst; dat remt feedback. Van een antwoord worden alleen tekst en bronnen bewaard. De herschreven zoekvraag, het verificatie-oordeel en de responstijd gaan verloren, terwijl n8n ze meelevert. Daardoor is achteraf niet te analyseren waarom een antwoord fout ging, en kan feedback niet omgezet worden in testcases. User stories: 1. (P1) Als adviseur geef ik per antwoord een duim omhoog of omlaag. 2. (P1) Bij een duim omlaag kies ik een reden (Onjuist, Onvolledig, Bron klopt niet, Vraag niet begrepen, Anders) en kan ik optioneel een toelichting geven. 3. (P1) Mijn oordeel per antwoord is na herladen nog zichtbaar en ik kan het wijzigen. 4. (P2) Bij elk opgeslagen antwoord staan de herschreven zoekvraag, de verificatie (grounded, confidence, issues) en de responstijd. 5. (P2) Als beheerder kan ik de negatieve feedback met vraag, antwoord en verificatie in één overzicht opvragen (een databasefunctie, geen UI). Acceptatiecriteria: Eén oordeel per gebruiker per antwoord; wijzigen overschrijft het vorige. Feedback is alleen mogelijk op berichten in eigen gesprekken (RLS). Bestaande gespreksbrede feedback blijft bewaard, maar de UI toont alleen nog feedback per antwoord. Het overzicht is alleen opvraagbaar door beheerders, en alleen voor de eigen organisatie. Duimknoppen hebben aria-pressed en een toegankelijk label. Buiten scope: een beheerscherm voor feedback, automatische evaluatie, wijzigingen aan n8n."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Duim omhoog of omlaag per antwoord (Priority: P1)

Als adviseur zie ik onder elk afgeronde antwoord in mijn gesprek een duim-omhoogknop en een
duim-omlaagknop. Ik beoordeel elk antwoord afzonderlijk: een goed antwoord krijgt een duim
omhoog, een slecht antwoord een duim omlaag. Ook na een eerdere beoordeling kan ik elk nog
onbeoordeeld antwoord beoordelen.

**Why this priority**: Dit is de kerninteractie en lost het grootste probleem op: nu hoort
feedback bij het hele gesprek, kan er na één duim niets meer beoordeeld worden en is niet
te zien welk antwoord fout was. Zonder per-antwoord beoordeling zijn de andere stories
waardeloos.

**Independent Test**: Volledig te testen door een gesprek te openen met minimaal twee
afgeronde antwoorden: geef op één antwoord een duim omhoog en controleer dat alleen dat
antwoord als beoordeeld gemarkeerd is, terwijl de duimen bij het andere antwoord onbeoordeeld
blijven.

**Acceptance Scenarios**:

1. **Given** een gesprek met meerdere afgeronde antwoorden, **When** de adviseur op de
   duim-omhoogknop van één antwoord klikt, **Then** is uitsluitend dat antwoord positief
   beoordeeld; de duimen bij de andere antwoorden blijven in de onbeoordeelde toestand.
2. **Given** een antwoord dat nog in behandeling is of mislukt is, **When** de adviseur naar
   het bericht kijkt, **Then** staan er geen duimknoppen — beoordelen kan pas bij een
   afgerond antwoord.
3. **Given** een gesprek waarin al een antwoord is beoordeeld, **When** de adviseur een
   ander antwoord beoordeelt, **Then** kan dit onafhankelijk van het eerdere oordeel.

---

### User Story 2 - Reden en optionele toelichting bij duim omlaag (Priority: P1)

Als adviseur klik ik op de duim-omlaagknop van een antwoord. Er verschijnt direct bij het
antwoord een redenkeuze met precies vijf redenen: Onjuist, Onvolledig, Bron klopt niet,
Vraag niet begrepen, Anders. Ik kies één reden en kan — zonder verplichting — een
toelichting geven. Bevestigen slaat het oordeel op; annuleren slaat niets op.

**Why this priority**: De verplichte feedbacktekst remt het geven van negatieve feedback.
Een reden uit een vaste lijst maakt negatieve feedback snel, laagdrempelig én direct
analyseerbaar — de toelichting is vrijwillige context, geen drempel.

**Independent Test**: Volledig te testen door op de duim-omlaagknop van een antwoord te
klikken, een reden te kiezen, zonder toelichting te bevestigen en te controleren dat het
oordel met reden is opgeslagen; annuleren tussen door slaat niets op.

**Acceptance Scenarios**:

1. **Given** een afgerond antwoord, **When** de adviseur op de duim-omlaagknop klikt,
   **Then** verschijnt direct bij het antwoord een redenkeuze met de vijf redenen (Onjuist,
   Onvolledig, Bron klopt niet, Vraag niet begrepen, Anders) en een optioneel
   toelichtingsveld.
2. **Given** de zichtbare redenkeuze, **When** de adviseur een reden kiest en zonder
   toelichting bevestigt, **Then** wordt het oordeel (duim omlaag, reden, geen toelichting)
   opgeslagen.
3. **Given** de zichtbare redenkeuze, **When** de adviseur geen reden kiest, **Then** kan
   deze niet bevestigen — een reden is verplicht.
4. **Given** de zichtbare redenkeuze, **When** de adviseur annuleert, **Then** wordt niets
   opgeslagen en staan de duimknoppen weer in de oude toestand.

---

### User Story 3 - Oordeel blijft na herladen zichtbaar en is wijzigbaar (Priority: P1)

Als adviseur zie ik na het herladen van mijn gesprek bij elk antwoord mijn eerdere oordeel
terug. Ik kan het oordeel op elk moment wijzigen: van omhoog naar omlaag (met een nieuwe
reden) of van omlaag naar omhoog. Er bestaat per antwoord altijd maar één oordeel van mij;
wijzigen overschrijft het vorige.

**Why this priority**: Nu verdwijnt het oordeel na herladen uit beeld en is eenmaal
gegeven feedback niet meer te corrigeren. Een blijvend én wijzigbaar oordeel maakt de
feedback betrouwbaar en rechtvaardig — en voorkomt tegenstrijdige dubbele oordelen.

**Independent Test**: Volledig te testen door een antwoord te beoordelen, het gesprek te
herladen (het oordeel is zichtbaar), het oordeel te wijzigen van omlaag naar omhoog en
opnieuw te herladen (het gewijzigde oordeel is zichtbaar en er bestaat maar één oordeel).

**Acceptance Scenarios**:

1. **Given** een beoordeeld antwoord, **When** de adviseur het gesprek herlaadt, **Then**
   is bij dat antwoord het oordeel zichtbaar in de juiste toestand (actieve duim gemarkeerd).
2. **Given** een antwoord beoordeeld met duim omlaag, **When** de adviseur op de
   duim-omhoogknop klikt, **Then** wordt het oordeel omhoog en vervallen de eerder gekozen
   reden en toelichting.
3. **Given** een antwoord beoordeeld met duim omhoog, **When** de adviseur op de
   duim-omlaagknop klikt en een reden kiest, **Then** overschrijft het nieuwe oordeel
   (omlaag, reden, eventuele toelichting) het eerdere volledig.
4. **Given** een antwoord al beoordeeld met duim omlaag, **When** de adviseur opnieuw duim
   omlaag kiest met een andere reden, **Then** overschrijft het nieuwe oordeel het oude —
   er bestaat nooit meer dan één oordeel per adviseur per antwoord.

---

### User Story 4 - Antwoordgegevens bewaard bij elk opgeslagen antwoord (Priority: P2)

Bij elk nieuw opgeslagen antwoord worden de herschreven zoekvraag, de verificatie
(grounded, confidence, issues) en de responstijd vastgelegd. Deze gegevens komen mee met
het antwoord uit de bestaande koppeling en worden nu bij het opslaan bewaard in plaats van
verwijderd.

**Why this priority**: Zonder deze vastlegging is achteraf niet te analyseren waarom een
antwoord fout ging en kan negatieve feedback niet worden omgezet in testcases. Het is de
data-laag die de feedback bruikbaar maakt voor verbetering — maar het brengt zelf geen UI
met zich mee en kan dus na de kernstories.

**Independent Test**: Volledig te testen door een vraag te stellen, op het antwoord te
wachten en te controleren dat bij het opgeslagen antwoord de herschreven zoekvraag, de
verificatie (grounded, confidence, issues) en de responstijd zijn bewaard.

**Acceptance Scenarios**:

1. **Given** een geslaagde vraag-en-antwoordbeurt in een gesprek, **When** het antwoord is
   opgeslagen, **Then** zijn bij dat antwoord de herschreven zoekvraag, de verificatie
   (grounded, confidence, issues) en de responstijd bewaard.
2. **Given** de koppeling levert bij een antwoord geen herschreven zoekvraag of geen
   verificatie mee, **When** het antwoord wordt opgeslagen, **Then** worden de ontbrekende
   onderdelen als ontbrekend vastgelegd — zonder foutmelding en zonder invloed op het
   antwoord zelf.
3. **Given** een antwoord dat vóór deze feature is opgeslagen, **When** de antwoordgegevens
   worden opgevraagd, **Then** ontbreken deze — het antwoord en de beoordeling ervan
   functioneren onverminderd.

---

### User Story 5 - Beheerdersoverzicht van negatieve feedback (Priority: P2)

Als beheerder vraag ik in één overzicht — een databasefunctie, geen UI — alle negatieve
antwoordoordelen van mijn organisatie op. Per negatief oordeel zie ik de reden, de
eventuele toelichting van de adviseur, de gestelde vraag, het gegeven antwoord en de bij
het antwoord bewaarde verificatie (grounded, confidence, issues), herschreven zoekvraag
en responstijd.

**Why this priority**: Verzamelde negatieve feedback is zonder overzicht niet bruikbaar:
losse database-tabellen zonder samenhang geven geen antwoord op "waarom ging dit antwoord
fout". Het overzicht maakt de feedback analyseerbaar en omzetbaar in testcases — pas
zinvol als er per antwoord feedback én antwoordgegevens zijn (stories 1-4).

**Independent Test**: Volledig te testen door als beheerder de overzichtsfunctie aan te
roepen: deze levert alle negatieve antwoordoordelen van de eigen organisatie met reden,
vraag, antwoord en verificatie; als gewone adviseur geweigerd; als beheerder van
organisatie A nooit feedback uit organisatie B.

**Acceptance Scenarios**:

1. **Given** een beheerder, **When** deze het overzicht opvraagt, **Then** bevat het alle
   negatieve antwoordoordelen van de eigen organisatie, per oordeel met reden, eventuele
   toelichting, de vraag, het antwoord, de verificatie (grounded, confidence, issues), de
   herschreven zoekvraag en de responstijd.
2. **Given** een gewone gebruiker (adviseur), **When** deze het overzicht probeert op te
   vragen, **Then** wordt dit geweigerd.
3. **Given** een beheerder van een organisatie met meerdere organisaties in het systeem,
   **When** deze het overzicht opvraagt, **Then** bevat het uitsluitend feedback uit de
   eigen organisatie — nooit die van een andere organisatie.

---

### Edge Cases

- Wat gebeurt er bij een antwoord dat nog in behandeling is of mislukt is? Er zijn geen
  duimknoppen — beoordelen kan pas bij een afgerond antwoord; het mislukte antwoord zelf
  wordt nooit beoordeeld.
- Wat gebeurt er als de adviseur de redenkeuze annuleert? Er wordt niets opgeslagen; een
  bestaand oordeel blijft ongewijzigd en de duimknoppen keren terug in de oude toestand.
- Wat gebeurt er als het opslaan van een oordeel mislukt (netwerkfout)? Er volgt een korte
  foutmelding, de knoppen blijven bruikbaar en de adviseur kan opnieuw proberen — geen
  stille mislukking (constitution V).
- Wat gebeurt er bij de reden "Anders" zonder toelichting? Dit is toegestaan — de
  toelichting is bij elke reden optioneel.
- Wat gebeurt er bij een poging een antwoord uit het gesprek van een andere gebruiker te
  beoordelen? De beveiliging weigert dit; die berichten zijn voor de adviseur al niet
  zichtbaar.
- Wat gebeurt er met gesprekken waarop al gespreksbrede feedback is gegeven? De oude
  feedback blijft ongewijzigd in de database staan; de chat toont uitsluitend de
  per-antwoord duimen, zonder de oude gespreksbrede bediening.
- Wat gebeurt er als een beurt eerst mislukt en daarna via "Opnieuw proberen" slaagt? Het
  verschenen antwoord kan direct beoordeeld worden; over de mislukte poging bestaat geen
  oordeel.
- Wat gebeurt er bij meerdere beurten in één gesprek? Elk antwoord wordt afzonderlijk
  beoordeeld; een oordeel op het ene antwoord heeft geen invloed op de duimen bij een
  ander antwoord.
- Wat gebeurt er met antwoorden die vóór deze feature zijn opgeslagen? Deze kunnen wel
  beoordeeld worden, maar in het beheerdersoverzicht ontbreken hun herschreven zoekvraag,
  verificatie en responstijd (als ontbrekend getoond).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Onder elk afgeronde assistentantwoord in een gesprek staat een
  duim-omhoogknop en een duim-omlaagknop. Antwoorden die in behandeling zijn of mislukt
  zijn hebben geen duimknoppen.
- **FR-002**: Klikken op de duim-omhoogknop slaat het oordeel direct op, zonder extra
  bevestiging; de actieve toestand (omhoog gemarkeerd, omlaag niet) is direct zichtbaar.
- **FR-003**: Klikken op de duim-omlaagknop opent direct bij het antwoord een redenkeuze
  met exact vijf redenen — Onjuist, Onvolledig, Bron klopt niet, Vraag niet begrepen,
  Anders — en een optioneel toelichtingsveld. Een reden is verplicht; bevestigen slaat het
  oordeel op; annuleren slaat niets op.
- **FR-004**: Elk opgeslagen oordeel omvat de duimrichting, bij duim omlaag precies één
  reden en een optionele toelichting, het tijdstip en verwijzingen naar het antwoord, de
  adviseur en de organisatie.
- **FR-005**: Per gebruiker per antwoord bestaat maximaal één oordeel. Een nieuw of
  gewijzigd oordeel overschrijft het vorige volledig (duimrichting, reden en toelichting);
  er ontstaan nooit meerdere oordelen naast elkaar.
- **FR-006**: Na herladen van het gesprek is bij elk antwoord het gegeven oordeel weer
  zichtbaar in de correcte toestand, en de adviseur kan het op elk moment wijzigen.
- **FR-007**: Beoordelen is uitsluitend mogelijk op antwoorden in gesprekken die van de
  ingelogde gebruiker zijn; de beveiliging op databaseniveau (RLS) weigert alles daarbuiten.
  Gebruikers zien uitsluitend hun eigen oordelen.
- **FR-008**: Mislukt het opslaan van een oordeel, dan volgt een korte foutmelding en blijft
  de oude toestand intact; de adviseur kan opnieuw proberen (no silent failure,
  constitution V).
- **FR-009**: De gespreksbrede duimfeedback verdwijnt uit de chat-UI; de UI toont uitsluitend
  nog feedback per antwoord. Bestaande gespreksbrede feedback blijft ongewijzigd in de
  database bewaard.
- **FR-010**: Bij elk nieuw opgeslagen assistentantwoord worden de herschreven zoekvraag, de
  verificatie (grounded, confidence, issues) en de responstijd vastgelegd. Ontbrekende
  onderdelen worden als ontbrekend vastgelegd; dit is geen fout en raakt de antwoordtekst
  niet.
- **FR-011**: Een beheerder kan via één databasefunctie (geen UI) alle negatieve
  antwoordoordelen van de eigen organisatie opvragen, per oordeel met: de reden, de
  eventuele toelichting, de vraag (het gebruikersbericht direct vóór het antwoord), het
  antwoord, de verificatie (grounded, confidence, issues), de herschreven zoekvraag en de
  responstijd. Opvragen door gewone gebruikers wordt geweigerd; het overzicht bevat nooit
  feedback van een andere organisatie.
- **FR-012**: De duimknoppen hebben `aria-pressed` die de actieve toestand aangeeft en een
  Nederlands, toegankelijk label dat de betekenis aangeeft (bijv. "Antwoord is nuttig" /
  "Antwoord is niet nuttig"). Duimen, redenkeuze, toelichting, bevestigen en annuleren zijn
  volledig met het toetsenbord bedienbaar met zichtbare focusstatussen (WCAG 2.1 AA,
  constitution IV).

### Key Entities *(include if feature involves data)*

- **Antwoordoordeel**: nieuw entiteit. Het oordeel van één adviseur over één
  assistentantwoord: duim omhoog of omlaag, bij omlaag precies één van de vijf redenen en
  een optionele toelichting. Verwijst naar het antwoord (het bericht), de adviseur en de
  organisatie, met tijdstippen van geven en laatste wijziging. Er bestaat exact één
  antwoordoordeel per adviseur per antwoord; wijzigen overschrijft.
- **Bericht (antwoord)**: bestaande entiteit. Assistentberichten krijgen aanvullende
  vastgelegde antwoordgegevens: de herschreven zoekvraag, de verificatie (grounded,
  confidence, issues) en de responstijd — vastgelegd bij het opslaan van het antwoord.
  Voor antwoorden die vóór deze feature zijn opgeslagen ontbreken deze gegevens.
- **Gespreksbrede feedback**: bestaande entiteit (één rating per gebruiker per gesprek).
  Blijft ongewijzigd in de database bewaard, is niet meer in de UI zichtbaar en wordt niet
  gemigreerd naar antwoordoordelen.
- **Beheerdersoverzicht**: afgeleide samenstelling (via een databasefunctie) van alle
  negatieve antwoordoordelen van één organisatie, aangevuld met de bijbehorende vraag, het
  antwoord en de vastgelegde antwoordgegevens. Alleen opvraagbaar door beheerders van die
  organisatie.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Positieve feedback geven kost één klik; negatieve feedback maximaal drie
  handelingen (duim omlaag, reden kiezen, bevestigen) en is zonder enige toelichting te
  voltooien.
- **SC-002**: 100% van de gegeven antwoordoordelen is na herladen per antwoord correct
  zichtbaar in de juiste toestand.
- **SC-003**: Per antwoord bestaat per adviseur nooit meer dan één oordeel; elke wijziging
  vervangt het eerdere oordeel volledig (reden en toelichting inbegrepen).
- **SC-004**: Van 100% van de na deze feature opgeslagen antwoorden zijn de herschreven
  zoekvraag, de verificatie (grounded, confidence, issues) en de responstijd bewaard, of
  expliciet als ontbrekend vastgelegd.
- **SC-005**: Een beheerder haalt alle negatieve feedback van de eigen organisatie in één
  aanroep op; gewone gebruikers wordt opvragen in 100% van de pogingen geweigerd.
- **SC-006**: Beoordelen van antwoorden buiten eigen gesprekken is in 100% van de pogingen
  onmogelijk; geen enkele adviseur ziet oordelen van een andere gebruiker.
- **SC-007**: Alle feedbackhandelingen zijn zonder muis uitvoerbaar met zichtbare focus;
  elke duimknop heeft `aria-pressed` en een toegankelijk label (WCAG 2.1 AA,
  constitution IV).

## Scope

### Buiten scope (expliciet)

- Een beheerscherm (UI) voor feedback — het overzicht is een databasefunctie zonder eigen
  scherm.
- Automatische evaluatie van antwoorden of feedback.
- Wijzigingen aan n8n — de koppeling levert de antwoordgegevens al mee.
- Weergave van herschreven zoekvraag, verificatie of responstijd in de chat-UI.
- Migratie of omzetting van bestaande gespreksbrede feedback naar per-antwoord feedback.

## Assumptions

- "Bij elk opgeslagen antwoord staan..." (story 4) betekent: de herschreven zoekvraag, de
  verificatie en de responstijd worden bij het antwoord in de database bewaard voor
  latere analyse; de chat-UI toont deze gegevens niet (buiten scope).
- De responstijd is de doorlooptijd van de beurt: server-side gemeten tussen het ontvangen
  van de vraag en het voltooide antwoord, vastgelegd bij het opslaan van het antwoord.
- De vraag bij een antwoord in het beheerdersoverzicht is het gebruikersbericht dat direct
  aan het antwoord voorafgaat in hetzelfde gesprek; sinds feature 011 kan een opgeslagen
  antwoord niet zonder voorafgaande vraag ontstaan.
- De antwoordgegevens worden vastgelegd door de bestaande server-side chataanroep die het
  antwoord al opslaat; de n8n-koppeling zelf wordt niet gewijzigd.
- Het beheerdersoverzicht omvat naast vraag, antwoord en verificatie ook de bewaarde
  herschreven zoekvraag en responstijd — de probleemanalyse noemt deze gegevens expliciet
  als nodig om een fout antwoord te verklaren en testcases te kunnen maken.
- De redenen zijn exact de vijf genoemde; een vrije reden bestaat niet ("Anders" dekt deze
  af).
- Bij het wijzigen van een oordeel toont de redenkeuze geen vooraf ingevulde eerdere reden
  of toelichting; het nieuwe oordeel vervangt het oude volledig.
- De duimknoppen staan uitsluitend in de chatweergave van een gesprek, niet in andere
  overzichten van berichten of gesprekken.
- Antwoorden die vóór deze feature zijn opgeslagen kunnen wel beoordeeld worden; hun
  antwoordgegevens ontbreken en worden in het beheerdersoverzicht als ontbrekend getoond.
- De antwoordoordelen worden apart van de bestaande gespreksbrede feedback opgeslagen, in
  eigen opslag met beveiliging op rij-niveau conform de bestaande feedback-opslag (RLS,
  eigen gesprekken, eigen oordelen, organisatiegebonden beheerdersinzage).
- De beveiliging van het beheerdersoverzicht berust op de bestaende rol van beheerder binnen
  de eigen organisatie; opvragen gebeurt uitsluitend via de beveiligde databasefunctie.
  Vraag- en antwoordtekst komen niet in adressen of logs terecht (constitution III).
- UI-tekst is Nederlands in u-vorm (constitution I); de CONCEPT-labeling van antwoorden
  blijft ongewijzigd (constitution II).