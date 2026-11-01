# Feature Specification: Risico-analyse via de serverroute

**Feature Branch**: `021-analysis-server-route`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Risico-analyse via de serverroute. Huidige situatie: src/lib/analysis-client.ts roept vanuit de browser VITE_ANALYSIS_API_URL aan (POST /analysis-runs, GET /analysis-runs/:id, GET /analysis-runs?advisor_id=). Lokaal is dat scripts/mock-analysis-server.mjs. Het echte backend uit specs/008-risico-analyse-ui/contracts/ (Edge Function, tabel analysis_runs, callback) is nooit gebouwd. Bij bestanden stuurt de browser alleen de bestandsnamen mee, niet de inhoud. De n8n-flow 'Darwin - Risico-analyse' antwoordt direct met 202 en meldt het resultaat later via een POST op callback_url: bij een fout JSON { run_id, status: 'error', code, message }, bij succes multipart met run_id, status 'ok', analyse (JSON-string), intern_markdown en het bestand dossier_docx. Bestanden verwacht de flow als bestanden: [{ naam, type, data }] met data in base64. Sinds de feature platformbeheer staat de productie-URL van de risico-analyse in de assistentcatalogus en staan header en secret centraal in platform_webhook_config. Doel: de risico-analyse loopt net als chat uitsluitend via de server. Geen backend-URL, geen secret en geen tenantbeslissing in de browser."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Analyse starten via de serverroute (Priority: P1)

Als financieel adviseur vul ik het analyseformulier in en start ik de analyse. Darwin
controleert mijn sessie en mijn organisatie, controleert dat de gekozen assistent actief is
en van het type risico-analyse is, legt de uitvoering vast en stuurt deze met het centrale
geheim naar de productie-URL van die assistent. Ik hoef niets te weten van adressen,
geheimen of organisatie-instellingen.

**Why this priority**: zonder deze stap ontstaat er geen uitvoering. Dit is de kern van de
feature: de analyse verlaat de browser niet meer rechtstreeks en de server is de enige die
bepaalt naar welke koppeling en met welk geheim er wordt verstuurd.

**Independent Test**: Volledig te testen met een adviseursaccount: start een analyse met
geldige invoer en stel vast dat er een uitvoering in de wachtrij ontstaat en dat het
verzoek via de server naar de geconfigureerde productie-URL gaat. Herhaal met een
uitgezette assistent, een assistent van een ander type, een assistent van een andere
organisatie en zonder productie-URL en stel vast dat er een Nederlandse melding verschijnt
en géén uitvoering ontstaat.

**Acceptance Scenarios**:

1. **Given** een ingelogde adviseur en een actieve assistent van het type risico-analyse
   binnen de eigen organisatie, **When** de adviseur een geldig formulier verstuurt,
   **Then** wordt de uitvoering als "in wachtrij" vastgelegd en namens de server met het
   centrale geheim naar de productie-URL van die assistent gestuurd.
2. **Given** een assistent die voor de organisatie is uitgezet, onbekend is, of niet van
   het type risico-analyse is, **When** de adviseur de analyse start, **Then** verschijnt
   een Nederlandse foutmelding en ontstaat er geen uitvoering.
3. **Given** een assistent zonder productie-URL in de catalogus, **When** de adviseur de
   analyse start, **Then** toont de UI "Er is geen koppeling geconfigureerd. Neem contact
   op met de beheerder." en ontstaat er geen uitvoering.
4. **Given** een verlopen of ongeldige sessie, **When** de analyse wordt gestart,
   **Then** wordt de start geweigerd met de bestaande Nederlandse sessiemelding en
   ontstaat er geen uitvoering.
5. **Given** een assistent van een andere organisatie, **When** de adviseur deze via een
   directe verwijzing probeert te gebruiken, **Then** wordt de start geweigerd en ontstaat
   er geen uitvoering.
6. **Given** de browser van de adviseur, **When** de analyse wordt gestart, **Then** gaat
   er geen verzoek van de browser naar de productie-URL en is het centrale geheim niet in
   de browser aanwezig of leesbaar.

---

### User Story 2 - Status volgen en resultaat bekijken (Priority: P1)

