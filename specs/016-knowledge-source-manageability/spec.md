# Feature Specification: Kennisbronnenbeheer dat laat zien of een bron bruikbaar is

**Feature Branch**: `016-knowledge-source-manageability`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Kennisbronnenbeheer dat laat zien of een bron bruikbaar is. Huidige situatie: Kennisbronkaarten tonen alleen naam en beschrijving; of er documenten in zitten en of die verwerkt zijn, zie je pas na openen. De documentstatus 'Verwerken...' ververst niet vanzelf. De status 'Error' is Engels en heeft geen reden; opnieuw verwerken kan niet. Documenten en kennisitems worden zonder bevestiging verwijderd. Uploaden kan één bestand tegelijk, zonder slepen. Het veld 'Vector Collection ID' (met uitleg over Pinecone) wordt door de zoekstap niet gebruikt. Kennisitems blijven op 'Wachtend' staan: er is geen verwerking voor gebouwd. De zoekstap in n8n filtert op de naam van de kennisbron; hernoemen maakt alle documenten van die bron onvindbaar."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Kennisbronkaarten tonen of een bron bruikbaar is (Priority: P1)

Als beheerder open ik het kennisbronnenoverzicht en zie op elke kaart, zonder de bron te openen: hoeveel documenten erin zitten, hoeveel daarvan een fout hebben en wanneer de bron voor het laatst is bijgewerkt. Zo zie ik in één oogopslag welke bronnen klaar zijn voor gebruik en welke aandacht vragen.

**Why this priority**: Dit is de kern van de feature: de beheerder moet kunnen beoordelen of een kennisbron bruikbaar is zonder elke bron afzonderlijk te openen. Zonder deze story blijft het overzicht een lijst met namen.

**Independent Test**: Volledig te testen door het overzicht te openen met bronnen in verschillende toestanden (leeg, alles verwerkt, deels fout, recent bijgewerkt): elke kaart toont het juiste aantal documenten, het juiste aantal fouten en de juiste laatste wijzigingstijd.

**Acceptance Scenarios**:

1. **Given** een kennisbron met documenten die allemaal verwerkt zijn, **When** het overzicht opent, **Then** toont de kaart het totale aantal documenten, "0 fouten" (of een gelijkwaardige neutrale weergave) en de laatste wijzigingstijd.
2. **Given** een kennisbron met drie documenten waarvan één met een fout, **When** het overzicht opent, **Then** toont de kaart drie documenten en één fout, en is het foutenaantal visueel herkenbaar als aandachtspunt.
3. **Given** een kennisbron zonder documenten, **When** het overzicht opent, **Then** toont de kaart dat de bron leeg is en dat er nog niets is verwerkt.
4. **Given** een knowledgebase waarvan recent een document is toegevoegd of van status is veranderd, **When** het overzicht opent, **Then** weerspiegelt de laatste wijzigingstijd die gebeurtenis.
5. **Given** een member (geen beheerder), **When** het overzicht opent, **Then** ziet hij dezelfde statusinformatie maar geen beheerknoppen.

---

### User Story 2 - Documentstatussen verversen vanzelf en fouten zijn herstelbaar (Priority: P1)

Als beheerder open ik een kennisbron terwijl documenten nog verwerkt worden. De status ververst vanzelf totdat niets meer in verwerking is. Een document met een fout toont "Fout", de reden als die bekend is, en een knop "Opnieuw verwerken". Met die knop start ik de verwerking opnieuw en zie ik de status weer op "Verwerken" gaan.

**Why this priority**: Zonder automatische verversing en herstelmogelijkheid blijft de beheerder met een verouderd of onherstelbaar beeld zitten en moet hij de pagina handmatig herladen. Dit blokkeert het dagelijks beheer van kennisbronnen.

**Independent Test**: Volledig te testen door een document in verwerking te brengen: de status werkt zichzelf bij zonder herladen, stopt met verversen zodra niets meer in verwerking is, en een document met een fout toont "Fout", een eventuele reden en een werkende knop "Opnieuw verwerken".

**Acceptance Scenarios**:

1. **Given** minstens één document met status in verwerking, **When** de kennisbron open is, **Then** ververst de documentstatus automatisch zonder dat de beheerder de pagina herlaadt.
2. **Given** geen enkel document meer in verwerking, **When** de laatste verwerking is afgerond, **Then** stopt het automatisch verversen.
3. **Given** een document met een fout en een bekende reden, **When** de beheerder de kennisbron opent, **Then** ziet hij "Fout" met die reden en een knop "Opnieuw verwerken".
4. **Given** een document met een fout zonder bekende reden, **When** de beheerder de kennisbron opent, **Then** ziet hij "Fout" zonder verzonnen reden, met een knop "Opnieuw verwerken".
5. **Given** een document met een fout, **When** de beheerder op "Opnieuw verwerken" klikt, **Then** start de bestaande serverroute voor documentindexering (feature A, actie 'index') opnieuw en gaat de status naar "Verwerken".
6. **Given** een document met een fout, **When** een member de kennisbron opent, **Then** ziet hij "Fout" en een eventuele reden, maar geen knop "Opnieuw verwerken".
7. **Given** het opnieuw verwerken mislukt direct, **When** de serverroute een fout teruggeeft, **Then** blijft de status "Fout" en ziet de beheerder een begrijpelijke melding in plaats van een stil falen.

---

### User Story 3 - Verwijderen vraagt om bevestiging (Priority: P1)

Als beheerder verwijder ik een document of kennisitem. Voordat het weg is, vraagt de app om bevestiging en noemt daarbij de naam van het item. Zo voorkom ik dat ik per ongeluk iets verwijder.

**Why this priority**: Verwijderen is onomkeerbaar en raakt de inhoud waarop antwoorden gebaseerd zijn. Een misklik zonder bevestiging is een directe gegevensverlies-situatie.

**Independent Test**: Volledig te testen door bij een document en bij een kennisitem op verwijderen te klikken: er verschijnt een bevestiging met de juiste naam, annuleren laat alles staan, bevestigen verwijdert alleen dat item.

**Acceptance Scenarios**:

1. **Given** een document in een kennisbron, **When** de beheerder op verwijderen klikt, **Then** verschijnt een bevestiging met de documentnaam en de keuze om te annuleren.
2. **Given** de bevestiging voor een document, **When** de beheerder annuleert, **Then** blijft het document bestaan en verandert er niets.
3. **Given** de bevestiging voor een document, **When** de beheerder bevestigt, **Then** wordt alleen dat document verwijderd en ziet de beheerder een bevestiging van het resultaat.
4. **Given** een kennisitem, **When** de beheerder op verwijderen klikt, **Then** geldt dezelfde bevestiging met de naam van het kennisitem.
5. **Given** een member, **When** hij een document of kennisitem bekijkt, **Then** ziet hij geen verwijderknop en kan hij die ook niet met het toetsenbord bereiken.

---

### User Story 4 - Naam van een gebruikte kennisbron is vergrendeld (Priority: P1)

Als beheerder kan ik de naam van een kennisbron niet meer wijzigen zodra er documenten in zitten. De app legt uit waarom: de zoekstap filtert op de naam, dus hernoemen zou de bestaande documenten onvindbaar maken. Een lege kennisbron kan ik wel hernoemen.

**Why this priority**: Hernoemen breekt nu stil de vindbaarheid van alle documenten van die bron. De vergrendeling voorkomt gegevensverlies dat pas later als "de assistent geeft geen antwoord" aan het licht komt.

**Independent Test**: Volledig te testen door een lege bron te hernoemen (mag) en een bron met minstens één document te hernoemen (naamveld vergrendeld, uitleg zichtbaar).

**Acceptance Scenarios**:

1. **Given** een kennisbron zonder documenten, **When** de beheerder de bron bewerkt, **Then** kan hij de naam wijzigen en opslaan.
2. **Given** een kennisbron met minstens één document, **When** de beheerder de bron bewerkt, **Then** is het naamveld niet wijzigbaar en legt een uitleg uit dat de naam vastligt omdat de zoekstap erop filtert.
3. **Given** een kennisbron met documenten waarvan alle documenten zijn verwijderd, **When** de beheerder de bron bewerkt, **Then** kan hij de naam weer wijzigen.
4. **Given** een vergrendelde naam, **When** de beheerder opslaat, **Then** blijven naam en documenten ongewijzigd en verschijnt geen foutmelding.
5. **Given** een member, **When** hij een kennisbron bekijkt, **Then** ziet hij geen bewerkoptie voor de naam.

