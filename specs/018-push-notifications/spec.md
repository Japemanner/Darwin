# Feature Specification: Pushmeldingen voor afgeronde risico-analyses

**Feature Branch**: `018-push-notifications`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Pushmeldingen op desktop en Android, eerst voor afgeronde risico-analyses. Huidige situatie: Een risico-analyse duurt 1 tot 3 minuten. Sinds feature 014 telt de zijbalk afgeronde en mislukte analyses en staat dat aantal in de tabbladtitel. Dat werkt alleen zolang Darwin open staat: useAnalysisNotifications pollt in de open tab. Wie Darwin sluit of in een ander programma werkt, merkt niets. Darwin heeft geen service worker. De n8n-flow meldt resultaat en fout via de callback. Of de Edge Function analysis-run-callback al in Supabase draait, staat niet in de repo; controleer dat via Supabase MCP. Taken en een mailassistent bestaan nog niet; die moeten later via hetzelfde mechanisme meldingen kunnen sturen. Instellingen is alleen zichtbaar voor beheerders."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Meldingen aanzetten voor dit apparaat (Priority: P1)

Als adviseur zet ik in het gebruikersblok onderaan de zijbalk meldingen aan voor dit apparaat. De browser vraagt pas om toestemming nadat ik zelf op de knop klik. Daarna zie ik in datzelfde blok of meldingen op dit apparaat aan staan, en ik kan ze met dezelfde knop weer uitzetten. De knop staat bij mijn naam en rol, dus ik hoef niet naar de beheerdersinstellingen.

**Why this priority**: Zonder aanzetten bestaat er geen abonnement en komt er nooit een melding. Dit is de enige handeling die de adviseur moet verrichten en daarmee de voorwaarde voor alle andere verhalen.

**Independent Test**: Volledig te testen door in te loggen, in het gebruikersblok op "Meldingen aanzetten" te klikken, de toestemming te verlenen en te controleren dat de status op "aan" springt; daarna opnieuw klikken en controleren dat de status weer "uit" is en er geen meldingen meer komen.

**Acceptance Scenarios**:

1. **Given** een ingelogde adviseur die nog geen meldingen op dit apparaat heeft aangezet, **When** hij het gebruikersblok onderaan de zijbalk bekijkt, **Then** ziet hij een knop om meldingen aan te zetten en de status "uit" als tekst.
2. **Given** de knop "Meldingen aanzetten", **When** de adviseur erop klikt, **Then** vraagt de browser om toestemming — en pas op dat moment, niet bij het openen van de app of het inloggen.
3. **Given** de adviseur heeft toestemming verleend, **When** het aanzetten slaagt, **Then** toont het gebruikersblok de status "aan" als tekst en biedt het de mogelijkheid om meldingen weer uit te zetten.
4. **Given** meldingen staan aan op dit apparaat, **When** de adviseur op "Meldingen uitzetten" klikt, **Then** staat de status op "uit", ontvangt dit apparaat geen meldingen meer voor zijn account en vraagt de browser niet opnieuw om toestemming.
5. **Given** het aanzetten mislukt (bijvoorbeeld door een netwerk- of registratiefout), **When** de adviseur het opnieuw probeert, **Then** blijft de status "uit" en ziet hij een Nederlandse foutmelding; de knop blijft bruikbaar.
6. **Given** de knop en de status, **When** de adviseur uitsluitend met het toetsenbord werkt, **Then** zijn beide bereikbaar, zichtbaar gefocust en bedienbaar (WCAG 2.1 AA).

---

### User Story 2 - Systeemmelding bij afronding of mislukken (Priority: P1)

Als adviseur start ik een risico-analyse en ga ik ondertussen iets anders doen — in een andere applicatie of met Darwin gesloten. Zodra mijn analyse is afgerond of mislukt, krijg ik een systeemmelding op elk apparaat waar ik meldingen heb aangezet. De melding zegt alleen dát de analyse gereed is of mislukt is; een klik opent de analysepagina van precies die analyse, ook als Darwin nog niet open stond.

**Why this priority**: Dit is de kern van de feature. De bestaande telling in zijbalk en tabbladtitel werkt alleen zolang Darwin open staat; de adviseur die wegklikt of iets anders doet, hoort het nu nooit.