Als adviseur volg ik na het starten de status van mijn uitvoering (in wachtrij, bezig,
gereed, mislukt) en bekijk ik bij een geslaagde uitvoering het resultaat. De pagina's voor
een nieuwe analyse, een lopende analyse, de recente uitvoeringen, het startscherm en de
geschiedenis werken zoals nu.

**Why this priority**: de analyse duurt één tot drie minuten. Zonder betrouwbare status
en een blijvend adres om terug te keren is de analyse in de dagelijkse praktijk
onbruikbaar, ook al is het starten zelf gelukt.

**Independent Test**: Een uitvoering starten, wegnavigeren en later terugkeren; vaststellen
dat de status actueel is en dat een afgeronde uitvoering het resultaat toont. Daarna met
een tweede adviseursaccount het adres van de eerste uitvoering openen en vaststellen dat
er geen inhoud verschijnt.

**Acceptance Scenarios**:

1. **Given** een uitvoering is gestart en nog niet afgerond, **When** de adviseur de
   uitvoering opent, **Then** ziet deze "in wachtrij" of "bezig" met de verstreken tijd.
2. **Given** de analyseservice meldt het resultaat, **When** de adviseur de uitvoering
   bekijkt, **Then** toont de kaart "gereed" (of "mislukt") en kan de adviseur het
   resultaat openen.
3. **Given** de adviseur voert het uitvoeringsnummer van een andere adviseur in,
   **When** de uitvoering wordt geopend, **Then** verschijnt de bestaande Nederlandse
   melding dat de analyse niet bestaat of niet toegankelijk is, zonder enige inhoud van
   de ander.
4. **Given** de verbinding valt weg tijdens het volgen van de status, **When** de status
   niet kan worden opgehaald, **Then** ziet de adviseur een expliciete Nederlandse
   foutstatus in plaats van een stil blijvende kaart.
5. **Given** de adviseur opent de lijst recente uitvoeringen, het startscherm of de
   geschiedenis, **When** de lijst wordt getoond, **Then** ziet deze uitsluitend eigen
   uitvoeringen, herkenbaar aan klantreferentie, status en starttijd, zonder
   analyse-inhoud, bestandsnamen of URL's.
6. **Given** een uitvoering die na het starten is afgerond, **When** de adviseur de
   resultaatweergave opent, **Then** is de weergave ongewijzigd ten opzichte van de
   bestaande pagina's en draagt elke uitkomst het label "CONCEPT".

---

### User Story 3 - Bestanden toevoegen zonder ze te bewaren (Priority: P1)

Als adviseur voeg ik pdf-, docx- en txt-bestanden toe aan de analyse. De inhoud gaat via
de server naar de analyseservice en wordt nergens bewaard: niet in de browseropslag, niet
in de database en niet in bestandsopslag.

**Why this priority**: bestanden bevatten de meest gevoelige klantgegevens. De inhoud moet
de browser verlaten om de analyse te laten werken, maar zodra die inhoud wordt bewaard
ontstaat een gegevensbeschermingsrisico dat de feature onacceptabel maakt.

**Independent Test**: Een analyse starten met één pdf, één docx en één txt-bestand en
vaststellen dat de analyseservice de bestanden met inhoud ontvangt. Daarna controleren dat
na het versturen geen bestandsinhoud in browseropslag, database, bestandsopslag, logs of
netwerkadressen achterblijft.

**Acceptance Scenarios**:

1. **Given** de adviseur selecteert een pdf-, docx- of txt-bestand binnen de limieten,
   **When** de analyse wordt gestart, **Then** ontvangt de analyseservice de bestandsnaam,
   het bestandstype en de inhoud van elk bestand.
2. **Given** een bestand dat groter is dan 10 MB of een totaal boven 25 MB, **When** de
   adviseur dit toevoegt of verstuurt, **Then** verschijnt een Nederlandse melding bij
   Bestanden en wordt de analyse niet gestart.
3. **Given** een bestand met een ander type dan pdf, docx of txt, **When** de adviseur dit
   toevoegt, **Then** wordt het bestand geweigerd met een Nederlandse melding.
