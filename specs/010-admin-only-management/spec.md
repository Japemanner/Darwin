# Feature Specification: Beheerfuncties alleen voor beheerders

**Feature Branch**: `010-admin-only-management`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "Beheerfuncties alleen voor beheerders. Huidige situatie: Volgens de RLS-policies (supabase/migrations/001_initial_schema.sql) mag elk lid van een organisatie assistenten, kennisbronnen, documenten en koppelingen aanmaken, wijzigen en verwijderen. Een assistent verwijderen verwijdert ook alle gesprekken. De UI toont bewerkknoppen, webhook-URL's en kennisbronkoppelingen aan iedereen. Assistentkaarten tonen de technische typewaarde ("chat", "risico_analyse"), vallen zonder beschrijving terug op de system prompt, en inactieve assistenten zijn voor adviseurs zichtbaar en bruikbaar. User stories: 1. (P1) Als adviseur (rol member) zie ik alleen actieve assistenten, met een leesbaar type en een omschrijving. Ik kan ze starten, maar niet aanmaken, bewerken of verwijderen. 2. (P1) Als adviseur zie ik Kennisbronnen alleen-lezen: welke bronnen er zijn, welke documenten erin zitten en hun status. Uploaden, bewerken en verwijderen zie ik niet. 3. (P1) Als beheerder (rol admin) houd ik alle huidige beheermogelijkheden. Inactieve assistenten zie ik met het label "Inactief". 4. (P1) De database dwingt dit af, ook als iemand de UI omzeilt. Acceptatiecriteria: Een member krijgt bij insert, update of delete op ai_assistants, knowledge_bases, knowledge_base_documents, knowledge_items en assistant_knowledge_bases een RLS-weigering. Lezen binnen de eigen organisatie blijft werken. Een member kan geen bestanden uploaden naar of verwijderen uit de storage-bucket knowledge-documents. Eigen gesprekken, berichten en feedback blijven voor members werken. De system prompt wordt nergens in de UI aan members getoond. Typelabels: chat wordt "Chat", risico_analyse wordt "Risico-analyse". Verborgen knoppen zijn ook niet via het toetsenbord bereikbaar (niet alleen visueel verborgen). Buiten scope: nieuwe rollen, rechten per assistent, de pagina's Team en Instellingen (die zijn al admin-only)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Adviseur gebruikt alleen actieve assistenten (Priority: P1)

Als adviseur open ik het assistentoverzicht. Ik zie alleen actieve assistenten, met een
leesbaar type ("Chat" of "Risico-analyse") en een omschrijving. Ik start een gesprek;
besturing om assistenten aan te maken, te bewerken of te verwijderen zie ik niet en kan
ik ook niet met het toetsenbord bereiken. Webhook-URL's en de systeeminstructie van een
assistent worden mij nergens getoond.

**Why this priority**: De adviseur is de primaire gebruiker van het platform. Beheer
hoort bij de beheerder; de huidige kaarten lekken bovendien de systeeminstructie als
fallback-omschrijving en tonen technische typecodes, wat het professionele beeld
aantast en interne configuratie blootstelt.

**Independent Test**: Volledig te testen met een adviseursaccount: het overzicht toont
alleen actieve assistenten met leesbare labels en omschrijvingen; de assistentkaarten
bevatten geen beheerbesturing (visueel én via toetsenbordnavigatie) en geen webhook-URL
of systeeminstructie; een gestarte chat werkt zoals voorheen.

**Acceptance Scenarios**:

1. **Given** een ingelogde adviseur wiens organisatie één actieve en één inactieve
   assistent heeft, **When** deze het assistentoverzicht opent, **Then** ziet deze
   alleen de actieve assistent, met typelabel "Chat" of "Risico-analyse" en de
   omschrijving.
2. **Given** een actieve assistent zonder omschrijving, **When** een adviseur de
   assistentkaart bekijkt, **Then** wordt geen systeeminstructie als vervanging getoond.
3. **Given** een ingelogde adviseur, **When** deze de UI volledig met het toetsenbord
   doorloopt, **Then** is geen enkele beheerbesturing (aanmaken, bewerken, verwijderen,
   koppelen) bereikbaar.
4. **Given** een ingelogde adviseur, **When** deze een gesprek start met een actieve
   assistent, **Then** werkt de chat ongewijzigd: vraag stellen, antwoord ontvangen,
   gespreksgeschiedenis raadplegen.
5. **Given** een ingelogde adviseur, **When** deze een assistentkaart of -detail
   bekijkt, **Then** is de webhook-URL nergens zichtbaar.

---

### User Story 2 - Adviseur ziet Kennisbronnen alleen-lezen (Priority: P1)

