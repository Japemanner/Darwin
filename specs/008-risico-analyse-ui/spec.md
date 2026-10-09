# Feature Specification: Risico-analyse assistent UI

**Feature Branch**: `008-risico-analyse-ui`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "Build the UI for the Darwin assistant 'Risico-analyse' for Dutch financial advisors. The advisor prepares a client conversation about an insurance the client is considering. The assistant runs asynchronously (1-3 minutes) in a backend workflow and returns two documents. This is NOT a free-form chat in v1: it is a chat-style screen with an input form and a results view, no follow-up conversation."

## Clarifications

### Session 2026-10-09

- Q: Hoe lang mag een afgeronde run server-side bewaard blijven en
  opnieuw opvraagbaar zijn (analyseweergave + .docx-download)? → A:
  Vaste bewaartermijn van 7 dagen server-side (versleuteld); daarna
  automatisch verwijderd. Geüploade invoerbestanden worden direct na
  afronding van de run verwijderd (consistent met Constitution
  Principe III).

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each user story, where P1 is the most critical.
  Think each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Analyse starten via invoerformulier (Priority: P1)

Als financieel adviseur wil ik het verzekeringsvraagstuk, de kennisbronnen,
de klantsituatie en optionele bijlagen en URL's invullen en de analyse
starten, zodat de backend de risico-analyse kan uitvoeren nog vóór mijn
klantgesprek.

Formuliervelden (Nederlandse labels, formele professionele toon):

| Veld                   | Verplicht | Type / validatie |
|------------------------|-----------|------------------|
| Verzekeringsvraagstuk  | ja        | meerregelig tekstveld |
| Kennisbronnen          | ja        | multi-select; alleen kennisbronnen van de ingelogde adviseur; de selectie bepaalt het verzekerings­type |
| Klantsituatie          | nee       | meerregelig tekstveld |
| Bestanden              | nee       | meerdere bestanden; pdf/docx/txt; maximale bestandsgrootte zichtbaar |
| URL's                  | nee       | lijst, toevoegen/verwijderen; uitsluitend https |
| Klantreferentie        | ja        | tekstveld |
| Adviseur               | ja        | vooraf ingevuld vanaf de ingelogde gebruiker; niet vrij bewerkbaar |

Groepsvalidatie: minimaal één van Klantsituatie, Bestanden of URL's moet
zijn gevuld; anders verschijnt een inline validatiemelding bij het
desbetreffende veld. Er is geen vaste invoerindeling vereist — de assistent
gaat ook om met karige invoer.

**Why this priority**: zonder een correct ingevuld en gevalideerd formulier
bestaat de feature niet; dit is de MVP-invoer voor de async-run.

**Independent Test**: formulier volledig invullen met minimale invoer
(verplichte velden + één optioneel bronveld), versturen en zien dat de
analyse-run gestart wordt. Eén veld leeg laten toont de inline
validatiemelding.

**Acceptance Scenarios**:

1. **Given** de adviseur is ingelogd, **When** alle verplichte velden zijn
   gevuld en minimaal één van Klantsituatie/Bestanden/URL's is gevuld,
   **Then** kan de analyse gestart worden en verschijnt de run-kaart.
2. **Given** Klantsituatie, Bestanden en URL's zijn allemaal leeg, **When**
   de adviseur probeert te versturen, **Then** krijgt de adviseur een
   inline Nederlandse validatiemelding en wordt het formulier niet
   verstuurd.
3. **Given** de adviseur voegt een URL zonder https toe, **When** de URL
   wordt toegevoegd, **Then** wordt de URL geweigerd met een inline
   Nederlandse foutmelding.
4. **Given** de adviseur uploadt een bestand dat geen pdf/docx/txt is of te
   groot is, **When** het bestand wordt geselecteerd, **Then** wordt het
   bestand geweigerd met een inline Nederlandse foutmelding.
5. **Given** de assistent is geconfigureerd met kennisbronnen, **When** het
   formulier wordt geopend, **Then** toont Kennisbronnen uitsluitend de
   kennisbronnen die aan deze assistent gekoppeld zijn.