4. **Given** de analyse is gestart, **When** het versturen lukt of mislukt, **Then** is de
   bestandsinhoud niet meer in de browser aanwezig en is er niets van de inhoud bewaard in
   browseropslag, database, bestandsopslag, logs, analysegegevens of netwerkadressen.
5. **Given** de adviseur probeert de limieten te omzeilen, **When** het verzoek de server
   bereikt, **Then** weigert de server het bestand of de analyse met een Nederlandse
   foutmelding en ontstaat er geen uitvoering.

---

### User Story 4 - Klantdossier downloaden (Priority: P1)

Als adviseur download ik na een geslaagde analyse het klantdossier (.docx) zolang de
uitvoering niet is verlopen. Alleen ik kan dat dossier downloaden.

**Why this priority**: het dossier is het werkproduct dat de adviseur met de klant
bespreekt. Zonder download levert de analyse geen bruikbaar resultaat op, terwijl een
dossier dat voor anderen bereikbaar is een directe inbreuk op de vertrouwelijkheid is.

**Independent Test**: Een geslaagde uitvoering openen, het dossier downloaden en
vaststellen dat het bestand overeenkomt met wat de analyseservice leverde. Daarna met een
andere gebruiker de download proberen en vaststellen dat dit wordt geweigerd.

**Acceptance Scenarios**:

1. **Given** een geslaagde uitvoering die nog niet is verlopen, **When** de adviseur op
   downloaden klikt, **Then** ontvangt deze het dossier als .docx met het label "CONCEPT,
   door adviseur te accorderen".
2. **Given** een andere gebruiker, **When** deze de download van andermans uitvoering
   probeert, **Then** wordt de download geweigerd zonder inhoud of bestandsnaam prijs te
   geven.
3. **Given** een uitvoering waarvan het resultaat is verlopen, **When** de adviseur de
   download probeert, **Then** verschijnt een Nederlandse melding dat het dossier niet
   meer beschikbaar is.

---

### User Story 5 - Alleen de analyseservice rondt een uitvoering af (Priority: P1)

Als beheerder wil ik dat uitsluitend de analyseservice een uitvoering kan afronden. Een
melding zonder geldige handtekening, voor een onbekende uitvoering of voor een uitvoering
die al is afgerond, wordt geweigerd en verandert niets.

**Why this priority**: het resultaat en het dossier zijn de enige inhoud die de adviseur
ziet. Als iemand anders een uitvoering kan afronden of overschrijven, kan valse of
andermans inhoud in een klantdossier belanden.

**Independent Test**: De afronding van een uitvoering naspelen met een geldige
handtekening, met een ongeldige handtekening, zonder handtekening, met een onbekend
uitvoeringsnummer en voor een al afgeronde uitvoering; telkens de status en inhoud
controleren.

**Acceptance Scenarios**:

1. **Given** een uitvoering in de wachtrij of bezig, **When** de analyseservice een
   succesmelding met geldige handtekening stuurt, **Then** wordt de uitvoering "gereed"
   met het resultaat, de interne analyse en het dossier.
2. **Given** een uitvoering in de wachtrij of bezig, **When** de analyseservice een
   foutmelding met geldige handtekening stuurt, **Then** wordt de uitvoering "mislukt" met
   de foutcode en de Nederlandse melding.
3. **Given** een melding zonder geldige handtekening, **When** deze de server bereikt,
   **Then** wordt de melding geweigerd en blijven status en inhoud ongewijzigd.
4. **Given** een uitvoering die al is afgerond, **When** opnieuw een melding binnenkomt,
   **Then** wordt deze geweigerd en blijft het bestaande resultaat ongewijzigd.
5. **Given** een melding voor een onbekende of verlopen uitvoering, **When** deze de
   server bereikt, **Then** wordt deze geweigerd.
6. **Given** een succesmelding met ongeldige of onvolledige analyse-inhoud, **When** deze
   de server bereikt, **Then** wordt de melding geweigerd en blijft de uitvoering in zijn
   bestaande toestand.

---

### User Story 6 - Verlopen uitvoeringen en dossiers verdwijnen (Priority: P2)