Als adviseur open ik Kennisbronnen. Ik zie welke kennisbronnen er zijn, welke
documenten erin zitten en welke status elk document heeft (in verwerking, gereed of
fout). Upload-, bewerk- en verwijderbesturing zie ik niet en kan ik ook niet met het
toetsenbord bereiken.

**Why this priority**: Kennisbronnen voeden de antwoorden van assistenten; inzicht in
deze bronnen en hun verwerkingsstatus is nuttig voor de adviseur, maar het beheer
ervan is een beheerderstaak. Adviseurs zien nu onterecht beheerbesturing die zij niet
mogen gebruiken.

**Independent Test**: Volledig te testen met een adviseursaccount: de pagina toont de
kennisbronnen met hun documenten en statussen; alle upload-, bewerk- en
verwijderbesturing ontbreekt (visueel én via toetsenbordnavigatie); het leesgedrag is
ongewijzigd.

**Acceptance Scenarios**:

1. **Given** een ingelogde adviseur wiens organisatie kennisbronnen met documenten
   heeft, **When** deze Kennisbronnen opent, **Then** ziet deze de bronnen, de
   documenten daarin en de status van elk document.
2. **Given** een ingelogde adviseur, **When** deze Kennisbronnen volledig met het
   toetsenbord doorloopt, **Then** is geen enkele upload-, bewerk- of
   verwijderbesturing bereikbaar.
3. **Given** een ingelogde adviseur, **When** deze probeert een document of
   kennisbron te wijzigen via een directe aanroep buiten de UI, **Then** weigert het
   platform de actie (uitgewerkt in User Story 4).

---

### User Story 3 - Beheerder behoudt alle beheermogelijkheden (Priority: P1)

Als beheerder zie ik in het assistentoverzicht alle assistenten, inclusief inactieve,
met het label "Inactief". Ik kan assistenten, kennisbronnen, documenten, kennisitems
en koppelingen aanmaken, bewerken en verwijderen zoals nu. Webhook-URL's,
koppelingsbesturing en de systeeminstructie blijven voor mij zichtbaar.

**Why this priority**: De beperking voor adviseurs mag geen enkele functionaliteit
kosten voor beheerders. Het label "Inactief" maakt onderscheid tussen bruikbare en
gedeactiveerde assistenten zichtbaar zonder technische details.

**Independent Test**: Volledig te testen met een beheerdersaccount: alle bestaande
beheerflows (assistent, kennisbron, document, kennisitem, koppeling aanmaken,
bewerken, verwijderen; document uploaden) slagen ongewijzigd; inactieve assistenten
dragen het label "Inactief".

**Acceptance Scenarios**:

1. **Given** een ingelogde beheerder wiens organisatie één actieve en één inactieve
   assistent heeft, **When** deze het assistentoverzicht opent, **Then** ziet deze
   beide assistenten en draagt de inactieve assistent het label "Inactief".
2. **Given** een ingelogde beheerder, **When** deze een assistent aanmaakt, bewerkt
   of verwijdert — inclusief kennisbronkoppelingen en webhook-URL — **Then** werkt dit
   ongewijzigd.
3. **Given** een ingelogde beheerder, **When** deze een document uploadt naar of
   verwijdert uit een kennisbron, **Then** werkt dit ongewijzigd.
4. **Given** een ingelogde beheerder, **When** deze een kennisitem toevoegt of
   verwijdert, **Then** werkt dit ongewijzigd.

---

### User Story 4 - Het gegevensplatform dwingt de rechten af (Priority: P1)

Als organisatie weten we zeker dat de rechten niet alleen in de UI gelden: het
gegevensplatform weigert elke poging van een adviseur om assistenten, kennisbronnen,
documenten, kennisitems of koppelingen tussen assistenten en kennisbronnen toe te
voegen, te wijzigen of te verwijderen — ook als de UI wordt omzeild. Adviseurs
behouden leestoegang binnen de eigen organisatie en volledig gebruik van hun eigen
gesprekken, berichten en feedback. Uploaden naar en verwijderen uit de
documentopslag wordt voor adviseurs eveneens geweigerd.

**Why this priority**: UI-maatregelen alleen zijn te omzeilen. Afdwinging op
gegevensniveau is de garantie dat beheerfuncties écht beheerder-only zijn; dit is de
laatste verdedigingslinie van de hele feature.

**Independent Test**: Volledig te testen met directe data-aanroepen onder een
adviseursaccount, buiten de UI om: alle vijftien combinaties (vijf gegevenssoorten ×
drie schrijfhandelingen) worden geweigerd; upload naar en verwijdering uit de
documentopslag worden geweigerd; leesopvragingen binnen de eigen organisatie slagen;
gesprekken, berichten en feedback blijven werkzaam.

**Acceptance Scenarios**:

1. **Given** een adviseursaccount, **When** dit direct buiten de UI om een assistent,
   kennisbron, document, kennisitem of koppeling toevoegt, wijzigt of verwijdert,
   **Then** weigert het platform de actie; er vindt geen gegevenswijziging plaats.
2. **Given** een adviseursaccount, **When** dit direct buiten de UI om bestanden
   uploadt naar of verwijdert uit de documentopslag, **Then** weigert het platform
   dit.
3. **Given** een adviseursaccount, **When** dit assistenten, kennisbronnen,
   documenten, kennisitems en koppelingen binnen de eigen organisatie leest,
   **Then** slaagt dit.
4. **Given** een adviseursaccount, **When** deze eigen gesprekken aanmaakt, berichten
   toevoegt en feedback geeft, **Then** werkt dit ongewijzigd.

---

### Edge Cases

- Wat gebeurt er wanneer een adviseur een schrijfhandeling direct via de data-API
  probeert in plaats van via de UI? → Het platform weigert de handeling op
  gegevensniveau (User Story 4); er vindt geen gegevenswijziging plaats.
- Wat als een assistent geen omschrijving heeft? → Er wordt geen tekst als vervanging
  getoond; de systeeminstructie is nooit de fallback.
- Wat als een assistent wordt gedeactiveerd terwijl een adviseur een lopend of
  afgerond gesprek heeft? → Het gesprek en de geschiedenis blijven bestaan; de
  assistent verdwijnt uit het overzicht van de adviseur en is niet meer te starten.
- Wat gebeurt er wanneer een beheerder een assistent met gesprekken verwijdert? →
  Bestaand gedrag (gesprekken worden mee verwijderd) blijft ongewijzigd; deze
  handeling is na deze feature beheerder-only.
- Wat gebeurt er wanneer de rol van een gebruiker wijzigt (adviseur wordt beheerder
  of andersom)? → Rechten worden bij elke aanroep opnieuw vastgesteld; na opnieuw
  laden van de UI klopt het aanbod van besturing met de nieuwe rol.
- Wat als een adviseur een directe URL naar een beheerweergave opent? → De
  beheerbesturing wordt per rol getoond; de adviseur ziet de leesweergave, en
  eventuele directe schrijfhandelingen worden door het platform geweigerd (User
  Story 4).
- Wat als de laatste beheerder van een organisatie de organisatie verlaat? → Buiten
  scope: rolbeheer verandert niet in deze feature; de bestaande teambeheer-flow
  blijft bepalend.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Het systeem MOET assistenttypen met een leesbaar label tonen: "chat"
  als "Chat" en "risico_analyse" als "Risico-analyse".
- **FR-002**: Het systeem MOET adviseurs alleen actieve assistenten tonen;
  beheerders MOETEN alle assistenten zien, waarbij inactieve assistenten het label
  "Inactief" dragen.
- **FR-003**: Het systeem MOET bij een assistent zonder omschrijving géén
  vervangende tekst tonen; de systeeminstructie MAG nooit als omschrijving worden
  getoond.
- **FR-004**: Beheerbesturing voor aanmaken, bewerken en verwijderen van assistenten,
  kennisbronnen, documenten, kennisitems en koppelingen MOET voor adviseurs zowel
  onzichtbaar als onbereikbaar zijn, inclusief via toetsenbordnavigatie
  (constitution IV).
- **FR-005**: Webhook-URL's en systeeminstructies MOETEN in de UI uitsluitend aan
  beheerders worden getoond.
- **FR-006**: Het systeem MOET adviseurs kennisbronnen, de documenten daarin en hun
  verwerkingsstatus (in verwerking, gereed, fout) alleen-lezen tonen.
- **FR-007**: Het gegevensplatform MOET het toevoegen, wijzigen en verwijderen van
  assistenten, kennisbronnen, documenten, kennisitems en koppelingen tussen assistent
  en kennisbron voor adviseurs weigeren — ook bij aanroep buiten de UI om.
- **FR-008**: Het gegevensplatform MOET voor adviseurs het uploaden naar en
  verwijderen uit de documentopslag weigeren.
- **FR-009**: Het gegevensplatform MOET de leestoegang voor adviseurs binnen de
  eigen organisatie laten werken (assistenten, kennisbronnen, documenten,
  kennisitems, koppelingen).
- **FR-010**: Adviseurs MOETEN hun eigen gesprekken, berichten en feedback
  ongewijzigd kunnen blijven gebruiken: gesprekken aanmaken en lezen, berichten
  toevoegen, feedback geven.
- **FR-011**: Beheerders MOETEN alle huidige beheermogelijkheden behouden:
  assistenten, kennisbronnen, documenten, kennisitems en koppelingen aanmaken,
  bewerken en verwijderen; documenten uploaden en verwijderen.

### Key Entities