6. **Given** de ingelogde gebruiker heeft een adviseursprofiel, **When**
   het formulier wordt geopend, **Then** staat Adviseur vooraf ingevuld en
   is het veld niet vrij bewerkbaar.

---

### User Story 2 - Run-status volgen en terugkeren (Priority: P2)

Als financieel adviseur wil ik na het versturen de status van de run zien
(in wachtrij, bezig, klaar, mislukt) met verstreken tijd, weg kunnen
navigeren en later kunnen terugkeren naar de run, zodat ik niet hoef te
wachten op een scherm dat 1-3 minuten bezig is.

**Why this priority**: de asynchrone aard (1-3 minuten) vereist zichtbare
status en hervatbaarheid; zonder dit is de flow onbruikbaar in de dagelijkse
praktijk, maar het is pas relevant ná een geslaagde submit (US1).

**Independent Test**: een run starten, weg navigeren naar een andere
pagina, terug keren naar het Assistenten-tabblad en zien dat de run in de
lijst recente runs staat met de actuele status en verstreken tijd.

**Acceptance Scenarios**:

1. **Given** de run is verstuurd, **When** de backend heeft de run nog
   niet afgerond, **Then** toont de run-kaart de status "in wachtrij" of
   "bezig" met verstreken tijd sinds start.
2. **Given** de adviseur navigeert naar een ander tabblad, **When** de
   adviseur terugkeert, **Then** staat de run in de lijst recente runs
   van deze adviseur met de actuele status.
3. **Given** de backend-rondt de run af, **When** de adviseur het
   run-overzicht bekijkt, **Then** toont de run-kaart "klaar" (of
   "mislukt") en kan de adviseur het resultaat openen.
4. **Given** meerdere runs bestaan voor deze adviseur, **When** de lijst
   recente runs wordt getoond, **Then** zijn de runs herkenbaar aan
   klantreferentie en starttijdstip (geen klantinhoud in de labels).

---

### User Story 3 - Resultatenweergave met bronnen en download (Priority: P3)

Als financieel adviseur wil ik bij een geslaagde run de ontbrekende
informatie bovenaan zien, de interne analyse als leesbaar document met
klikbare bronverwijzingen, en het dossier-document (.docx) downloaden,
zodat ik mijn afweging (verzekeren, deels verzekeren of zelf dragen) kan
onderbouwen en documenteren.

**Why this priority**: dit is de eigenlijke waarde van de assistent, maar
het vereist een geslaagde run (US1 + US2) en is daardoor derde in
prioriteit.

**Independent Test**: een geslaagde run openen en vaststellen dat (a) de
checklist "Ontbrekende informatie voor het gesprek" bovenaan staat, (b) alle
analyse-secties (risico's, dekking en restgat, draagkracht, opties met voor
en tegen, interne signalen) zichtbaar zijn, (c) elke bronverwijzing
(K1, R2, A1) aanklikbaar is en het zijpaneel toont: document, locatie en de
letterlijke passage, (d) de downloadknop het .docx met label "CONCEPT,
door adviseur te accorderen" levert.

**Acceptance Scenarios**:

1. **Given** een geslaagde run, **When** het resultaat wordt geopend,
   **Then** staat bovenaan het paneel "Ontbrekende informatie voor het
   gesprek" als checklist (afvinkbare items).
2. **Given** de interne analyse bevat secties (risico's, dekking en
   restgat, draagkracht, opties met voor en tegen, interne signalen),
   **When** het resultaat wordt getoond, **Then** zijn alle secties als
   opgemaakte tekst zichtbaar in deze volgorde.
3. **Given** de sectie "interne signalen", **When** deze sectie wordt
   weergegeven, **Then** is de sectie zichtbaar gemarkeerd als "intern,
   speculatief".
4. **Given** het resultaat bevat bronverwijzingen (zoals K1, R2, A1),
   **When** de adviseur op een verwijzing klikt, **Then** opent een
   zijpaneel met document, locatie en de letterlijke passage.