Als beheerder wil ik dat uitvoeringen en dossiers na de bewaartermijn automatisch
verdwijnen. Een verlopen uitvoering is niet meer in de lijst zichtbaar en een oud adres
levert niets meer op.

**Why this priority**: de bewaartermijn begrenst het gegevensbeschermingsrisico. Het is
minder urgent dan de kernflow, maar zonder opruimen blijft klantinhoud onbeperkt staan.

**Independent Test**: Een uitvoering met een verstreken bewaartermijn openen, in de lijst
zoeken en de download proberen; vaststellen dat de uitvoering en het dossier weg zijn.

**Acceptance Scenarios**:

1. **Given** een uitvoering waarvan de bewaartermijn is verstreken, **When** de adviseur
   de lijst opent, **Then** staat de uitvoering er niet meer in.
2. **Given** een oud adres van een verlopen uitvoering, **When** de adviseur dit opent,
   **Then** verschijnt de bestaande Nederlandse melding dat de analyse niet bestaat of
   niet toegankelijk is.
3. **Given** een verlopen uitvoering, **When** het opruimen heeft gelopen, **Then** zijn
   de uitvoeringsgegevens en het dossier verwijderd.

---

### Edge Cases

- **Uitgezette assistent terwijl een uitvoering loopt**: de lopende uitvoering wordt
  gewoon afgerond en blijft leesbaar; alleen een nieuwe start wordt geweigerd.
- **Uitvoering wordt nooit afgerond**: de uitvoering blijft in de laatste status staan
  tot de bewaartermijn verstrijkt; de opruiming verwijdert hem dan. De kaart blijft een
  expliciete status tonen en wordt nooit een lege weergave. (Een run-level time-out is
  geen onderdeel van deze route; de analyseservice meldt fouten via de callback.)
- **De analyseservice antwoordt direct met een fout of is onbereikbaar**: de uitvoering
  wordt "mislukt" met een Nederlandse melding; de adviseur kan opnieuw proberen.
- **Twee keer dezelfde succesmelding**: de tweede melding wordt geweigerd; het eerste
  resultaat blijft staan.
- **Succesmelding en foutmelding kort na elkaar**: alleen de eerste afronding geldt.
- **Resultaat verlopen terwijl de adviseur de pagina open heeft**: de pagina toont de
  bestaande Nederlandse "niet gevonden"-melding in plaats van een lege weergave.
- **Bestand precies op de limiet**: 10 MB per bestand en 25 MB totaal worden geaccepteerd;
  één byte meer wordt geweigerd.
- **Meerdere bestanden met dezelfde naam**: alle bestanden worden afzonderlijk meegestuurd;
  de analyse wordt niet geweigerd.
- **Geen bestanden, geen klantsituatie en geen URL's**: de bestaande groepsvalidatie blijft
  gelden en er wordt niets verstuurd.
- **Sessie verloopt tijdens het wachten op het resultaat**: de adviseur moet opnieuw
  inloggen; de uitvoering blijft bestaan en is daarna weer zichtbaar.
- **Adviseur wisselt van organisatie**: bestaande uitvoeringen blijven eigendom van de
  oorspronkelijke adviseur en zijn niet voor anderen zichtbaar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: De browser MOET voor de risico-analyse geen adres van de analyseservice,
  geen webhookgeheim en geen tenantkeuze bevatten of meesturen; elk verzoek van de
  adviseur MOET via de server van Darwin lopen.
- **FR-002**: De server MOET bij elke start de sessie van de gebruiker controleren en de
  organisatie uitsluitend afleiden uit het profiel van die gebruiker, nooit uit gegevens
  die de browser meestuurt.
- **FR-003**: De server MOET weigeren wanneer de assistent onbekend is, niet bij de
  organisatie van de gebruiker hoort, niet actief is, of niet van het type risico-analyse
  is; de gebruiker krijgt een Nederlandse melding en er ontstaat geen uitvoering.
- **FR-004**: De server MOET vóór het versturen een uitvoering vastleggen met een uniek
  nummer, de eigenaar, de assistent, de klantreferentie, de status "in wachtrij", het
  starttijdstip en de uiterste bewaartermijn.