**Independent Test**: Volledig te testen door op twee apparaten meldingen aan te zetten, op apparaat A een analyse te starten, Darwin op apparaat A te sluiten en te wachten tot de analyse afrondt: beide apparaten tonen een systeemmelding met de voorgeschreven tekst, en een klik opent `/analyse/<run-id>`.

**Acceptance Scenarios**:

1. **Given** de adviseur heeft meldingen aan op dit apparaat en start een analyse, **When** de analyse met succes afrondt, **Then** verschijnt een systeemmelding met uitsluitend de tekst "Uw risico-analyse is gereed".
2. **Given** dezelfde situatie, **When** de analyse mislukt, **Then** verschijnt een systeemmelding met uitsluitend de tekst "Uw risico-analyse is mislukt".
3. **Given** een systeemmelding, **When** de adviseur erop klikt, **Then** opent de analysepagina van die analyse op `/analyse/<run-id>` — in een bestaand venster of een nieuw venster als Darwin niet open stond.
4. **Given** de adviseur heeft meldingen aan op meerdere apparaten, **When** een van zijn analyses afrondt, **Then** ontvangt elk van die apparaten de melding.
5. **Given** een analyse die door een andere adviseur is gestart, **When** die afrondt, **Then** ontvangt deze adviseur geen melding, ook niet als hij dezelfde assistent gebruikt.
6. **Given** een analyse die afrondt terwijl de adviseur Darwin geopend heeft, **When** de melding binnenkomt, **Then** verschijnt de systeemmelding alsnog; de bestaande telling in zijbalk en tabbladtitel blijft ongewijzigd bestaan.
7. **Given** een melding die binnenkomt terwijl de adviseur niet is ingelogd, **When** hij op de melding klikt, **Then** wordt hij naar het inlogscherm geleid en na inloggen naar `/analyse/<run-id>`.
8. **Given** de inhoud van de melding, **When** deze wordt gecontroleerd, **Then** bevat de melding uitsluitend het soort melding (gereed of mislukt) en de run-id — nooit klantreferentie, klantgegevens, vraagstuk of analyse-inhoud (constitution III).

---

### User Story 3 - Duidelijke uitleg in plaats van een dode knop (Priority: P1)

Als adviseur bij wie de browser geen meldingen ondersteunt, of die toestemming eerder heeft geweigerd, zie ik in het gebruikersblok een Nederlandse uitleg in plaats van een knop die niets doet. Ik weet dan wat er aan de hand is en wat ik eventueel zelf kan doen.

**Why this priority**: Een knop die geen toestemming kan vragen is een dode knop en ondermijnt het vertrouwen in de app. De uitleg is nodig om de feature eerlijk en bruikbaar te houden op elke ondersteunde en niet-ondersteunde combinatie.

**Independent Test**: Volledig te testen door de toestemming in de browser te weigeren (en door een browser zonder ondersteuning na te bootsen): in beide gevallen toont het gebruikersblok een Nederlandse uitleg en geen werkende aanzetknop.

**Acceptance Scenarios**:

1. **Given** de browser ondersteunt geen systeemmeldingen, **When** de adviseur het gebruikersblok bekijkt, **Then** ziet hij een Nederlandse uitleg dat meldingen op dit apparaat niet mogelijk zijn — zonder knop die niets doet.
2. **Given** de adviseur heeft toestemming geweigerd, **When** hij het gebruikersblok bekijkt, **Then** ziet hij een Nederlandse uitleg dat de browser meldingen heeft geblokkeerd en dat hij dit in de browserinstellingen kan wijzigen — zonder knop die niets doet.
3. **Given** de adviseur heeft de toestemming later in de browserinstellingen alsnog verleend, **When** hij de app opnieuw opent of het venster opnieuw focust, **Then** is de knop om meldingen aan te zetten weer beschikbaar.
4. **Given** de uitleg, **When** deze wordt voorgelezen of zonder kleur wordt bekeken, **Then** is de betekenis volledig uit de tekst af te leiden (WCAG 2.1 AA — status is tekst, niet alleen kleur).

---

### User Story 4 - Uitloggen stopt meldingen op dit apparaat (Priority: P2)

Als adviseur log ik uit op een gedeelde of andermans computer. Dit apparaat stopt dan met het ontvangen van meldingen voor mijn account, zodat een volgende gebruiker van dat apparaat geen meldingen over mijn analyses ziet.

**Why this priority**: Privacy op gedeelde apparaten is belangrijk, maar het raakt een kleinere groep en een kortere tijdsduur dan de kernverhalen.