5. **Given** het resultaat is geladen, **When** de adviseur op de
   downloadknop klikt, **Then** wordt het dossier-document (.docx)
   gedownload met het label "CONCEPT, door adviseur te accorderen".
6. **Given** het resultaat is geladen, **When** de adviseur op
   "kopieer naar klembord" klikt, **Then** is de interne tekst volledig op
   het klembord geplaatst.
7. **Given** het resultaat of enig ander scherm van deze feature,
   **When** de UI wordt getoond, **Then** toont of suggereert de UI nergens
   een aanbeveling; alle uitvoer draagt het label CONCEPT.

---

### User Story 4 - Foutafhandeling en opnieuw proberen (Priority: P4)

Als adviseur wil ik bij een mislukte run een duidelijke Nederlandse
foutmelding zien met foutcode en een knop "Opnieuw" die het formulier
vooraf invult met de eerdere invoer, zodat ik zonder dubbel werk opnieuw
kan starten.

**Why this priority**: foutafhandeling maakt de flow compleet en betrouwbaar
zonder dat de MVP afhangt van fouten, maar mislukkingen (1-3 min wachttijd)
moeten altijd een duidelijk herstelpad hebben.

**Independent Test**: een gesimuleerde mislukte run openen en vaststellen
dat de foutmelding (inclusief foutcode) wordt getoond, en dat "Opnieuw"
het formulier opent met alle eerder ingevulde waarden.

**Acceptance Scenarios**:

1. **Given** de backend heeft de run gemarkeerd als mislukt met foutcode,
   **When** de adviseur de run opent, **Then** ziet de adviseur een
   duidelijke Nederlandse foutmelding met de foutcode én de knop
   "Opnieuw".
2. **Given** de adviseur klikt op "Opnieuw", **When** het formulier
   opent, **Then** zijn alle eerder ingevulde velden vooraf gevuld.
3. **Given** de verbinding met de backend valt weg tijdens het volgen van
   de status, **When** de status niet opgehaald kan worden, **Then** ziet
   de adviseur een expliciete foutstatus in plaats van een stilzwijgend
   stilvallende kaart.

---

### Edge Cases

- Wat gebeurt er als de adviseur een run start en direct daarna de browser
  sluit? De run blijft bestaan; bij terugkeer is de status actueel.
- Wat gebeurt er als de bestandsgrootte precies op de limiet zit?
  (Grenswaarde accepteren; documenteren in validatiemelding.)
- Wat gebeurt er als twee kennisbronnen zijn gekoppeld met een
  verschillende verzekeringscategorie? De selectie bepaalt het type; als
  de selectie ambigu is, vraagt de UI om verduidelijking (dropdown met
  verzekerings­type op basis van selectie).
- Wat gebeurt er als een bronverwijzing in de analyse naar een niet
  beschikbare passage verwijst (bijv. bron inmiddels verwijderd)? Het
  zijpaneel toont een expliciete melding i.p.v. een leeg paneel.
- Wat gebeurt er bij een sessie-time-out tijdens een open run-kaart? De
  adviseur moet opnieuw inloggen; de run zelf blijft bestaan.
- Wat gebeurt er als de backend een onbekende status teruggeeft
  (bijv. nieuwe status uit een nieuwere versie)? De UI toont een
  expliciete "onbekende status"-fout i.p.v. een lege of foutieve weergave.
- Wat gebeurt er met geüploade bestanden na de run? Bestanden worden na
  afronding van de run verwijderd (constitution Principle III).
- Wat gebeurt er als de adviseur een voltooide run opent na de
  bewaartermijn van 7 dagen? Uitsluitend run-metadata (klantreferentie,
  tijdstip, status) is zichtbaar, met een expliciete Nederlandse melding
  dat het resultaat automatisch verwijderd is.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: Het systeem MOET een formulier tonen met de Nederlandse
  velden Verzekeringsvraagstuk, Kennisbronnen, Klantsituatie, Bestanden,
  URL's, Klantreferentie en Adviseur (vooraf gevuld), met de verplichte
  en optionele velden zoals in US1.