- **FR-005**: De server MOET de productie-URL van de assistent uit de catalogus halen en
  het centrale geheim gebruiken. Ontbreekt de productie-URL, dan MOET de gebruiker
  "Er is geen koppeling geconfigureerd. Neem contact op met de beheerder." zien en MOET er
  geen uitvoering ontstaan.
- **FR-006**: De server MOET het centrale geheim nooit aan de browser teruggeven, niet in
  foutmeldingen tonen en niet loggen.
- **FR-007**: De server MOET de analyse-invoer en de bestandsinhoud aan de analyseservice
  leveren, met per bestand de naam, het type en de inhoud, en met een terugmeldadres voor
  het resultaat. De sessie van de gebruiker MOET niet naar de analyseservice gaan.
- **FR-008**: De server MOET de limieten zelf afdwingen: uitsluitend pdf, docx en txt,
  maximaal 10 MB per bestand en 25 MB totaal. Bij overschrijding volgt een Nederlandse
  melding en ontstaat er geen uitvoering.
- **FR-009**: De bestandsinhoud MAG uitsluitend tijdens het versturen in het geheugen
  staan en MOET daarna verdwijnen. Bestandsinhoud MAG NIET in browseropslag, database,
  bestandsopslag, logs, analysegebeurtenissen of netwerkadressen terechtkomen.
- **FR-010**: De server MOET weigeren wanneer het versturen naar de analyseservice direct
  mislukt of te lang duurt; de uitvoering wordt dan "mislukt" met een expliciete
  Nederlandse melding en een foutcode.
- **FR-011**: De gebruiker MOET uitsluitend de eigen uitvoeringen kunnen zien. Een
  uitvoeringsnummer van een ander MOET dezelfde Nederlandse melding geven als een
  onbekend nummer, zonder inhoud, bestandsnaam of klantreferentie prijs te geven.
- **FR-012**: De status van een uitvoering MOET de bestaande waarden houden: in wachtrij,
  bezig, gereed en mislukt, met starttijdstip, eindtijdstip, foutcode en foutmelding.
- **FR-013**: Een geslaagde uitvoering MOET het resultaat, de interne analyse en de
  beschikbaarheid van het dossier bevatten; de bestaande resultaatweergave blijft
  ongewijzigd en elk resultaat draagt het label "CONCEPT".
- **FR-014**: De lijst met recente uitvoeringen MOET uitsluitend eigen uitvoeringen
  bevatten, geordend op starttijdstip, met een limiet tot en met 50, en uitsluitend
  metadata tonen (nummer, klantreferentie, status, tijdstippen, foutcode,
  bewaartermijn).
- **FR-015**: Alleen de analyseservice MAG een uitvoering afronden. Elke melding MOET een
  geldige handtekening bevatten die met het daarvoor bestemde servergeheim wordt
  gecontroleerd; zonder geldige handtekening MOET de melding worden geweigerd zonder
  wijziging.
- **FR-016**: Een melding MOET alleen worden geaccepteerd voor een bestaande uitvoering
  die nog in wachtrij of bezig is. Voor een onbekende, verlopen of al afgeronde uitvoering
  MOET de melding worden geweigerd en MOET het bestaande resultaat ongewijzigd blijven.
- **FR-017**: Een succesmelding MOET het resultaat, de interne analyse en het dossier
  vastleggen. Voldoet de analyse-inhoud niet aan het afgesproken resultaatformaat, dan
  MOET de melding worden geweigerd en MOET de uitvoering in zijn bestaande toestand
  blijven.
- **FR-018**: Een foutmelding MOET de uitvoering op "mislukt" zetten met de aangeleverde
  foutcode en een Nederlandse, voor de adviseur leesbare melding.
- **FR-019**: Het dossier MOET server-side privé worden bewaard tot de bewaartermijn
  verstrijkt en MOET uitsluitend door de eigenaar van de uitvoering downloadbaar zijn.
- **FR-020**: De bewaartermijn MOET zeven dagen na het starten zijn. Na het verstrijken
  MOETEN de uitvoering en het dossier automatisch worden verwijderd en MOET een oud adres
  de bestaande Nederlandse "niet gevonden"-melding geven.
