# Feature Specification: Assistenten verwijderen uit de AI-assistentenlijst

**Feature Branch**: `023-delete-assistants`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "zorg dat ik de assistenten onder AI-assistenten kan verwijderen"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Een assistent verwijderen vanaf AI-assistenten (Priority: P1)

Als platformbeheerder zie ik op de pagina AI-assistenten bij elke assistent een
verwijderknop. Ik klik erop, krijg een bevestigingsvenster met de naam van de
assistent en de gevolgen van verwijderen, en bevestig of annuleer. Na bevestigen
verdwijnt de assistent uit de lijst en krijg ik een Nederlandse bevestiging.

**Why this priority**: Dit is de gevraagde handeling. Zonder deze knop kan een
assistent die niet meer nodig is nooit uit de catalogus verdwijnen.

**Independent Test**: Volledig te testen met een platformbeheerdersaccount: open
AI-assistenten, klik bij een assistent op verwijderen, annuleer en controleer dat
er niets veranderd is; herhaal en bevestig, en controleer dat de assistent uit de
lijst verdwenen is en dat een bevestiging verschijnt.

**Acceptance Scenarios**:

1. **Given** een platformbeheerder op de pagina AI-assistenten, **When** deze de
   pagina bekijkt, **Then** heeft elke assistent een verwijderknop met een
   toegankelijke naam die de assistentnaam bevat.
2. **Given** de platformbeheerder klikt op de verwijderknop, **When** het venster
   opent, **Then** staan de assistentnaam, de mededeling dat de assistent voor alle
   organisaties verdwijnt, dat bestaande gesprekken en analyses leesbaar blijven en
   dat de assistent via het archief hersteld kan worden in het venster, met de
   knoppen "Annuleren" en "Verwijderen".
3. **Given** het bevestigingsvenster, **When** de platformbeheerder "Annuleren"
   kiest of het venster sluit, **Then** is er niets verwijderd en is de lijst
   ongewijzigd.
4. **Given** het bevestigingsvenster, **When** de platformbeheerder "Verwijderen"
   bevestigt en het verwijderen slaagt, **Then** verdwijnt de assistent zonder
   herladen uit de lijst en verschijnt een Nederlandse bevestiging.
5. **Given** de platformbeheerder gebruikt uitsluitend het toetsenbord, **When**
   deze de verwijderknop en het bevestigingsvenster bedient, **Then** zijn alle
   bedieningselementen bereikbaar, is de focus zichtbaar en keert de focus na
   sluiten terug naar de verwijderknop.

---

### User Story 2 - Een verwijderde assistent is voor gebruikers overal weg en onbruikbaar (Priority: P1)

Als adviseur of kantoorbeheerder merk ik dat een verwijderde assistent nergens meer
bestaat: niet op AI-assistenten, niet op het startscherm, niet in de geschiedenis en
niet via een directe link. Een nieuw gesprek of een nieuwe analyse is niet mogelijk.
Bestaande gesprekken en analyses blijven leesbaar.

**Why this priority**: Verwijderen is alleen geloofwaardig als de assistent echt
uit alle aanbiedingen verdwijnt. Een verborgen maar bereikbare assistent blijft een
veiligheids- en beheerrisico.

**Independent Test**: Volledig te testen met een adviseursaccount en een
platformbeheerdersaccount: verwijder een assistent, controleer de lijst, het
startscherm, de geschiedenis en een directe link, en controleer dat een nieuw
bericht of een nieuwe analyse niet meer start.

**Acceptance Scenarios**:

1. **Given** een verwijderde assistent, **When** een gebruiker de pagina
   AI-assistenten opent, **Then** staat de assistent er voor geen enkele
   organisatie meer tussen, ook niet als inactief.
2. **Given** dezelfde assistent, **When** een gebruiker het startscherm of de
   geschiedenis opent, **Then** wordt de assistent daar niet aangeboden.
3. **Given** dezelfde assistent, **When** een gebruiker een directe link naar een
   nieuw gesprek of een nieuwe analyse opent, **Then** kan deze niet starten en
   verschijnt de bestaande melding dat de assistent niet beschikbaar is.
4. **Given** dezelfde assistent, **When** de platformbeheerder Instellingen opent,
   **Then** staat de assistent niet meer in de rij schakelaars van een organisatie
   en niet meer in het venster Koppelingen.
5. **Given** een bestaand gesprek met de verwijderde assistent, **When** een
   gebruiker dit opent, **Then** blijven de bestaande berichten leesbaar en wordt
   een nieuw bericht geweigerd met de bestaande foutmelding.
