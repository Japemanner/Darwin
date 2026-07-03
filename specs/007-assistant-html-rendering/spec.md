# Feature Specification: Assistant HTML Rendering

**Feature Branch**: `007-assistant-html-rendering`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "ik wil dat de assistenten hun informatie terug geven in HTML en dat deze wordt weergegeven ipv de huidige manier. er mogen geen wijzigingen zijn in wat de user ziet"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assistent antwoordt met HTML (Priority: P1)

Een gebruiker stelt een vraag aan een assistent in de chat. De assistent levert zijn antwoord voortaan als gestructureerde HTML in plaats van platte tekst. Het antwoord wordt in de chat-bel weergegeven met behoud van exact dezelfde visuele vormgeving als vandaag: zelfde lettergrootte, regelafstand, kleuren, padding en bubbelformaat. De gebruiker merkt geen verschil in hoe het antwoord eruitziet.

**Why this priority**: Dit is de kern van de feature — de volledige pijplijn van bron (assistent) tot weergave (chat-bel) wordt omgezet naar HTML met behoud van de huidige gebruikerservaring.

**Independent Test**: Stel een vraag aan een assistent en vergelijk de weergave met een eerdere sessie. Het antwoord moet visueel identiek zijn, terwijl de onderliggende inhoud nu HTML is.

**Acceptance Scenarios**:

1. **Given** een ingelogde gebruiker met toegang tot een assistent, **When** de gebruiker een vraag stuurt en het antwoord terugkrijgt, **Then** wordt het antwoord getoond in de chat-bel met identieke vormgeving als vóór de wijziging (zelfde bubble-stijl, tekstgrootte en kleur).
2. **Given** een antwoord dat uitsluitend platte tekst bevat, **When** dit als HTML wordt aangeleverd en gerenderd, **Then** ziet de gebruiker exact dezelfde platte tekst zonder zichtbare opmaak of extra elementen.
3. **Given** een antwoord dat structuur bevat (paragrafen, lijsten), **When** dit als HTML wordt gerenderd, **Then** blijft de tekst binnen de bestaande chat-bel met dezelfde maximale breedte en zonder overloop of lay-outbreuk.

---

### User Story 2 - Geschiedenis toont HTML op identieke wijze (Priority: P2)

Een gebruiker opent een eerdere conversatie via de geschiedenis-weergave. De opgeslagen assistent-antwoorden worden getoond met dezelfde HTML-weergave als in de live chat, met behoud van de huidige vormgeving van de geschiedenis-bel.

**Why this priority**: De geschiedenis-weergave is de tweede locatie waar assistent-antwoorden tonen; beide locaties moeten consistent blijven.

**Independent Test**: Open een opgeslagen conversatie en vergelijk een assistent-antwoord met dezelfde vraag in een live sessie. De weergave moet identiek zijn.

**Acceptance Scenarios**:

1. **Given** een opgeslagen conversatie met assistent-antwoorden, **When** de gebruiker de conversatie opent in de geschiedenis-weergave, **Then** worden de antwoorden getoond met dezelfde HTML-weergave en identieke vormgeving als in de live chat.
2. **Given** een conversatie die vóór de wijziging is opgeslagen met platte tekst, **When** deze wordt geopend, **Then** blijven die oude antwoorden correct leesbaar zonder visuele breuk.

---

### User Story 3 - Antwoorden blijven veilig voor de gebruiker (Priority: P3)

Assistent-antwoorden die als HTML binnenkomen, worden zodanig weergegeven dat schadelijke of ongewenste inhoud geen invloed heeft op de applicatie of de gebruiker. De gebruiker merkt hier niets van; de weergave blijft identiek.

**Why this priority**: Veiligheid van weergegeven inhoud is een voorwaarde voor de HTML-weergave, maar is voor de gebruiker onzichtbaar — daarom P3.

**Independent Test**: Lever een antwoord aan met een script-element of onveilige markup en verifieer dat dit niet wordt uitgevoerd en de gebruiker niets anders ziet dan de bedoelde tekst.

**Acceptance Scenarios**:

1. **Given** een antwoord dat een script-element of andere potentieel schadelijke markup bevat, **When** dit wordt weergegeven, **Then** wordt de schadelijke markup niet uitgevoerd en toont de gebruiker uitsluitend de veilige tekstinhoud.
2. **Given** een antwoord met toegestane HTML (paragrafen, lijsten, nadruk), **When** dit wordt weergegeven, **Then** blijft de veilige inhoud correct zichtbaar binnen de bestaande chat-bel-stijl.

---

### Edge Cases

- Wat gebeurt er wanneer een antwoord lege HTML of alleen whitespace bevat? De bel mag niet instorten of een lege bubbel tonen; gedrag moet gelijk zijn aan een leeg platte-tekst antwoord vandaag.
- Wat gebeurt er met antwoorden die vóór deze wijziging als platte tekst zijn opgeslagen? Deze moeten in de geschiedenis nog steeds correct en leesbaar blijven.
- Wat gebeurt er wanneer de assistentbron onverwacht géén HTML maar platte tekst retourneert (bijv. tijdelijke wijziging in de bron)? De weergave mag niet breken en moet de tekst veilig tonen.
- Wat gebeurt er bij zeer lange antwoorden met veel HTML-structuur? De bel moet dezelfde scroll- en breedte-gedrag behouden als vandaag.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Assistenten MOETEN hun antwoorden leveren als HTML in plaats van platte tekst.
- **FR-002**: Het systeem MOET assistent-antwoorden als HTML weergeven in de live chat-bel.
- **FR-003**: Het systeem MOET assistent-antwoorden als HTML weergeven in de geschiedenis-weergave.
- **FR-004**: De HTML-weergave MOET visueel identiek zijn aan de huidige platte-tekst weergave — zelfde bubble-vormgeving, lettergrootte, kleuren, padding en breedte.
- **FR-005**: Het systeem MOET eerder opgeslagen platte-tekst antwoorden in de geschiedenis blijven tonen zonder visuele breuk.
- **FR-006**: Het systeem MOET voorkomen dat schadelijke of ongewenste markup in assistent-antwoorden wordt uitgevoerd of de applicatie beïnvloedt.
- **FR-007**: De weergave MOET veilig omgaan met antwoorden die onverwacht géén HTML bevatten (platte tekst), zonder de gebruiker een fout te tonen.
- **FR-008**: De weergave van assistent-antwoorden MOET consistent zijn tussen de live chat en de geschiedenis-weergave.

### Key Entities *(include if feature involves data)*

- **Assistent-antwoord**: De inhoud die een assistent retourneert op een gebruikersvraag. Belangrijkste attribuut is de antwoordtekst, die voortaan als HTML wordt aangeleverd. Relatie met conversatie en gebruikersvraag blijft ongewijzigd.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% van nieuwe assistent-antwoorden wordt als HTML aangeleverd en als zodanig weergegeven.
- **SC-002**: Een zij-aan-zij vergelijking van dezelfde vraag vóór en ná de wijziging toont een visueel identiek resultaat voor de gebruiker (geen verschil in bubble-vormgeving, lettergrootte, kleur of breedte).
- **SC-003**: 100% van vóór de wijziging opgeslagen antwoorden blijft correct en leesbaar zichtbaar in de geschiedenis-weergave.
- **SC-004**: Geen enkel assistent-antwoord met schadelijke markup leidt tot uitvoering van die markup of tot beïnvloeding van de applicatie.
- **SC-005**: De weergave van antwoorden is consistent tussen live chat en geschiedenis — 0 visuele verschillen.

## Assumptions

- De bron van assistent-antwoorden (het externe automation-platform per organisatie) wordt zodanig aangepast dat het `answer`-veld HTML bevat; deze aanpassing valt buiten de scope van dit front-end systeem.
- Huidige assistent-antwoorden bevatten uitsluitend platte tekst zonder opmaak-tekens, zodat HTML-weergave visueel identiek is.
- De huidige vormgeving van de chat-bel (vorm, grootte, kleuren, breedte) blijft ongewijzigd; alleen de manier waarop de antwoordinhoud wordt gerenderd verandert.
- Antwoorden blijven worden opgeslagen zoals nu; er worden geen nieuwe opslagvelden geïntroduceerd voor deze feature.
- Deze feature betreft uitsluitend de weergave van antwoordinhoud — de bronnen ("Bronnen") blijven ongewijzigd getoond.