- **FR-021**: Alle fouten MOETEN een zichtbare Nederlandse foutstatus opleveren; stille
  fouten, lege lijsten zonder melding en eindeloos "bezig" zijn verboden.
- **FR-022**: Elke nieuwe interfacetekst MOET Nederlands zijn in de u-vorm, en elke
  gegenereerde uitkomst MOET het label "CONCEPT" dragen; de UI MAG nooit een aanbeveling
  tonen of suggereren.
- **FR-023**: De bestaande schermen en hun gedrag MOEVEN ongewijzigd blijven: het
  formulier voor een nieuwe analyse, de statuskaart met verstreken tijd, de
  resultaatweergave, de download- en kopieerknoppen, recente uitvoeringen, het startscherm,
  de geschiedenis, de kennisbronkeuze en de meldingenteller.
- **FR-024**: De server MOET alle bovenstaande controles afdwingen, ook wanneer de
  gebruikersinterface wordt omzeild of rechtstreeks wordt aangeroepen.
- **FR-025**: De productie-URL uit de catalogus is de enige koppeling die voor de analyse
  wordt gebruikt; de test-URL wordt nooit gebruikt.

### Key Entities *(include if data involved)*

- **Analyse-uitvoering**: één asynchrone analyse; attributen: uniek nummer, adviseur
  (eigenaar), assistent, klantreferentie, status (in wachtrij, bezig, gereed, mislukt),
  start- en eindtijdstip, foutcode en foutmelding, bewaartermijn, resultaat, interne
  analyse en verwijzing naar het dossier.
- **Assistent**: de per organisatie aangezette verschijning van een catalogusitem met type
  risico-analyse; bepaalt of een adviseur de analyse mag starten.
- **Catalogusitem**: platformbrede definitie van de assistent met de productie-URL die de
  server gebruikt.
- **Koppeling**: de centrale headernaam en het centrale geheim waarmee de server naar de
  analyseservice gaat, plus het aparte servergeheim waarmee de analyseservice zich bij de
  afronding legitimeert. Geen van beide is ooit leesbaar voor de browser.
- **Resultaat**: het gestructureerde analyseresultaat van een geslaagde uitvoering
  (risico's, dekking en restgat, draagkracht, opties met voor en tegen, lacunes, interne
  signalen en bronverwijzingen), plus de interne analyse als opgemaakte tekst.
- **Dossier**: het .docx-document dat de analyseservice bij een geslaagde uitvoering
  levert; privé bewaard tot de bewaartermijn verstrijkt.
- **Bestand**: een door de adviseur toegevoegd pdf-, docx- of txt-bestand; bestaat
  uitsluitend tijdens het versturen en wordt nergens bewaard.
- **Adviseur en organisatie**: de ingelogde gebruiker en de organisatie uit het profiel;
  bepalen de eigenaar en de toegang tot assistenten en uitvoeringen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% van de startpogingen zonder geldige sessie, zonder organisatie, met een
  uitgezette assistent, met een assistent van een ander type of met een assistent van een
  andere organisatie levert een Nederlandse melding op en 0 uitvoeringen.
- **SC-002**: Ontbreekt de productie-URL, dan ziet 100% van de gebruikers de melding
  "Er is geen koppeling geconfigureerd. Neem contact op met de beheerder." en ontstaan er
  0 uitvoeringen.
- **SC-003**: In 0 gevallen verstuurt de browser een verzoek naar de analyseservice of
  bevat de browser het webhookgeheim, een tenantkeuze of een analyse-adres.
- **SC-004**: 100% van de pogingen om andermans uitvoering te openen of te downloaden
  levert geen inhoud, bestandsnaam of klantreferentie op.
- **SC-005**: 100% van de afrondingsmeldingen zonder geldige handtekening, voor een
  onbekende uitvoering of voor een al afgeronde uitvoering wordt geweigerd zonder dat de
  status of inhoud verandert.
- **SC-006**: Bestanden tot 10 MB per stuk en 25 MB totaal worden in 100% van de gevallen
  geaccepteerd; alles daarboven wordt in 100% van de gevallen geweigerd. Na het versturen
  is 0 bytes bestandsinhoud bewaard in browseropslag, database, bestandsopslag, logs of
  netwerkadressen.