**Independent Test**: Volledig te testen door meldingen aan te zetten, uit te loggen en daarna een analyse te laten afronden: dit apparaat ontvangt geen melding meer; op een ander apparaat met meldingen aan gebeurt dat wel.

**Acceptance Scenarios**:

1. **Given** meldingen staan aan op dit apparaat, **When** de adviseur uitlogt, **Then** worden meldingen voor zijn account op dit apparaat stopgezet.
2. **Given** de adviseur logt daarna weer in op hetzelfde apparaat, **When** hij het gebruikersblok bekijkt, **Then** staat de status op "uit" en kan hij meldingen opnieuw aanzetten met een expliciete klik.
3. **Given** de adviseur heeft op meerdere apparaten meldingen aan, **When** hij op één apparaat uitlogt, **Then** blijven de meldingen op de andere apparaten werken.
4. **Given** het uitloggen, **When** het stopzetten van meldingen niet lukt (bijvoorbeeld door een netwerkfout), **Then** verloopt het uitloggen zelf gewoon; het apparaat ontvangt in dat geval uiterlijk geen meldingen meer zodra de pushdienst het abonnement als ongeldig meldt.

---

### Edge Cases

- **Meerdere apparaten per adviseur**: elk apparaat met meldingen aan ontvangt de melding; uitzetten op het ene apparaat laat de andere ongemoeid.
- **Meerdere gebruikers op hetzelfde apparaat**: een abonnement hoort bij één gebruiker; bij uitloggen verdwijnt het abonnement van die gebruiker op dat apparaat en ziet een volgende gebruiker geen meldingen over de vorige.
- **Abonnement verlopen of ongeldig** (apparaat gewist, browsergegevens opgeruimd, pushdienst meldt de registratie als verlopen): het abonnement wordt bij die verzending verwijderd; de adviseur ziet bij het volgende bezoek de status "uit" en kan opnieuw aanzetten.
- **Verzending mislukt** (pushdienst onbereikbaar, tijdelijke fout): de verwerking van de analysecallback faalt niet en de analyse houdt haar status; de fout wordt gelogd zonder klantgegevens.
- **Analyse rondt af terwijl meldingen uit staan of voordat het abonnement bestond**: geen melding; de bestaande telling in zijbalk en tabbladtitel blijft het resultaat tonen.
- **Herhaalde callback voor dezelfde analyse** (idempotente herhaling): leidt niet tot een tweede melding op hetzelfde apparaat.
- **Meerdere tabbladen of vensters open**: de status in het gebruikersblok kan per tabblad verschillen tot het volgende bezoek; er is geen live synchronisatie tussen tabbladen.
- **Toestemming na het aanzetten ingetrokken** in de browserinstellingen: de app toont bij het volgende bezoek de uitleg uit US3; tot die tijd kan een verzending mislukken zonder de analyse te blokkeren.
- **Analyse waarvan het resultaat inmiddels is verlopen**: de klik op de melding opent de analysepagina; daar geldt het bestaande gedrag voor verlopen resultaten.
- **Melding terwijl de app in een andere taal of met een andere rol wordt gebruikt**: de meldingstekst is altijd Nederlands en de melding is nooit afhankelijk van beheerdersrechten.
- **Gelijktijdig uitloggen en binnenkomende melding**: de melding kan nog eenmaal aankomen; daarna is het abonnement weg.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Het gebruikersblok onderaan de zijbalk MOET voor elke ingelogde adviseur een meldingsstatus en een bedieningselement tonen; dit mag niet afhankelijk zijn van beheerdersrechten (Instellingen blijft beheerdersonly en wordt niet gebruikt).
- **FR-002**: De browser MOET pas om toestemming vragen nadat de adviseur expliciet op de knop klikt — nooit bij het openen van de app, het inloggen of het starten van een analyse.
- **FR-003**: De status MOET als tekst zichtbaar zijn ("aan" of "uit", plus uitleg bij geblokkeerde of ontbrekende ondersteuning) en nooit uitsluitend als kleur of icoon (WCAG 2.1 AA).
- **FR-004**: De adviseur MOET meldingen op dit apparaat kunnen aanzetten én weer uitzetten; uitzetten verwijdert het abonnement van dit apparaat voor zijn account en vraagt niet opnieuw om toestemming.
- **FR-005**: Het systeem MOET bij een geslaagde analyse een systeemmelding sturen met uitsluitend de tekst "Uw risico-analyse is gereed", en bij een mislukte analyse uitsluitend "Uw risico-analyse is mislukt".
- **FR-006**: Een melding MOET uitsluitend het soort melding en de run-id bevatten — nooit klantreferentie, klantgegevens, vraagstuk, bestandsnamen of analyse-inhoud (constitution III; pushdiensten van derden).
- **FR-007**: Een melding MOET alleen naar de adviseur gaan die de analyse startte, op elk apparaat waar die adviseur meldingen heeft aangezet — ook wanneer Darwin niet open staat.
- **FR-008**: Een klik op de melding MOET `/analyse/<run-id>` openen; zonder actieve sessie volgt eerst het inlogscherm en daarna de analysepagina.
- **FR-009**: Ondersteunde combinaties zijn actuele Chrome, Edge en Firefox op Windows en macOS, Safari op macOS en Chrome op Android; op niet-ondersteunde combinaties toont het gebruikersblok een Nederlandse uitleg in plaats van een werkende knop.
- **FR-010**: Bij geweigerde toestemming MOET het gebruikersblok een Nederlandse uitleg tonen dat de browser meldingen blokkeert en hoe dit te wijzigen is — zonder knop die niets doet.
- **FR-011**: Abonnementen MOETEN per gebruiker per apparaat worden vastgelegd, waarbij een gebruiker uitsluitend zijn eigen abonnementen kan lezen, aanmaken en verwijderen; verzenden gebeurt uitsluitend serverside.
- **FR-012**: Een abonnement dat de pushdienst als verlopen of ongeldig meldt, MOET bij die verzending worden verwijderd.
- **FR-013**: Een mislukte verzending MOET de verwerking van de analysecallback niet laten falen en MOET worden gelogd zonder klantgegevens.
- **FR-014**: Versturen MOET via één serverside functie verlopen met als invoer de gebruiker, het soort melding en het adres in de app; de risico-analysecallback is in deze feature de enige aanroeper, en toekomstige meldingsbronnen (taken, mailassistent) kunnen dezelfde functie later gebruiken.
- **FR-015**: De private sleutel voor het ondertekenen van pushberichten MOET uitsluitend als server-side geheim (Supabase secret) bestaan — nooit in de frontend, nooit in de repository.
- **FR-016**: De service worker MOET uitsluitend meldingen tonen en openen: geen fetch-afhandeling, geen caching en niets in browseropslag.
- **FR-017**: Bij uitloggen MOET dit apparaat stoppen met meldingen voor de uitloggende gebruiker; de overige apparaten blijven werken.
- **FR-018**: De bestaande telling van afgeronde en mislukte analyses in zijbalk en tabbladtitel MOET ongewijzigd blijven bestaan naast de nieuwe meldingen.
- **FR-019**: Een herhaalde callback voor dezelfde analyse MOET niet leiden tot een tweede melding op hetzelfde apparaat.
- **FR-020**: Playwright-tests MOETEN minimaal aanzetten, uitzetten en geweigerde toestemming dekken; alle bestaande tests blijven groen.