6. **Given** een verwijderde assistent, **When** de gebruiker de pagina opnieuw
   laadt, **Then** is de assistent nog steeds verdwenen.

---

### User Story 3 - Alleen de platformbeheerder kan verwijderen of herstellen (Priority: P1)

Als kantoorbeheerder of adviseur zie ik geen verwijder- of herstelknop en kan ik een
assistent ook buiten de gebruikersinterface om niet verwijderen of herstellen. De
server weigert elke poging van een andere rol.

**Why this priority**: De catalogus is platformbreed bezit. Zonder
serverafdwinging kan een kantoorbeheerder via een directe aanroep alsnog assistenten
van andere organisaties laten verdwijnen of terugzetten.

**Independent Test**: Volledig te testen met een kantoorbeheerders- en een
adviseursaccount: controleer dat er geen verwijder- of herstelbesturing zichtbaar is
en dat een directe aanroep naar de beheerroute met een 403 wordt geweigerd zonder dat
er iets verandert.

**Acceptance Scenarios**:

1. **Given** een kantoorbeheerder of adviseur op AI-assistenten, **When** deze de
   pagina bekijkt of met het toetsenbord doorloopt, **Then** zijn er geen
   verwijderknop, geen archieflijst en geen herstelknop bereikbaar.
2. **Given** een kantoorbeheerder of adviseur, **When** deze buiten de
   gebruikersinterface om een verwijder- of herstelactie uitvoert, **Then** weigert
   de server de actie met een 403 en verandert er niets.
3. **Given** een niet-ingelogde bezoeker, **When** deze een verwijder- of
   herstelactie aanroept, **Then** weigert de server de actie met een 401.

---

### User Story 4 - Een mislukte of botsende verwijdering laat niets half achter (Priority: P2)

Als platformbeheerder krijg ik bij een mislukte verwijdering een Nederlandse
foutmelding en blijft de assistent volledig bestaan. Verwijderen is alles-of-niets,
ook als een andere beheerder dezelfde assistent net heeft verwijderd.

**Why this priority**: Een half verwijderde assistent levert zwevende gesprekken,
schakelaars en koppelingen op. Dat is lastiger te herstellen dan een duidelijke fout.

**Independent Test**: Volledig te testen door de opslag op serverniveau te laten
mislukken en door dezelfde assistent tweemaal kort na elkaar te verwijderen:
controleer dat de assistent of volledig bestaat of volledig weg is, met een
begrijpelijke Nederlandse melding.

**Acceptance Scenarios**:

1. **Given** een platformbeheerder bevestigt een verwijdering, **When** het
   verwijderen op de server mislukt, **Then** blijft de assistent met al zijn
   schakelaars en koppelingen bestaan en verschijnt een Nederlandse foutmelding.
2. **Given** twee platformbeheerders verwijderen dezelfde assistent kort na elkaar,
   **When** de tweede bevestigt, **Then** verschijnt een Nederlandse melding dat de
   assistent al verwijderd is en wordt de lijst bijgewerkt zonder foutpagina.
3. **Given** een mislukte verwijdering, **When** de platformbeheerder het venster
   sluit, **Then** staat de assistent nog steeds op zijn plaats in de lijst.

---

### User Story 5 - Een verwijderde assistent herstellen vanuit het archief (Priority: P2)

Als platformbeheerder open ik vanaf AI-assistenten het archief. Daar zie ik de
verwijderde assistenten met icoon, naam, type en de datum waarop ze verwijderd zijn.
Met één knop herstel ik een assistent; daarna is deze weer zichtbaar en bruikbaar
voor alle organisaties, met dezelfde aan/uit-stand per organisatie als vóór het
verwijderen. Bestaande gesprekken en analyses zijn dan weer op de gebruikelijke
manier bereikbaar.

**Why this priority**: Zonder herstelmogelijkheid is verwijderen onomkeerbaar. Het
archief maakt de verwijdering veilig en maakt het mogelijk een vergissing te
corrigeren zonder gegevens te verliezen.

**Independent Test**: Volledig te testen met een platformbeheerdersaccount: verwijder
een assistent, open het archief, herstel de assistent en controleer dat deze weer op
AI-assistenten staat, dat de schakelaars per organisatie gelijk zijn aan de stand
vóór het verwijderen en dat bestaande gesprekken weer op de gebruikelijke manier
bereikbaar zijn.

**Acceptance Scenarios**:

1. **Given** een verwijderde assistent, **When** de platformbeheerder het archief
   opent, **Then** ziet deze de assistent met icoon, naam, type en de datum van
   verwijderen, en een herstelknop met een toegankelijke naam.