---

### User Story 5 - Meerdere bestanden tegelijk uploaden (Priority: P2)

Als beheerder kies ik meerdere bestanden tegelijk of sleep ik ze in de kennisbron. Per bestand zie ik de voortgang en het resultaat, zodat ik weet welk bestand gelukt is en welk niet.

**Why this priority**: Het huidige uploaden van één bestand tegelijk kost bij een kennisbron met tientallen documenten onnodig veel handelingen. Dit is een versnelling, geen blokkade: de feature werkt ook zonder.

**Independent Test**: Volledig te testen door meerdere bestanden tegelijk te selecteren en door bestanden te slepen: elk bestand toont afzonderlijk voortgang en een eindresultaat, ook wanneer één bestand mislukt.

**Acceptance Scenarios**:

1. **Given** de beheerder opent de uploadkeuze, **When** hij meerdere bestanden selecteert, **Then** worden alle gekozen bestanden in één keer in behandeling genomen.
2. **Given** de beheerder sleept bestanden naar het uploadgebied, **When** hij ze neerzet, **Then** worden die bestanden op dezelfde manier in behandeling genomen als bij kiezen via de knop.
3. **Given** meerdere bestanden in behandeling, **When** de uploads lopen, **Then** ziet de beheerder per bestand de voortgang en uiteindelijk per bestand het resultaat (gelukt of mislukt met reden).
4. **Given** één bestand mislukt terwijl de andere slagen, **When** de uploads klaar zijn, **Then** blijven de geslaagde bestanden staan en kan de beheerder het mislukte bestand opnieuw proberen zonder de andere opnieuw te doen.
5. **Given** de beheerder gebruikt alleen het toetsenbord, **When** hij bestanden wil toevoegen, **Then** kan hij via de uploadknop bestanden kiezen; slepen is niet de enige route en het sleepgebied is niet de enige bediening.
6. **Given** een member, **When** hij een kennisbron bekijkt, **Then** ziet hij geen uploadgebied of uploadknop.

---

### User Story 6 - Overbodige velden en tabblad verdwijnen uit de UI (Priority: P2)

Als beheerder zie ik het veld "Vector Collection ID" en het tabblad "Kennisitems" niet meer. Die horen niet bij hoe het zoeken werkt en het kennisitem-tabblad belooft een verwerking die niet bestaat. De interface toont alleen wat daadwerkelijk gebruikt wordt.

**Why this priority**: Dit voorkomt verwarring en verkeerde verwachtingen, maar het is geen blokkade voor het beheer. De bestaande gegevens blijven bewaard.

**Independent Test**: Volledig te testen door een kennisbron te openen en te bewerken: het veld "Vector Collection ID" en het tabblad "Kennisitems" zijn nergens zichtbaar, terwijl bestaande gegevens in de database ongemoeid blijven.

**Acceptance Scenarios**:

1. **Given** de beheerder opent het formulier voor het aanmaken of bewerken van een kennisbron, **When** het formulier verschijnt, **Then** is er geen veld "Vector Collection ID" en geen uitleg over een vector database.
2. **Given** de beheerder opent een kennisbron, **When** de detailweergave verschijnt, **Then** is er geen tabblad "Kennisitems".
3. **Given** bestaande kennisbronnen met een gevulde vectorcollectie en bestaande kennisitems, **When** de UI is bijgewerkt, **Then** zijn die gegevens niet verwijderd of gewijzigd; ze zijn alleen niet meer in de UI zichtbaar.
4. **Given** een member, **When** hij een kennisbron bekijkt, **Then** ziet hij evenmin het veld of het tabblad.

### Edge Cases