### Key Entities

- **Apparaatabonnement**: de registratie dat één gebruiker op één apparaat/browser meldingen wil ontvangen. Hoort bij precies één gebruiker en één apparaat, is alleen voor die gebruiker leesbaar en verwijderbaar, en vervalt bij uitzetten, uitloggen of wanneer de pushdienst het als ongeldig meldt.
- **Melding**: een signaal met uitsluitend een soort (gereed of mislukt) en een run-id; nooit klantinhoud. Wordt aangemaakt door de serverside verzendfunctie en naar alle apparaten van de betrokken adviseur gestuurd.
- **Analyse (bestaand)**: de risico-analyse met run-id, status (in wachtrij, bezig, klaar, mislukt) en de adviseur die haar startte; de callback bij afronding is in deze feature de enige aanleiding voor een melding.
- **Meldingsstatus in het gebruikersblok**: de zichtbare toestand per apparaat — aan, uit, geblokkeerd door de browser, of niet ondersteund — met bijbehorende Nederlandse uitleg en bediening.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een adviseur kan meldingen op een apparaat aanzetten in maximaal twee handelingen (klik op de knop, toestemming verlenen) en ziet daarna direct de status "aan".
- **SC-002**: 100% van de afgeronde en mislukte analyses van een adviseur met meldingen aan levert binnen 10 seconden na afronding een systeemmelding op elk van zijn aangemelde apparaten, ook wanneer de app gesloten is — voor zover het apparaat online en bereikbaar is.
- **SC-003**: 100% van de meldingen bevat uitsluitend de voorgeschreven Nederlandse tekst en de run-id; geen enkele melding bevat klantreferentie, klantgegevens of analyse-inhoud (verifieerbaar door de payload en de getoonde tekst te inspecteren).
- **SC-004**: Een klik op een melding komt in 100% van de gevallen uit op `/analyse/<run-id>` van de juiste analyse, ook na eerst inloggen.
- **SC-005**: Op niet-ondersteunde browsers en bij geweigerde toestemming ziet 100% van de adviseurs een Nederlandse uitleg; geen enkele combinatie toont een knop die geen effect kan hebben.
- **SC-006**: Na uitloggen ontvangt het apparaat geen meldingen meer voor de uitgelogde gebruiker; op andere apparaten blijven meldingen aantoonbaar werken.
- **SC-007**: Een mislukte of ongeldige verzending wijzigt de analyse-uitkomst nooit: 100% van de analyses houdt de status die de callback bepaalde, en het aantal foutmeldingen in de logboeken bevat nul klantgegevens.
- **SC-008**: Verlopen of ongeldige abonnementen worden bij de eerstvolgende verzending verwijderd; het aantal achtergebleven ongeldige abonnementen na verzending is nul.
- **SC-009**: De knop en status zijn volledig met het toetsenbord te bedienen en de status is als tekst leesbaar (WCAG 2.1 AA, 0 kritieke toegankelijkheidsbevindingen).
- **SC-010**: De Playwright-dekking voor aanzetten, uitzetten en geweigerde toestemming slaagt, en de volledige bestaande testsuite blijft groen (0 regressies).