2. **Given** een gearchiveerde assistent, **When** de platformbeheerder deze herstelt
   en het herstellen slaagt, **Then** is de assistent direct weer zichtbaar op
   AI-assistenten en gelden voor iedere organisatie dezelfde aan/uit-standen als
   vóór het verwijderen.
3. **Given** een gearchiveerde assistent met bestaande gesprekken, **When** de
   assistent is hersteld, **Then** zijn die gesprekken weer op de gebruikelijke
   manier bereikbaar en kan een gebruiker weer een nieuw bericht sturen.
4. **Given** een leeg archief, **When** de platformbeheerder het opent, **Then**
   verschijnt een Nederlandse lege toestand.
5. **Given** een platformbeheerder die uitsluitend het toetsenbord gebruikt, **When**
   deze het archief opent en een assistent herstelt, **Then** zijn alle
   bedieningselementen bereikbaar en is de focus zichtbaar.

---

### Edge Cases

- **Assistent met bestaande gesprekken**: de gesprekken en analyses blijven leesbaar;
  de assistent wordt verborgen bewaard en is via het archief te herstellen.
- **Assistent van het type risico-analyse met uitgevoerde analyses**: de
  analyse-uitkomsten en bijbehorende dossiers blijven bewaard en leesbaar.
- **Assistent met gekoppelde kennisbronnen**: de koppelingen blijven bewaard maar
  gelden niet zolang de assistent verwijderd is; de kennisbronnen zelf en hun
  documenten blijven bestaan. Bij herstel gelden de koppelingen weer.
- **Assistent die bij meerdere organisaties aan staat**: de assistent verdwijnt voor
  alle organisaties tegelijk en keert bij herstel met dezelfde standen terug.
- **Nieuwe organisatie na het verwijderen**: bij herstel krijgt die organisatie de
  assistent niet automatisch aangezet; bestaande organisaties houden hun oude stand.
- **Naam van een gearchiveerde assistent wordt hergebruikt voor een nieuwe
  assistent**: beide blijven afzonderlijk bestaan; herstellen veroorzaakt geen
  conflict.
- **Laatste assistent in de catalogus**: de pagina toont daarna de bestaande lege
  toestand met de knop om een nieuwe assistent aan te maken.
- **Gebruiker heeft een gesprek open tijdens verwijderen**: een volgend bericht wordt
  geweigerd met de bestaande foutmelding; de pagina crasht niet. Na herstel werkt het
  gesprek weer.
- **Tweemaal verwijderen**: de tweede poging geeft een begrijpelijke melding en
  verandert niets.
- **Tweemaal herstellen**: de tweede poging geeft een begrijpelijke melding en
  verandert niets.
- **Netwerkfout tijdens bevestigen of herstellen**: er is niets gewijzigd en de
  foutmelding is zichtbaar.
- **Verwijderen of herstellen terwijl de verbinding met de server traag is**: de knop
  toont een wachtstand en is niet tweemaal indienbaar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Alleen de platformbeheerder MOET op de pagina AI-assistenten bij elke
  assistent een verwijderknop zien. Kantoorbeheerders en adviseurs MOETEN deze
  besturing niet zien of kunnen bereiken.
- **FR-002**: De verwijderknop MOET met het toetsenbord bedienbaar zijn en een
  toegankelijke naam hebben die de assistentnaam bevat.
- **FR-003**: Een klik op de verwijderknop MOET een bevestigingsvenster openen met de
  assistentnaam, de mededeling dat de assistent voor alle organisaties verdwijnt, dat
  bestaande gesprekken en analyses leesbaar blijven en dat de assistent via het
  archief hersteld kan worden, en de knoppen "Annuleren" en "Verwijderen".
  "Annuleren" MOET de standaardkeuze zijn.
- **FR-004**: Verwijderen MOET pas gebeuren na een expliciete bevestiging in dat
  venster. Sluiten of annuleren MAG niets wijzigen.
- **FR-005**: Bij verwijderen MOET de assistent voor alle organisaties uit alle
  gebruikersaanbiedingen verdwijnen: uit de lijst op AI-assistenten, uit het
  startscherm, uit de geschiedenis, uit de schakelaars in Instellingen en uit het
  venster Koppelingen.
- **FR-006**: Een directe link naar een nieuw gesprek of een nieuwe analyse met een
  verwijderde assistent MOET niet tot een bruikbare assistent leiden en MOET de
  bestaande melding tonen dat de assistent niet beschikbaar is.
- **FR-007**: Bestaande gesprekken en analyses met de verwijderde assistent MOETEN
  bewaard en leesbaar blijven. De assistent MOET daarvoor verborgen worden bewaard en
  MAG voor gebruikers nergens meer zichtbaar of bruikbaar zijn.
