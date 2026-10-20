# Feature Specification: Chat als eigen pagina met hervatbare gesprekken

**Feature Branch**: `011-resumable-chat-page`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "Huidige situatie: - De chat is een zijpaneel van 480 px in src/pages/AssistantsPage.tsx (ChatWindow). Dat is te smal voor antwoorden met opsommingen. Sluiten en opnieuw openen begint een nieuw gesprek, de terugknop van de browser verlaat de pagina, en een gesprek is niet te hervatten. - Elk gesprek heet "Chat met <assistent>". - Het invoerveld is één regel; lange vragen zijn onhandig. - Fouten verschijnen als toast die verdwijnt, terwijl het invoerveld al leeg is. - Het lege gesprek legt niet uit wat de assistent kan. - Berichten worden vanuit de browser opgeslagen, het assistentantwoord zonder wachten op het resultaat. Bij een fout kan een gesprek half opgeslagen zijn. User stories: 1. (P1) Als adviseur open ik een assistent en kom ik op een chatpagina met een eigen adres. Na mijn eerste vraag krijgt het gesprek een vast adres, zodat ik kan herladen, terugnavigeren en later verdergaan. 2. (P1) Ik typ mijn vraag in een meerregelig veld: Enter verstuurt, Shift+Enter geeft een nieuwe regel. 3. (P1) Mislukt een antwoord, dan zie ik bij mijn vraag een melding met de reden en een knop "Opnieuw proberen". Mijn vraag wordt niet dubbel opgeslagen. 4. (P2) Een nieuw gesprek toont maximaal vier voorbeeldvragen die de beheerder per assistent instelt; een klik stelt die vraag. 5. (P2) Onder elk antwoord staat een knop om het antwoord te kopiëren. 6. (P2) Met "Nieuw gesprek" begin ik opnieuw bij dezelfde assistent. 7. (P2) Het gesprek krijgt als titel de eerste vraag, afgekapt op 80 tekens. 8. (P3) Duurt een antwoord langer dan 15 seconden, dan zie ik dat het langer duurt dan gebruikelijk. Acceptatiecriteria: - Adressen bevatten alleen id's, nooit vraagtekst of klantgegevens (constitution III). - Gebruikers- en assistentberichten worden serverside opgeslagen in dezelfde aanroep die het antwoord ophaalt. Een herhaalde poging met hetzelfde bericht-id maakt geen dubbel bericht. - Een gesprek van een andere gebruiker openen geeft de melding "Gesprek niet gevonden", geen lege pagina. - De bestaande gespreksbrede duim-feedback en de huidige bronnenweergave blijven werken zoals nu; die worden in latere features vervangen. - Alle acties zijn met het toetsenbord bereikbaar; na versturen staat de focus weer in het invoerveld. Buiten scope: de weergave van antwoorden (markdown, bronnen, CONCEPT-label), feedback per antwoord, de Geschiedenis-pagina, de risico-analyse."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chatpagina met vast gespreksadres (Priority: P1)

Als adviseur klik ik op "Chat" bij een assistent en kom ik op een chatpagina met een eigen
adres. De pagina gebruikt de volledige breedte van de app, zodat antwoorden met
opsommingen goed leesbaar zijn. Na mijn eerste vraag krijgt het gesprek een vast adres:
ik kan de pagina herladen, met de terug- en vooruitknop van de browser navigeren en het
gesprek later voortzetten.

**Why this priority**: Dit is het fundament van de feature. Zonder eigen adres is geen
enkele andere story zinvol: het zijpaneel van 480 px beperkt de leesbaarheid, het
herladen begint telkens een nieuw gesprek, en de terugknop van de browser verlaat de
app — het gesprek is nu feitelijk onvindbaar terug.

**Independent Test**: Volledig te testen door een assistent te openen, een vraag te
stellen, en vervolgens: de pagina te herladen (gesprek blijft intact), de terugknop van
de browser te gebruiken (keert terug naar het assistentenoverzicht, vooruit keert terug
naar het gesprek), en het gespreksadres in een nieuwe sessie te openen (gesprek en
historie zijn compleet en het gesprek kan worden voortgezet).

**Acceptance Scenarios**:

1. **Given** een ingelogde adviseur met een actieve chat-assistent, **When** deze op
   "Chat" klikt, **Then** opent een chatpagina met een eigen adres (alleen id's) die de
   volledige breedte van de app benut.
2. **Given** een nieuw, leeg gesprek, **When** de adviseur de eerste vraag stelt,
   **Then** krijgt het gesprek een vast adres in de adresbalk, zonder dat de pagina
   opnieuw laadt.
3. **Given** een gesprek met minstens één voltooide vraag-en-antwoord, **When** de
   adviseur de pagina herlaadt, **Then** ziet deze hetzelfde gesprek met alle opgeslagen
   berichten en kan direct een vervolgvraag stellen.
4. **Given** de adviseur is van het assistentenoverzicht naar een gesprek genavigeerd,
   **When** deze de terugknop van de browser gebruikt, **Then** keert de adviseur terug
   naar het assistentenoverzicht; de vooruitknop opent het gesprek opnieuw, intact.
5. **Given** een vast gespreksadres, **When** de adviseur opent dit adres in een latere
   sessie (opnieuw ingelogd), **Then** zet deze het gesprek voort met de volledige
   historie.

---

### User Story 2 - Meerregelig invoerveld (Priority: P1)

Als adviseur typ ik mijn vraag in een meerregelig invoerveld. Enter verstuurt het
bericht; Shift+Enter geeft een nieuwe regel. Lange, gestructureerde vragen zijn zo in één
keer te stellen. Na het versturen staat de focus weer in het invoerveld.

**Why this priority**: Lange vragen zijn de norm voor adviseurs. Het huidige éénregelige
veld maakt lange vragen onhandig en onleesbaar tijdens het typen — een dagelijkse
frictie voor de primaire gebruiker.

**Independent Test**: Te testen door een meerregelige vraag te typen (Shift+Enter voor
regeleinden), te versturen met Enter, en te controleren dat de regeleinden in het
gesprek zichtbaar blijven en dat de focus na het versturen terugkeert in het (lege)
invoerveld.

**Acceptance Scenarios**:

1. **Given** het invoerveld met een getypte vraag, **When** de adviseur op Enter
   drukt, **Then** wordt het bericht verstuurd.
2. **Given** het invoerveld, **When** de adviseur op Shift+Enter drukt, **Then**
   verschijnt een nieuwe regel in het invoerveld zonder dat het bericht wordt
   verstuurd.
3. **Given** een getypte vraag met regeleinden, **When** deze is verstuurd, **Then**
   staat de volledige vraag met regeleinden in het gesprek.
4. **Given** een net verstuurd bericht, **When** het versturen is afgerond, **Then**
   staat de focus opnieuw in het lege invoerveld.

---

### User Story 3 - Foutmelding bij de vraag met "Opnieuw proberen" (Priority: P1)

Als adviseur mislukt een antwoord, dan zie ik bij mijn vraag in het gesprek een blijvende
melding met de reden en een knop "Opnieuw proberen" — geen verdwijnende toast. Mijn
vraag wordt niet dubbel opgeslagen: een herhaalde poging met hetzelfde bericht-id leidt
tot precies één opgeslagen vraag.

**Why this priority**: Nu verdwijnt de fout als toast terwijl het invoerveld al leeg is;
de vraag is weg uit het invoerveld, de reden is weg, en het gesprek kan half opgeslagen
zijn. Dit breekt de kernflow van het product (vraag stellen) en tast het vertrouwen in
de assistent het meest aan.

**Independent Test**: Te testen door een antwoord te laten mislukken (bijvoorbeeld een
assistent zonder werkende koppeling): de melding met reden verschijnt bij de vraag en
blijft staan; "Opnieuw proberen" verstuurt dezelfde vraag opnieuw; na succes staat de
vraag exact één keer in het gesprek en volgt het antwoord erop.

**Acceptance Scenarios**:

1. **Given** een verstuurde vraag waarvan het antwoord mislukt, **When** de fout
   optreedt, **Then** blijft de vraag zichtbaar in het gesprek met daaronder een
   blijvende melding met de reden en een knop "Opnieuw proberen".
2. **Given** een mislukte vraag met knop "Opnieuw proberen", **When** de adviseur op de
   knop klikt, **Then** wordt dezelfde vraag opnieuw verstuurd onder hetzelfde
   bericht-id.
3. **Given** een herhaalde poging die slaagt, **When** het antwoord is ontvangen,
   **Then** staat de vraag exact één keer in het gesprek, de melding is verdwenen en
   het antwoord volgt op de vraag.
4. **Given** een herhaalde poging die opnieuw mislukt, **When** de fout optreedt,
   **Then** blijft de melding met reden bij de vraag staan en kan de adviseur opnieuw
   proberen; de vraag staat niet dubbel in het gesprek.
5. **Given** een vraag en antwoord zijn opgeslagen, **When** het gesprek wordt heropend,
   **Then** is er geen tweede kopie van de vraag aanwezig.

---

### User Story 4 - Voorbeeldvragen instellen per assistent (Priority: P2)

Als beheerder stel ik per assistent optioneel maximaal vier voorbeeldvragen in via het
assistentenbeheer. Deze voorbeeldvragen helpen adviseurs om direct de juiste eerste
vraag te stellen.

**Why this priority**: Zonder beheerinstelling kan de lege staat van een nieuw gesprek
(User Story 5) geen voorbeeldvragen tonen. De beheerder bepaalt per assistent welke
vragen representatief zijn.

**Independent Test**: Te testen met een beheerdersaccount: bewerk een assistent, vul
voorbeeldvragen in (maximaal vier), sla op en controleer dat ze per assistent zijn
opgeslagen; een vijfde voorbeeldvraag kan niet worden toegevoegd.

**Acceptance Scenarios**:

1. **Given** een beheerder bewerkt een assistent, **When** deze één tot vier
   voorbeeldvragen invult en opslaat, **Then** zijn de voorbeeldvragen aan die
   assistent gekoppeld.
2. **Given** een assistent met vier ingestelde voorbeeldvragen, **When** de beheerder
   een vijfde vraag probeert toe te voegen, **Then** is dat niet mogelijk.
3. **Given** een assistent zonder ingestelde voorbeeldvragen, **When** de beheerder
   opslaat, **Then** werkt de assistent ongewijzigd en toont een nieuw gesprek geen
   voorbeeldvragen.

---

### User Story 5 - Lege staat met uitleg en voorbeeldvragen (Priority: P2)

Als adviseur open ik een nieuw gesprek en zie ik wat de assistent kan: de omschrijving
van de assistent en — indien door de beheerder ingesteld — maximaal vier voorbeeldvragen.
Eén klik of toetsenbordactie op een voorbeeldvraag stelt die vraag direct.

**Why this priority**: De huidige lege staat legt niet uit wat de assistent kan. Een
duidelijke lege staat verlaagt de drempel van de eerste vraag en maakt de mogelijkheden
van de assistent zichtbaar zonder te hoeven raden.

**Independent Test**: Te testen door een assistent met ingestelde voorbeeldvragen te
openen: de lege staat toont omschrijving en maximaal vier voorbeeldvragen; een klik op
een voorbeeldvraag verstuurt die vraag (en krijgt het gesprek bij de eerste vraag een
vast adres).

**Acceptance Scenarios**:

1. **Given** een nieuw gesprek bij een assistent met ingestelde voorbeeldvragen,
   **When** de adviseur de chatpagina opent, **Then** toont de lege staat de
   omschrijving van de assistent en maximaal vier voorbeeldvragen.
2. **Given** de lege staat met voorbeeldvragen, **When** de adviseur op een voorbeeldvraag
   klikt (of deze met het toetsenbord activeert), **Then** wordt die vraag direct
   verstuurd alsof de adviseur die zelf had getypt en op Enter had gedrukt.
3. **Given** een assistent zonder ingestelde voorbeeldvragen, **When** de adviseur de
   chatpagina opent, **Then** toont de lege staat de omschrijving van de assistent
   zonder voorbeeldvragen.

---

### User Story 6 - Antwoord kopiëren (Priority: P2)

Als adviseur kopieer ik een antwoord met één klik of toetsenbordactie op de kopieerknop
onder het antwoord, met een korte bevestiging dat het antwoord gekopieerd is.

**Why this priority**: Adviseurs hergebruiken antwoorden in adviesdocumenten. Nu moet
de tekst handmatig worden geselecteerd — foutgevoelig en tijdrovig.

**Independent Test**: Te testen door een gesprek met een antwoord te openen, op
"Kopiëren" te klikken en te controleren dat de volledige antwoordtekst op het klembord
staat met een zichtbare bevestiging.

**Acceptance Scenarios**:

1. **Given** een antwoord in het gesprek, **When** de adviseur op de kopieerknop klikt,
   **Then** wordt de volledige antwoordtekst naar het klembord gekopieerd en verschijnt
   een korte bevestiging ("Gekopieerd").
2. **Given** de kopieerknop, **When** de adviseur deze met het toetsenbord activeert,
   **Then** werkt de kopieeractie op dezelfde wijze.
3. **Given** een kopieeractie die mislukt (bijvoorbeeld geen klembordtoegang), **When**
   dit gebeurt, **Then** volgt een korte foutmelding — de actie faalt nooit stil.

---

### User Story 7 - Nieuw gesprek bij dezelfde assistent (Priority: P2)

Als adviseur begin ik met de knop "Nieuw gesprek" opnieuw bij dezelfde assistent: een
leeg gesprek met een eigen adres, zonder het eerdere gesprek te verliezen.

**Why this priority**: Vervolgvragen in een schone context zijn gebruikelijk (andere
klant, ander onderwerp). Het eerdere gesprek moet daarbij behouden blijven en via het
vaste adres bereikbaar zijn.

**Independent Test**: Te testen midden in een gesprek: klik op "Nieuw gesprek" opent
een leeg gesprek bij dezelfde assistent met een eigen adres; de terugknop van de
browser keert terug naar het eerdere gesprek, dat intact is.

**Acceptance Scenarios**:

1. **Given** een lopend gesprek, **When** de adviseur op "Nieuw gesprek" klikt, **Then**
   opent een leeg gesprek bij dezelfde assistent met een eigen adres en de lege staat
   (omschrijving en eventuele voorbeeldvragen).
2. **Given** na "Nieuw gesprek", **When** de adviseur de terugknop van de browser
   gebruikt, **Then** keert deze terug naar het eerdere gesprek, dat ongewijzigd en
   volledig intact is.

---

### User Story 8 - Titel is de eerste vraag (Priority: P2)

Als adviseur krijgt mijn gesprek als titel de eerste vraag, afgekapt op 80 tekens. Zo
is het gesprek herkenbaar terug te vinden. De titel verandert daarna niet meer.

**Why this priority**: De generieke titel "Chat met <assistent>" maakt gesprekken
ononderscheidbaar. De eerste vraag is de meest natuurlijke herkenner van een gesprek.

**Independent Test**: Te testen door een eerste vraag te stellen en het gesprek te
heropenen: de titel is de eerste vraag (maximaal 80 tekens) en blijft bij vervolgvragen
ongewijzigd.

**Acceptance Scenarios**:

1. **Given** een nieuw gesprek, **When** de adviseur de eerste vraag stelt, **Then**
   krijgt het gesprek als titel de eerste vraag, afgekapt op 80 tekens.
2. **Given** een eerste vraag van meer dan 80 tekens, **When** de titel wordt bepaald,
   **Then** bestaat de titel uit de eerste 80 tekens van de vraag.
3. **Given** een gesprek met titel, **When** de adviseur vervolgvragen stelt of het
   gesprek heropent, **Then** blijft de titel ongewijzigd.

---

### User Story 9 - Melding bij langzaam antwoord (Priority: P3)

Als adviseur duurt een antwoord langer dan 15 seconden, dan zie ik bij de wachtindicator
de melding dat het antwoord langer duurt dan gebruikelijk. Zodra het antwoord verschijnt,
verdwijnt de melding.

**Why this priority**: Bij lange antwoordtijden weet de adviseur niet of het systeem nog
werkt of is vastgelopen. De melding stelt gerust zonder extra handelingen te vragen.
Pas als de kernstories (adres, invoer, foutafhandeling) solide zijn, is deze verwachting
relevant.

**Independent Test**: Te testen met een assistent waarvan het antwoord langer dan 15
seconden duurt: na 15 seconden verschijnt de melding; zodra het antwoord arriveert,
verdwijnt de melding.

**Acceptance Scenarios**:

1. **Given** een wachtend antwoord, **When** het antwoord na 15 seconden nog niet is
   ontvangen, **Then** toont de wachtindicator de melding dat het antwoord langer duurt
   dan gebruikelijk.
2. **Given** de zichtbare melding, **When** het antwoord verschijnt, **Then** verdwijnt
   de melding en volgt het antwoord in het gesprek.
3. **Given** een antwoord dat binnen 15 seconden arriveert, **When** het antwoord
   verschijnt, **Then** is de melding niet getoond.

---

### Edge Cases

- Wat gebeurt er bij het openen van een gespreksadres van een andere gebruiker of een
  niet-bestaand gesprek? De adviseur ziet de melding "Gesprek niet gevonden" met een
  mogelijkheid om terug te keren naar het assistentenoverzicht — nooit een lege pagina.
- Wat gebeurt er bij herladen terwijl een antwoord nog in behandeling is? Het gesprek
  toont de bewaarde vraag zonder antwoord (de wachttoestand wordt niet hersteld);
  slaagt de lopende aanroep alsnog server-side, dan is het antwoord bij de volgende
  herlaad of terugkeer zichtbaar.
- Wat gebeurt er als de eerste vraag mislukt en de adviseur herlaadt? Het gesprek
  bestaat met titel en de bewaarde vraag; het antwoord ontbreekt. Zolang de pagina
  open staat herstelt "Opnieuw proberen" in hetzelfde gesprek; na herladen kan de
  adviseur de vraag opnieuw stellen bij het vaste adres.
- Wat gebeurt er als de adviseur wegnavigeert terwijl een antwoord in behandeling is?
  Een geslaagde beurt wordt server-side opgeslagen en is bij terugkeer via het vaste
  adres zichtbaar; de wachttoestand zelf wordt niet hersteld.
- Wat gebeurt er met een lege of uitsluitend uit witruimte bestaande invoer? Enter
  verstuurt niet; het invoerveld is niet leeg-verstuurbaar.
- Wat gebeurt er als de adviseur typt terwijl een antwoord in behandeling is? Het
  invoerveld staat uit tijdens het wachten (huidig gedrag), zodat er geen parallelle
  vragen in één gesprek ontstaan.
- Wat gebeurt er bij een vraag die met witruimte begint of eindigt? De vraag wordt
  vooraf van witruimte ontdaan; ook de titel is gebaseerd op de getrimde vraag.
- Wat gebeurt er bij een assistent met meer dan vier beoogde voorbeeldvragen? De
  beheerder kan er maximaal vier instellen; het gesprek toont er nooit meer dan vier.
- Wat gebeurt er als kopiëren naar het klembord faalt (bijvoorbeeld geen klembordtoegang)?
  Er volgt een korte foutmelding — geen stille mislukking.
- Wat gebeurt er bij een gesprek van een inmiddels gedeactiveerde assistent? Het
  bestaande gesprek blijft voor de eigenaar toegankelijk; nieuwe gesprekken starten
  alleen via actieve assistenten (huidig gedrag ongewijzigd).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Klikken op "Chat" bij een actieve chat-assistent opent een chatpagina met
  een eigen adres in plaats van het huidige zijpaneel; de chatpagina benut de volledige
  breedte van de app zodat antwoorden met opsommingen leesbaar zijn.
- **FR-002**: Adressen van de chatpagina en van gesprekken bevatten uitsluitend id's
  (assistent-id, gesprek-id) — nooit vraagtekst, antwoordtekst of klantgegevens
  (constitution III).
- **FR-003**: Na het versturen van de eerste vraag krijgt het gesprek een vast adres;
  het adres verandert zonder dat de pagina opnieuw laadt.
- **FR-004**: Een gesprek met een vast adres kan worden heropend en voortgezet via
  herladen, browser-terug/-vooruit en het adres zelf, ook in een latere sessie.
- **FR-005**: Het invoerveld is meerregelig: Enter verstuurt het bericht, Shift+Enter
  voegt een nieuwe regel in.
- **FR-006**: Het invoerveld groeit mee met de tekst, zodat meerregelige vragen tijdens
  het typen leesbaar en bewerkbaar blijven.
- **FR-007**: Na het versturen keert de focus automatisch terug naar het invoerveld.
- **FR-008**: Mislukt een antwoord, dan blijft de vraag in het gesprek zichtbaar met een
  inline, blijvende melding met de reden en een knop "Opnieuw proberen" — geen
  verdwijnende toast.
- **FR-009**: "Opnieuw proberen" verstuurt dezelfde vraag opnieuw onder hetzelfde
  bericht-id; een geslaagde herhaling leidt tot precies één opgeslagen
  gebruikersbericht.
- **FR-010**: Het gebruikersbericht en het assistentantwoord worden server-side
  opgeslagen in dezelfde aanroep waarin het antwoord wordt opgehaald. Een antwoord
  zonder bijbehorende vraag kan nooit ontstaan; een vraag zonder antwoord is
  hooguit tijdelijk aanwezig en herstelt idempotent via "Opnieuw proberen" (zelfde
  bericht-id, zelfde gesprek).
- **FR-011**: Het openen van een gesprek dat niet bestaat of van een andere gebruiker
  is, toont de melding "Gesprek niet gevonden" met een terugkeer naar het
  assistentenoverzicht — nooit een lege pagina.
- **FR-012**: De lege staat van een nieuw gesprek toont de omschrijving van de
  assistent, zodat duidelijk is wat de assistent kan.
- **FR-013**: De beheerder kan per assistent optioneel maximaal vier voorbeeldvragen
  instellen via het assistentenbeheer.
- **FR-014**: Een nieuw gesprek toont de ingestelde voorbeeldvragen (maximaal vier) in
  de lege staat; één klik of toetsenbordactie verstuurt die vraag.
- **FR-015**: Onder elk antwoord staat een kopieerknop die de volledige antwoordtekst
  naar het klembord kopieert met een korte bevestiging; als kopiëren mislukt volgt een
  korte foutmelding (no silent failure, constitution V).
- **FR-016**: De chatpagina biedt de knop "Nieuw gesprek" die bij dezelfde assistent een
  leeg gesprek opent, zonder het eerdere gesprek te verliezen.
- **FR-017**: Een gesprek krijgt als titel de eerste vraag (van witruimte ontdaan),
  afgekapt op 80 tekens; daarna blijft de titel ongewijzigd.
- **FR-018**: Duurt een antwoord langer dan 15 seconden, dan toont de wachtindicator de
  melding dat het antwoord langer duurt dan gebruikelijk; zodra het antwoord verschijnt,
  verdwijnt de melding.
- **FR-019**: Alle acties — versturen, opnieuw proberen, kopiëren, voorbeeldvraag
  kiezen, nieuw gesprek, bronnen tonen en feedback-duimpjes — zijn volledig met het
  toetsenbord bereikbaar met zichtbare focusstatussen (WCAG 2.1 AA, constitution IV).
- **FR-020**: De bestaande gespreksbrede duim-feedback en de huidige bronnenweergave
  functioneren op de chatpagina ongewijzigd; ze worden in latere features vervangen.

### Key Entities *(include if feature involves data)*

- **Gesprek (Conversation)**: bestaande entiteit, één per gebruiker per assistent per
  onderwerp. Nieuw in deze feature: een vast, heropendbaar adres op basis van het
  gesprek-id, en een titel gelijk aan de eerste vraag (maximaal 80 tekens). Heeft een
  één-op-veel-relatie met berichten.
- **Bericht (Message)**: gebruikers- of assistentbericht binnen een gesprek. Nieuw in
  deze feature: een bericht-id dat bij mislukking en herhaling gelijk blijft, zodat één
  vraag nooit dubbel wordt opgeslagen (idempotent). Assistentberichten behouden hun
  bronnen.
- **Assistent (AI Assistant)**: bestaande entiteit. Nieuw in deze feature: een optionele
  lijst van maximaal vier voorbeeldvragen, ingesteld door de beheerder.
- **Chatadres**: afgeleid van assistent-id (nieuw gesprek) en assistent-id plus
  gesprek-id (bestaand gesprek); bevat uitsluitend id's (constitution III).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% van de gesprekken is via het vaste adres te heropenen met alle
  eerdere berichten — na herladen, na browser-terug/-vooruit en in een latere sessie.
- **SC-002**: Een antwoord is nooit zonder de bijbehorende vraag opgeslagen; een vraag
  zonder antwoord herstelt via één herhaalde poging (zelfde bericht-id) tot een
  complete beurt.
- **SC-003**: Bij een mislukt antwoord ziet de adviseur direct bij de vraag een blijvende
  melding met reden en herhalingsknop; na een geslaagde herhaling staat de vraag exact
  één keer in het gesprek.
- **SC-004**: Alle adressen bevatten uitsluitend id's — geen enkele vraag-, antwoord- of
  klanttekst verschijnt in een adres (constitution III).
- **SC-005**: Een mislukt antwoord is zonder opnieuw typen te herhalen; de herhaling kost
  één klik of één toetsenbordactie.
- **SC-006**: Een meerregelige vraag is in één keer te typen en te versturen (Enter
  verstuurt, Shift+Enter nieuwe regel) en staat na versturen volledig met regeleinden in
  het gesprek; de focus staat weer in het invoerveld.
- **SC-007**: Een antwoord kopiëren kost maximaal één klik of één toetsenbordactie, met
  zichtbare bevestiging.
- **SC-008**: Met "Nieuw gesprek" start de adviseur binnen twee handelingen opnieuw bij
  dezelfde assistent, zonder het eerdere gesprek te verliezen.
- **SC-009**: Wacht een antwoord langer dan 15 seconden, dan ziet de adviseur binnen die
  15 seconden na het versturen de melding dat het antwoord langer duurt dan gebruikelijk.
- **SC-010**: Alle chatacties zijn zonder muis uitvoerbaar met zichtbare focus
  (WCAG 2.1 AA, constitution IV).
- **SC-011**: Een beheerder stelt voorbeeldvragen in zonder tussenkomst van een
  ontwikkelaar; een assistent zonder voorbeeldvragen werkt en toont ongewijzigd.

## Scope

### Buiten scope (expliciet)

- De weergave van antwoorden (markdown-rendering, bronnenweergave, CONCEPT-label) — de
  huidige weergave blijft ongewijzigd werken.
- Feedback per antwoord — de bestaande gespreksbrede duim-feedback blijft bestaan en
  werkt zoals nu; vervanging is een latere feature.
- De Geschiedenis-pagina — blijft werken met bestaande en nieuwe gesprekken, maar wordt
  in deze feature niet aangepast.
- De risico-analyse-flow — de chatpagina geldt alleen voor chat-assistenten; de
  risico-analyse blijft ongewijzigd.

## Assumptions

- De chatpagina vervangt het chat-zijpaneel volledig; na deze feature bestaat er geen
  chat-zijpaneel meer.
- De exacte routevorm (paden, parametervorm) is een implementatiekeuze; eis is dat
  adressen uniek, heropendbaar en uitsluitend op id's gebaseerd zijn.
- Het gesprek (met titel gelijk aan de eerste vraag) wordt aangemaakt bij het versturen
  van de eerste vraag, ook als het antwoord daarna mislukt; de vraag wordt server-side
  bewaard zodra deze is verstuurd, het antwoord volgt pas bij een geslaagde aanroep.
  Herladen na een mislukte eerste vraag toont het gesprek met de vraag zonder antwoord
  bij het vaste adres.
- Bestaande gesprekken behouden hun huidige titel ("Chat met <assistent>"); alleen
  nieuwe gesprekken krijgen de titel op basis van de eerste vraag.
- Foutredenen komen uit de bestaande foutcategorieën van de chat-koppeling (sessie
  verlopen, geen toegang, configuratie ontbreekt, verbindingsfout, time-out, onbekende
  fout) en worden in begrijpelijk Nederlands bij de vraag getoond.
- Voorbeeldvragen worden beheerd in de bestaande assistent-beheerinterface, bij de
  bestaande assistentinstellingen.
- De kopieerknop bevestigt kort met "Gekopieerd".
- Bestaande gesprekken blijven voor de eigenaar toegankelijk, ook als de assistent
  inmiddels is gedeactiveerd; nieuwe gesprekken starten alleen via actieve assistenten
  (huidig gedrag ongewijzigd).
- De server-side opslag van berichten verloopt via de bestaande beveiligde serveraanroep
  voor chat (uitgebreid met berichtopslag), met behoud van de huidige beveiligingsregels
  en logbeperkingen (constitution III).
- Het invoerveld staat tijdens het wachten op een antwoord uit (huidig gedrag), zodat er
  geen parallelle vragen binnen één gesprek ontstaan.
- De Geschiedenis-pagina toont nieuwe gesprekken met hun nieuwe titels zonder eigen
  aanpassing.