## Assumptions

- De meldingsknop hoort in het bestaande gebruikersblok onderaan de zijbalk, naast naam, rol en uitlogknop; de exacte vorm (knop, schakelaar, regel tekst) is een ontwerpbeslissing binnen WCAG 2.1 AA.
- Meldingen worden ook getoond wanneer Darwin geopend is; de bestaande in-app telling blijft daarnaast bestaan en wordt niet vervangen.
- "Dit apparaat" betekent het huidige browserprofiel op het huidige toestel. Een tweede browser of een privévenster geldt als een apart apparaat en moet apart worden aangezet.
- Na uitloggen moet de adviseur op dat apparaat opnieuw expliciet aanzetten; de status na opnieuw inloggen is "uit".
- De app vraagt geen toestemming bij het openen, inloggen of starten van een analyse; toestemming volgt uitsluitend op een klik.
- Er is één meldingssoort per analyse-uitkomst (gereed of mislukt); voorkeuren per soort, stille uren en e-mail/sms blijven buiten scope.
- De analysecallback is in deze feature de enige aanroeper van de serverside verzendfunctie; taken en de mailassistent bestaan nog niet en sluiten later op dezelfde functie aan zonder dat de functie daarvoor nu extra opties krijgt.
- De n8n-flow en het callback-contract (specs/008-risico-analyse-ui/contracts/run-callback.md) blijven ongewijzigd; de melding hangt aan de bestaande statusovergang naar klaar of mislukt.
- Of de Edge Function `analysis-run-callback` al in Supabase draait, is niet in de repository vastgelegd en moet in de planfase via Supabase MCP worden gecontroleerd; zo niet, dan is het bestaande callbackcontract de basis en valt het (her)deployen binnen de planfase.
- Een adviseur die nooit op aanzetten klikt, merkt geen verschil met de huidige situatie: geen toestemmingsvraag, geen meldingen, bestaande telling blijft werken.
- Buiten scope: iPhone en iPad, installatie als app op het beginscherm, taken en de mailassistent zelf, voorkeuren per soort melding, stille uren, e-mail- of sms-meldingen en wijzigingen aan de n8n-flow.

## Dependencies

- De bestaande risico-analyseflow en het callbackcontract uit feature 008 (statusovergang naar klaar of mislukt).
- De bestaande zijbalk met het gebruikersblok en de bestaande telling uit feature 014.
- Een pushdienst die voor de genoemde browsers bereikbaar is; de app moet zonder die dienst wel bruikbaar blijven (status "uit" met uitleg).
- Supabase als omgeving voor de serverside verzendfunctie, het server-side geheim en de abonnementstabel met RLS.