- **FR-002**: Het systeem MOET bij Kennisbronnen uitsluitend de
  kennisbronnen tonen die aan de assistent Risico-analyse gekoppeld zijn
  en beschikbaar voor de adviseur.
- **FR-003**: Het systeem MOET bij versturen valideren dat minimaal één
  van Klantsituatie, Bestanden of URL's is gevuld en bij overtreding een
  inline Nederlandse melding tonen bij het betreffende veld.
- **FR-004**: Het systeem MOET URL's valideren op https en ongeldige
  toevoegingen inline afwijzen.
- **FR-005**: Het systeem MOET bestandsuploads beperken tot pdf, docx en
  txt en de maximale bestandsgrootte vóór upload tonen en afdwingen.
- **FR-006**: Het systeem MOET na versturen een run-kaart tonen met de
  status "in wachtrij", "bezig", "klaar" of "mislukt" en de verstreken
  tijd sinds start.
- **FR-007**: Het systeem MOET de adviseur toestaan weg te navigeren en
  later terug te keren; recente runs MOETEN per adviseur bewaard en
  getoond worden (herkenbaar aan klantreferentie en tijdstip).
- **FR-008**: Bij een mislukte run MOET het systeem een duidelijke
  Nederlandse foutmelding tonen met de foutcode, plus een knop "Opnieuw"
  die het formulier vooraf invult met de eerdere invoer.
- **FR-009**: Bij een geslaagde run MOET het systeem bovenaan het
  resultaat het paneel "Ontbrekende informatie voor het gesprek" tonen
  als checklist.
- **FR-010**: Het systeem MOET de interne analyse weergeven met de
  secties "risico's", "dekking en restgat", "draagkracht", "opties met
  voor en tegen" en "interne signalen" in die volgorde.
- **FR-011**: Het systeem MOET de sectie "interne signalen" zichtbaar
  markeren als "intern, speculatief".
- **FR-012**: Het systeem MOET bronverwijzingen (K1, R2, A1) klikbaar
  maken; een klik opent een zijpaneel met document, locatie en de
  letterlijke passage, of een expliciete melding als de passage niet
  (meer) beschikbaar is.
- **FR-013**: Het systeem MOET een downloadknop bieden voor het
  dossier-document (.docx) met het label "CONCEPT, door adviseur te
  accorderen".
- **FR-014**: Het systeem MOET een kopieerknop bieden die de interne
  tekst volledig naar het klembord kopieert.
- **FR-015**: De UI MAG NOOIT een aanbeveling tonen of suggereren; alle
  gegenereerde uitvoer MOET het label "CONCEPT" dragen.
- **FR-016**: Alle externe communicatie (webhook-aanroep, bestands­upload)
  MOET verlopen via een getypeerde client met expliciete foutstatussen;
  stilzwijgende fouten zijn verboden.
- **FR-017**: Klantinhoud MAG NOOIT verschijnen in de browser-URL of
  console-logs; recent-runs-labels bevatten uitsluitend klantreferentie
  en tijdstip.
- **FR-018**: Geüploade bestanden MOETEN na afronding van de run worden
  verwijderd; klantinhoud blijft niet langer bewaard dan de sessie in
  de browser.
- **FR-019**: De interface MOET voldoen aan WCAG 2.1 AA (toetsenbord­
  bediening, contrast, focusstatussen, semantische opmaak).
- **FR-020**: De interface is desktop-first; mobiel is responsief
  aanvaardbaar maar geen ontwerpdoel.
- **FR-021**: Het systeem MOET resultaten van geslaagde runs (analyse
  en dossier-document) gedurende maximaal 7 dagen na afronding
  server-side en versleuteld bewaren en daarna automatisch verwijderen;
  na verwijdering blijft uitsluitend run-metadata zichtbaar. De UI MOET
  bij het resultaat de bewaartermijn vermelden.

### Key Entities *(include if feature involves data)*

- **AnalyseRun**: één async-run; attributen: run-id, klantreferentie,
  adviseur, status (in wachtrij/bezig/klaar/mislukt), starttijdstip,
  verstreken tijd, foutcode (bij mislukking), verwijzingen naar
  resultaatdocumenten (interne analyse + dossier .docx).