- **SC-007**: Na de afrondingsmelding ziet de adviseur binnen 10 seconden de status
  "gereed" of "mislukt" en is een geslaagd resultaat binnen twee handelingen te openen.
- **SC-008**: Na het verstrijken van de bewaartermijn levert 100% van de oude adressen en
  downloads niets meer op en is 100% van de verlopen uitvoeringen en dossiers verwijderd.
- **SC-009**: 100% van de foutscenario's toont een zichtbare Nederlandse foutstatus met
  foutcode, en 100% van de uitkomsten draagt het label "CONCEPT".
- **SC-010**: De bestaande regressietests voor het analyseformulier, de statuskaart, de
  resultaatweergave, de recente uitvoeringen, het startscherm en de geschiedenis blijven
  in 100% van de gevallen groen.

## Assumptions

- **Bewaartermijn**: zeven dagen na het starten van de uitvoering. Daarna verdwijnen de
  uitvoering en het dossier volledig. Dit vervangt de eerdere aanname dat de termijn pas
  bij afronding ingaat en dat metadata na de bewaartermijn zichtbaar blijft; zo verloopt
  ook een uitvoering die nooit wordt afgerond.
- **Bestanden versus dossier**: "bestanden worden niet bewaard" gaat over de door de
  adviseur toegevoegde pdf-, docx- en txt-bestanden. Het door de analyseservice geleverde
  klantdossier is een resultaat en wordt privé bewaard tot de bewaartermijn verstrijkt,
  omdat het anders niet downloadbaar is.
- **Handtekening van de afronding**: de callback-URL bevat een handtekening over het
  uitvoeringsnummer, gemaakt met een apart servergeheim (niet het centrale
  webhookgeheim). De analyseservice hoeft alleen de meegegeven URL te gebruiken; het
  toevoegen van een header aan de callback is niet nodig. Het geheim staat uitsluitend
  server-side.
- **Status en resultaat**: de browser leest status en resultaat uitsluitend binnen de eigen
  toegang. Of dat via de serverroute of via een rechtstreeks beveiligde gegevenslezing
  gebeurt, is een implementatiekeuze; de uitkomsten in deze spec zijn leidend.
- **Analyseservice**: de analyseservice antwoordt direct met een ontvangstbevestiging
  en meldt het resultaat later via het terugmeldadres. Een uitvoering blijft in de
  laatste status tot de analyseservice hem afrondt of tot de bewaartermijn verstrijkt;
  een run-level time-out valt buiten deze route.
- **Bestaande invoer en weergave**: formuliervelden, validaties, kennisbronkeuze,
  retry-snapshot, polling, resultaatweergave en meldingenteller blijven ongewijzigd. Er
  komen geen nieuwe formuliervelden en de resultaatweergave wordt niet gewijzigd.
- **Limieten**: pdf, docx en txt; 10 MB per bestand en 25 MB totaal, zowel in de browser
  als op de server afgedwongen.
- **Lokale ontwikkeling**: de browser kent geen analyse-adres meer; de browserinstelling
  die dat adres bevatte verdwijnt. De bestaande lokale testvoorziening blijft als script
  op schijf staan maar wordt niet meer gebruikt; lokaal ontwikkelen en testen gebeurt via
  de serverroute of een lokale server-side vervanger met hetzelfde contract.
- **Rollen**: elke ingelogde gebruiker met een adviseursprofiel binnen een organisatie kan
  een analyse starten voor een voor die organisatie aangezette risico-analyse-assistent.
  Er komt geen nieuwe rol of beheerfunctionaliteit bij.

## Out of Scope

- Wijzigingen aan de n8n-flow "Darwin - Risico-analyse"; die gebeuren apart en handmatig.
- Het gebruik van de test-URL uit de catalogus.
- Nieuwe formuliervelden of wijzigingen aan de invoervalidatie.
- Wijzigingen aan de resultaatweergave, de download- en kopieerknoppen of de
  meldingenteller.
- Beheer van assistenten, organisatieschakelaars of koppelingen; dat bestaat al.
- Een secret per organisatie of per assistent.
- Rolbeheer of nieuwe rollen in de gebruikersinterface.