- **FR-008**: Koppelingen tussen de verwijderde assistent en kennisbronnen MOETEN
  voor gebruikers niet meer actief zijn. De kennisbronnen en hun documenten MOETEN
  ongewijzigd blijven bestaan. Bij herstel MOETEN de koppelingen weer gelden.
- **FR-009**: Andere assistenten, hun schakelaars, koppelingen en geschiedenis MOGEN
  niet veranderen door een verwijdering.
- **FR-010**: De server MOET de verwijderactie uitsluitend toestaan voor een
  platformbeheerder en MOET elke andere rol met een 403 en een niet-ingelogde
  aanroep met een 401 weigeren.
- **FR-011**: Verwijderen MOET alles-of-niets zijn: bij een fout op de server blijft
  de assistent met alle schakelaars en koppelingen volledig bestaan.
- **FR-012**: Na een geslaagde verwijdering MOET de assistent zonder volledige
  herlaad van de pagina uit de lijst verdwijnen en MOET een Nederlandse bevestiging
  verschijnen.
- **FR-013**: Bij een mislukte verwijdering MOET een Nederlandse foutmelding
  verschijnen en MOET de lijst ongewijzigd blijven.
- **FR-014**: Wordt een al verwijderde assistent nogmaals verwijderd, dan MOET een
  begrijpelijke Nederlandse melding verschijnen en MAG er geen foutpagina ontstaan.
- **FR-015**: Tijdens het verwijderen MOET de knop een wachtstand tonen en MOET
  dubbel indienen onmogelijk zijn.
- **FR-016**: Alle nieuwe interfaceteksten MOETEN in het Nederlands zijn en de
  u-vorm gebruiken.
- **FR-017**: De verwijderactie MOET via de bestaande beveiligde beheerroute verlopen;
  geheimen en sleutels MOGEN niet in de frontend terechtkomen.
- **FR-018**: Logs van de verwijderactie MOGEN alleen codes, actie, identificaties en
  duur bevatten, geen gespreksinhoud, klantgegevens of tokens.
- **FR-019**: Een verwijderde assistent MOET uitsluitend voor de platformbeheerder
  zichtbaar zijn in een archief dat vanaf AI-assistenten te openen is. Het archief
  MOET per assistent icoon, naam, type en de datum van verwijderen tonen.
- **FR-020**: De platformbeheerder MOET een gearchiveerde assistent kunnen herstellen.
  Daarna MOET de assistent weer op AI-assistenten staan en MOET elke organisatie
  dezelfde aan/uit-stand hebben als vóór het verwijderen.
- **FR-021**: Een organisatie die pas na het verwijderen is aangemaakt, MAG de
  herstelde assistent niet automatisch aangezet krijgen.
- **FR-022**: Herstellen MOET uitsluitend via de beveiligde beheerroute verlopen en
  MOET door de server met een 403 respectievelijk 401 worden geweigerd voor andere
  rollen en niet-ingelogde bezoekers.
- **FR-023**: Herstellen MOET alles-of-niets zijn: bij een fout op de server blijft de
  assistent gearchiveerd en verschijnt een Nederlandse foutmelding.
- **FR-024**: Wordt een al herstelde of niet-bestaande assistent hersteld, dan MOET een
  begrijpelijke Nederlandse melding verschijnen en MAG er geen foutpagina ontstaan.
- **FR-025**: Het archief MOET met het toetsenbord te bedienen zijn en bij een leeg
  archief een Nederlandse lege toestand tonen.
- **FR-026**: De archieflijst MAG voor kantoorbeheerders en adviseurs niet zichtbaar of
  bereikbaar zijn.
- **FR-027**: Logs van het herstellen MOETEN aan dezelfde beperking als FR-018 voldoen.

### Key Entities

- **Catalogusassistent**: platformbrede definitie van een assistent met icoon, naam,
  type, beschrijving, voorbeeldvragen en koppelings-URL's; de eenheid die de
  platformbeheerder verwijdert en herstelt.
- **Organisatie-assistent**: de rij per organisatie die bepaalt of een
  catalogusassistent voor die organisatie aan staat en waaraan gesprekken en
  kennisbronkoppelingen hangen; verdwijnt uit het zicht mee met de catalogusassistent
  en keert bij herstel terug met dezelfde stand.
- **Archief**: de lijst met verwijderde assistenten die alleen de platformbeheerder
  ziet en van waaruit deze een assistent kan herstellen.
- **Gesprek en bericht**: geschiedenis van een gebruiker met een assistent; blijft
  bewaard en leesbaar na verwijderen van de assistent.