- **Kennisbron**: bestaande entiteit (knowledge base) gekoppeld aan de
  assistent; de selectie bepaalt het verzekerings­type.
- **Bronverwijzing**: verwijzing binnen de analyse (id zoals K1, R2, A1)
  met document, locatie en letterlijke passage; onderdeel van het
  resultaat van de run.
- **Resultaat**: gestructureerde uitvoer van een geslaagde run:
  gaps-checklist, interne analyse-secties, bronverwijzingen, en een
  downloadbaar dossier-document (.docx); bewaartermijn maximaal 7 dagen
  na afronding (server-side, versleuteld), daarna automatisch verwijderd.
- **Adviseur**: de ingelogde gebruiker; bron voor het vooraf gevulde
  Adviseur-veld en eigenaar van de lijst recente runs.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Een adviseur kan een run volledig indienen in minder dan
  één minuut (van openen formulier tot start van de run).
- **SC-002**: De resultatenweergave toont alle secties van een
  voorbeeldresultaat (gaps-checklist, vijf analyse-secties,
  bronverwijzingen, download, kopieerknop) zonder ontbrekende onderdelen.
- **SC-003**: Elke bronverwijzing in het voorbeeldresultaat is aanklikbaar
  en het zijpaneel toont correct document, locatie en letterlijke
  passage.
- **SC-004**: In de browser-URL en console-logs komt op geen enkel moment
  klantinhoud voor (inclusief bestandsnamen en URL-invoer).
- **SC-005**: Bij een gesimuleerde mislukte run ziet de adviseur binnen
  twee handelingen (openen run, klik "Opnieuw") het vooraf gevulde
  formulier.
- **SC-006**: Alle schermen en meldingen zijn Nederlands, formeel-
  professioneel van toon, en vrij van aanbevelend taalgebruik; uitvoer
  draagt altijd het label CONCEPT.

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
-->

- De backend-workflow (n8n) en het Darwin API-contract bestaan en worden
  via een aparte specificatie/contractafspraken beschikbaar gesteld; de UI
  bouwt tegen een getypeerde client met expliciete foutstatussen.
- De maximale bestandsgrootte wordt centraal geconfigureerd en aan de UI
  doorgegeven; de UI toont en handhaaft de limiet (standaard aanname:
  per bestand tot 10 MB, totaal tot 25 MB).
- "Kennisbronnen beschikbaar voor de adviseur" betekent de kennisbronnen
  die aan de assistent Risico-analyse gekoppeld zijn binnen de
  organisatie van de ingelogde gebruiker (conform huidig RBAC-model).
- De run-status wordt periodiek opgehaald (polling) totdat de run klaar
  of mislukt is; realtime push (websockets) is geen v1-eis.
- Het dossier-document (.docx) wordt door de backend gegenereerd en
  aangeboden; de UI downloadt het bestand zonder inhoud te wijzigen.
- Klantreferentie is een vrij tekstveld zonder vast formaat; de backend
  kan er controles aan koppelen, maar de UI vereist alleen aanwezigheid.
- De assistent Risico-analyse wordt binnen het bestaande Assistenten-
  tabblad geconfigureerd als nieuw assistent-type (bevestigd door de
  gebruiker); formulier, run-kaart en resultaatweergave openen binnen
  de bestaande app-shell.
- Verzekerings­type wordt afgeleid uit de geselecteerde kennisbronnen;
  de UI toont het afgeleide type alleen als bevestiging/verduidelijking,
  niet als extra verplicht invoerveld.

## Out of Scope (v1)

- Vervolgvragen of doorvraag-chat na een resultaat (geen conversationele
  follow-up).
- Bewerken van de analyse in de UI.
- Opslaan/exporteren naar een extern zaaksysteem (dms/crm).
- Aanbevelingen of advies door de assistent of de UI (constitution
  Principle II: alleen CONCEPT).
- Mobiel-first layout; desktop-first is leidend, responsief aanvaardbaar.