- **Rol**: "admin" (beheerder) of "member" (adviseur), onderdeel van het
  gebruikersprofiel binnen een organisatie; bepaalt de zichtbaarheid van
  beheerbesturing in de UI en de door het platform afgedwongen schrijfrechten.
- **Assistent**: naam, omschrijving, type (chat of risico-analyse), actief-status,
  systeeminstructie en webhook-URL; systeeminstructie en webhook-URL zijn alleen
  zichtbaar voor beheerders.
- **Kennisbron**: naam, beschrijving; bevat documenten en kennisitems.
- **Document**: naam, bestandstype, bestandsgrootte en verwerkingsstatus (in
  verwerking, gereed, fout); het bestand staat in de documentopslag.
- **Kennisitem**: tekstueel kennisitem binnen een kennisbron.
- **Koppeling (assistent–kennisbron)**: welke kennisbronnen een assistent gebruiken;
  beheer hiervan is beheerder-only.
- **Gesprek / Bericht / Feedback**: eigen gebruikersgegevens van een adviseur;
  blijven volledig bruikbaar.
- **Documentopslag**: bestandsopslag voor kennisbrondocumenten; uploaden en
  verwijderen is beheerder-only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Alle vijftien combinaties van vijf gegevenssoorten (assistenten,
  kennisbronnen, documenten, kennisitems, koppelingen) en drie schrijfhandelingen
  (toevoegen, wijzigen, verwijderen) leveren onder een adviseursaccount een weigering
  op — verifieerbaar met geautomatiseerde tests die de gegevenslaag rechtstreeks
  aanroepen.
- **SC-002**: Uploaden naar en verwijderen uit de documentopslag is onder een
  adviseursaccount onmogelijk — verifieerbaar met geautomatiseerde tests.
- **SC-003**: In geen enkele UI-weergave is voor een adviseur een systeeminstructie,
  webhook-URL of beheerbesturing zichtbaar of via het toetsenbord bereikbaar —
  verifieerbaar met geautomatiseerde UI-tests inclusief volledige
  toetsenbordnavigatie (constitution IV).
- **SC-004**: De adviseursbeleving van de chat blijft ongewijzigd: eigen gesprekken,
  berichten en feedback werken zoals voorheen — verifieerbaar met de bestaande
  regressietestsuite.
- **SC-005**: Beheerders verliezen geen functionaliteit: alle bestaande
  beheerflows slagen in de regressietestsuite en inactieve assistenten dragen het
  label "Inactief" — verifieerbaar met geautomatiseerde UI-tests.
- **SC-006**: Assistentkaarten tonen de leesbare typelabels "Chat" en
  "Risico-analyse" in plaats van technische typecodes — verifieerbaar met
  geautomatiseerde UI-tests.

## Assumptions

**Buiten scope** (vastgelegd in de opdracht):

- Nieuwe rollen of uitgebreid rolbeheer.
- Rechten per assistent.
- De pagina's Team en Instellingen (die zijn al beheerder-only).
- Extra blokkades op gegevensniveau buiten de genoemde schrijfhandelingen: het
  aanmaken van een gesprek met een inactieve assistent blijft via directe aanroep
  technisch mogelijk; de UI verbergt de assistent voor adviseurs (conform de
  expliciete acceptatiecriteria van de opdracht).

**Aannames en gemaakte keuzes**:

- Leestoegang binnen de eigen organisatie blijft voor alle leden werken (expliciet
  in de acceptatiecriteria).
- Bestaande koppelingen tussen assistenten en kennisbronnen mogen leesbaar zichtbaar
  blijven voor adviseurs; de besturing om koppelingen te leggen of te verbreken is
  beheerder-only.
- De leesbare typelabels gelden voor alle gebruikers: ook beheerders zien "Chat" en
  "Risico-analyse" in plaats van de technische typecodes.
- Een assistent zonder omschrijving toont geen tekst; de systeeminstructie wordt
  nergens als vervanging gebruikt en is voor adviseurs nergens zichtbaar.
- De verwerkingsstatus van documenten (in verwerking, gereed, fout) is ook voor
  adviseurs zichtbaar, zoals gevraagd in User Story 2.
- Rechten worden bij elke aanroep opnieuw vastgesteld; na een rolwijziging klopt de
  UI na opnieuw laden met de nieuwe rol.
- De huidige UI toont de systeeminstructie nergens — ook niet in het
  bewerkformulier (dat heeft geen veld hiervoor); dit blijft ongewijzigd. Er
  komt geen zichtbaar systeeminstructie-veld bij (constitution VI); FR-005 is
  daarmee automatisch voldaan voor dit onderdeel.
- Nieuwe UI-teksten zijn in het Nederlands, zakelijk-formeel van toon
  (constitution I).