- **Analyse-uitvoering**: risico-analyse van een gebruiker met een assistent,
  inclusief uitkomst en dossier; blijft bewaard en leesbaar na verwijderen van de
  assistent.
- **Kennisbronkoppeling**: verbinding tussen een kennisbron van een organisatie en
  een organisatie-assistent; blijft bewaard maar geldt niet zolang de assistent
  verwijderd is. De kennisbron zelf blijft bestaan.
- **Platformbeheerder**: de enige rol die mag verwijderen en herstellen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een platformbeheerder kan een assistent vanaf AI-assistenten in
  maximaal drie handelingen verwijderen (verwijderknop, bevestigen, lijst vernieuwen),
  en de assistent is daarna in 100% van de gevallen uit alle organisaties verdwenen.
- **SC-002**: Na verwijderen is de assistent voor gebruikers in 0 gevallen nog
  zichtbaar of bruikbaar op AI-assistenten, het startscherm, de geschiedenis, een
  directe link, de schakelaars in Instellingen of het venster Koppelingen; alleen de
  platformbeheerder ziet de assistent in het archief.
- **SC-003**: 100% van de verwijder- en herstelpogingen door een kantoorbeheerder,
  adviseur of niet-ingelogde bezoeker wordt door het systeem geweigerd, zonder dat de
  assistent of zijn gegevens veranderen.
- **SC-004**: Bij een mislukte verwijdering of herstelactie blijft in 100% van de
  gevallen de volledige assistent bestaan; er zijn 0 gevallen met een half
  verwijderde of half herstelde assistent.
- **SC-005**: 100% van de nieuwe interfaceteksten is Nederlands in de u-vorm en het
  volledige verwijder- en herstelproces is met alleen het toetsenbord te doorlopen.
- **SC-006**: Bestaande gesprekken en analyses van een verwijderde assistent blijven
  in 100% van de gevallen bewaard en leesbaar; er gaan 0 berichten of analyses
  verloren door verwijderen.
- **SC-007**: De bestaande regressietestsuite blijft groen en er ontstaan geen nieuwe
  fouten in de build of de statische controle.
- **SC-008**: Een platformbeheerder kan een gearchiveerde assistent in maximaal drie
  handelingen herstellen (archief openen, herstellen, bevestigen), waarna 100% van de
  organisaties dezelfde aan/uit-stand ziet als vóór het verwijderen.

## Assumptions

- Verwijderen gebeurt op de pagina AI-assistenten en geldt voor de hele catalogus,
  dus voor alle organisaties. Een assistent alleen voor de eigen organisatie
  verbergen blijft de bestaande schakelaar in Instellingen.
- Verwijderen is archiveren: de assistent verdwijnt uit alle aanbiedingen voor
  gebruikers en is alleen voor de platformbeheerder zichtbaar in het archief. Herstel
  is altijd mogelijk; er is geen automatische definitieve opruiming.
- Het archief is onderdeel van de pagina AI-assistenten en wordt met een aparte knop
  geopend; een aparte beheerpagina is niet nodig.
- Er is geen aparte bulkverwijdering of bulkherstel; de platformbeheerder handelt één
  assistent per keer af.
- De platformbeheerder is de enige rol met toegang tot deze pagina en tot de
  beheerroute; de bestaande rolinrichting blijft ongewijzigd.
- Het bevestigingsvenster gebruikt de bestaande venster- en meldingspatronen van de
  applicatie.
- Na verwijderen of herstellen wordt de lijst opnieuw opgehaald of lokaal bijgewerkt;
  de pagina hoeft niet volledig herladen te worden.
- De assistentnaam is geen unieke sleutel; verwijderen en herstellen gebeuren op de
  interne identificatie, niet op de naam.
- De bestaande foutmelding voor een niet-beschikbare assistent blijft ongewijzigd.
- Bij herstel gelden de kennisbronkoppelingen van vóór het verwijderen weer; de
  platformbeheerder hoeft ze niet opnieuw in te stellen.
- De aan/uit-stand per organisatie van vóór het verwijderen blijft bewaard en geldt
  weer na herstel.

**Buiten scope**:

- Bulkverwijdering of bulkherstel van meerdere assistenten.
- Het definitief en onomkeerbaar verwijderen van gearchiveerde assistenten of het
  instellen van een bewaartermijn.
- Het verwijderen van kennisbronnen of documenten.
- Rolbeheer in de gebruikersinterface.
- Het aanpassen van de systeeminstructie van een assistent.
- Het opruimen van de oude koppelingentabel `flow_configs` of de oude
  webhook-URL-kolom.