- Een kennisbron heeft documenten in verwerking op het moment dat de beheerder de pagina verlaat: bij terugkomst toont de pagina de actuele status en hervat het verversen alleen als er nog documenten in verwerking zijn.
- Alle documenten van een bron zijn verwijderd terwijl de bewerkweergave open staat: de naam wordt weer wijzigbaar zonder de pagina te herladen.
- Een document gaat tijdens het verversen van "Verwerken" naar "Fout": de fout, een eventuele reden en de knop "Opnieuw verwerken" verschijnen in dezelfde sessie.
- Een document met een fout wordt opnieuw verwerkt en faalt opnieuw: de status blijft "Fout" en de beheerder kan opnieuw proberen.
- Twee beheerders verwerken hetzelfde document tegelijk opnieuw: de status blijft consistent en er ontstaan geen dubbele documenten.
- Meerdere bestanden met dezelfde naam worden in één keer geüpload: elk bestand heeft een eigen voortgang en resultaat.
- Een geüpload bestand is te groot of heeft een niet-ondersteund type: dat bestand toont een duidelijke fout, de andere bestanden lopen door.
- De verbinding valt weg tijdens het verversen: de pagina toont de laatst bekende status en herstelt zodra de verbinding terug is, zonder vast te lopen.
- Een member opent een kennisbron met fouten: hij ziet de status en reden, maar geen enkele beheeractie.
- De zoekstap levert niets op voor een bron die recent is hernoemd vóór deze feature: dit is bestaande data en valt buiten de UI-wijziging; de feature voorkomt alleen nieuwe schade.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Het kennisbronnenoverzicht MUST op elke kaart het aantal documenten tonen.
- **FR-002**: Het kennisbronnenoverzicht MUST op elke kaart het aantal documenten met een fout tonen, herkenbaar als aandachtspunt.
- **FR-003**: Het kennisbronnenoverzicht MUST op elke kaart tonen wanneer de bron voor het laatst is bijgewerkt, gebaseerd op de meest recente wijziging van de bron of haar documenten.
- **FR-004**: Een kennisbron zonder documenten MUST als leeg/herkenbaar onbruikbaar worden weergegeven.
- **FR-005**: De detailweergave MUST documentstatussen automatisch verversen zolang minstens één document de status "in verwerking" heeft.
- **FR-006**: Het automatisch verversen MUST stoppen zodra geen enkel document meer de status "in verwerking" heeft.
- **FR-007**: Een document met een fout MUST als "Fout" worden getoond, met de foutreden wanneer die beschikbaar is.
- **FR-008**: Een document met een fout MUST een actie "Opnieuw verwerken" bieden aan beheerders.
- **FR-009**: "Opnieuw verwerken" MUST de bestaande serverroute voor documentindexering uit feature A gebruiken en de documentstatus op "in verwerking" zetten.
- **FR-010**: Als "Opnieuw verwerken" niet start, MUST de beheerder een begrijpelijke foutmelding zien en MUST de status niet ten onrechte op "in verwerking" blijven staan.
- **FR-011**: Het verwijderen van een document MUST eerst om bevestiging vragen, met de documentnaam in de bevestiging.
- **FR-012**: Het verwijderen van een kennisitem MUST eerst om bevestiging vragen, met de naam van het kennisitem in de bevestiging.
- **FR-013**: Annuleren van een verwijderbevestiging MUST het item ongewijzigd laten.
- **FR-014**: De naam van een kennisbron MUST niet wijzigbaar zijn zolang de bron minstens één document bevat.
- **FR-015**: Bij een vergrendelde naam MUST de UI uitleggen dat de zoekstap op de naam filtert en dat hernoemen de documenten onvindbaar maakt.
- **FR-016**: Zodra een kennisbron geen documenten meer bevat, MUST de naam weer wijzigbaar zijn.
- **FR-017**: De beheerder MUST meerdere bestanden tegelijk kunnen kiezen voor upload.
- **FR-018**: De beheerder MUST bestanden naar het uploadgebied kunnen slepen en neerzetten.
- **FR-019**: Per bestand MUST de voortgang en het eindresultaat (gelukt of mislukt met reden) zichtbaar zijn.
- **FR-020**: Een mislukt bestand MUST afzonderlijk opnieuw geprobeerd kunnen worden, zonder geslaagde bestanden opnieuw te uploaden.
- **FR-021**: Bestanden toevoegen MUST volledig met het toetsenbord mogelijk zijn; slepen en neerzetten is nooit de enige bedieningswijze.
- **FR-022**: Het veld "Vector Collection ID" en de bijbehorende uitleg MUST uit de UI verdwijnen.
- **FR-023**: Het tabblad "Kennisitems" MUST uit de UI verdwijnen.
- **FR-024**: Bestaande databasekolommen en gegevens MUST behouden blijven; de feature voegt uitsluitend de nullable kolom `error_message` toe en wijzigt geen bestaande kolommen of rijen.
- **FR-025**: Alle beheeracties (opnieuw verwerken, verwijderen, uploaden, kennisbron bewerken) MUST alleen beschikbaar zijn voor beheerders.
- **FR-026**: Members MUST de statusinformatie (aantallen, laatste wijziging, documentstatus en foutreden) alleen-lezen kunnen zien, zonder beheeracties.
- **FR-027**: Verborgen beheeracties MUST ook niet via het toetsenbord bereikbaar zijn.

### Key Entities *(include if feature involves data)*

- **Kennisbron**: een bron van kennis voor assistenten, met een naam, beschrijving en documenten. De naam bepaalt hoe de zoekstap de documenten vindt; daarom is de naam vast zodra er documenten zijn.
- **Document**: een geüpload bestand binnen een kennisbron, met een naam, bestandstype, grootte, status (in verwerking, klaar, fout) en een tijdstip van laatste wijziging. De foutreden is optioneel en alleen beschikbaar als de verwerking die teruggeeft.
- **Kennisitem**: een tekstueel kennisitem binnen een kennisbron. Bestaande gegevens blijven bewaard, maar het onderdeel verdwijnt uit de UI en de verwerking ervan valt buiten scope.
- **Gebruiker met rol**: beheerder (mag beheren) of member (alleen lezen). De rol bepaalt welke acties zichtbaar en bereikbaar zijn.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een beheerder kan zonder een kennisbron te openen binnen 5 seconden zien welke bronnen documenten met fouten bevatten.
- **SC-002**: Een beheerder hoeft de pagina niet handmatig te herladen om een afgeronde verwerking te zien; de status is binnen 10 seconden na afronding zichtbaar.
- **SC-003**: Het automatisch verversen stopt binnen één verversingsinterval nadat het laatste document klaar is; er blijven geen periodieke verzoeken lopen.
- **SC-004**: 100% van de verwijderacties op documenten en kennisitems vraagt om bevestiging met de naam van het item.
- **SC-005**: Een poging om een kennisbron met documenten te hernoemen levert in 100% van de gevallen geen wijziging op en toont de uitleg.
- **SC-006**: Een beheerder kan tien bestanden in één handeling toevoegen in plaats van tien afzonderlijke handelingen.
- **SC-007**: 100% van de beheeracties is voor members onzichtbaar én niet met het toetsenbord bereikbaar, terwijl statusinformatie voor hen volledig leesbaar blijft.
- **SC-008**: Na de UI-wijziging zijn alle bestaande kennisbronnen, documenten en kennisitems ongewijzigd aanwezig in de database.

## Assumptions

- De bestaande documentstatussen blijven "in verwerking", "klaar" en "fout"; de UI vertaalt ze naar het Nederlands. Er komen geen nieuwe statussen bij.
- De foutreden komt uit de nieuwe nullable kolom `error_message`, die n8n later vult. Is die leeg, dan toont de UI "Fout" met een algemene Nederlandse fouttekst (geen verzonnen specifieke reden).
- "Laatst bijgewerkt" wordt afgeleid uit de meest recente wijziging van de kennisbron of een van haar documenten; bestaande tijdstippen zijn voldoende.
- De naam van een kennisbron wordt weer wijzigbaar zodra het aantal documenten nul is.
- Het automatisch verversen gebruikt een kort, vast interval (enkele seconden) en stopt volledig bij nul documenten in verwerking; er is geen handmatige verversknop nodig.
- Uploaden blijft het bestaande ondersteunde bestandstype en de bestaande limieten volgen; deze feature wijzigt alleen de selectie- en voortgangsbeleving.
- De serverroute voor documentindexering uit feature A bestaat en is de enige route voor (opnieuw) verwerken; de n8n-ingestflow zelf wordt niet gewijzigd.
- De rolverdeling uit feature B (beheerder versus member) is de bestaande bron van waarheid voor wie beheeracties mag uitvoeren; de database blijft dit afdwingen.
- Kennisitems blijven in de database bestaan, maar worden niet meer in de UI getoond en krijgen geen verwerking.
- Kennisbronnen blijven in de zoekstap op naam gefilterd; het omzetten naar filteren op id valt buiten scope.
