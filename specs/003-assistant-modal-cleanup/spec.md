# Feature Specification: Assistant Modal Cleanup

**Feature Branch**: `003-assistant-modal-cleanup`

**Created**: 2026-06-01

**Status**: Draft

**Input**: User description: "Wanneer ik op nieuwe assistent klik krijg ik een modal te zien. Verwijder hier de volgende velden: Icoon, onder type Agent en Voice, system prompt. Maak het ook mogelijk om hier een assistent te verwijderen"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Vereenvoudigde modal bij aanmaken assistent (Priority: P1)

Een gebruiker klikt op "Nieuwe assistent" en ziet een overzichtelijk formulier met alleen de essentiële velden. Icoon, system prompt en N8N webhook URL zijn verwijderd omdat deze elders of niet meer relevant zijn.

**Why this priority**: Dit is de kern van de feature — de modal versimpelen. Zonder deze story is er geen bruikbare UI-wijziging.

**Independent Test**: Kan volledig getest worden door op "Nieuwe assistent" te klikken en te verifiëren dat alleen Naam, Type (alleen Chat), Beschrijving, Kennisbronnen en Actief zichtbaar zijn.

**Acceptance Scenarios**:

1. **Given** de gebruiker is op de assistentenpagina, **When** hij op "Nieuwe assistent" klikt, **Then** opent een modal met alleen de velden: Naam, Type (alleen Chat), Beschrijving, Kennisbronnen, Actief
2. **Given** de modal staat open in create-modus, **When** de gebruiker Naam en overige velden invult en opslaat, **Then** wordt een nieuwe assistent aangemaakt met type `chat` en default icon `🤖`
3. **Given** de modal staat open, **When** de gebruiker op Annuleren klikt of de modal sluit, **Then** wordt er niets opgeslagen

---

### User Story 2 - Vereenvoudigde modal bij bewerken assistent (Priority: P1)

Een gebruiker opent een bestaande assistent om te bewerken en ziet het vereenvoudigde formulier, vooringevuld met de huidige waarden.

**Why this priority**: Bewerken is een bestaande flow die consistent moet blijven met de nieuwe vereenvoudigde create-flow.

**Independent Test**: Open een bestaande assistent via het bewerk-icoon en verifieer dat de modal de vereenvoudigde velden toont, vooringevuld.

**Acceptance Scenarios**:

1. **Given** een bestaande assistent, **When** de gebruiker op het bewerk-icoon klikt, **Then** opent de modal met de vereenvoudigde velden vooringevuld
2. **Given** de bewerk-modal staat open, **When** de gebruiker velden wijzigt en opslaat, **Then** worden de wijzigingen bewaard

---

### User Story 3 - Assistent verwijderen vanuit de modal (Priority: P2)

Een gebruiker kan een bestaande assistent permanent verwijderen direct vanuit de bewerk-modal, zonder terug te hoeven naar de lijst.

**Why this priority**: Verwijderen is een secundaire functionaliteit die waarde toevoegt maar de kern van de feature niet blokkeert.

**Independent Test**: Open de bewerk-modal van een bestaande assistent, klik op verwijderen, bevestig, en verifieer dat de assistent uit de lijst verdwijnt.

**Acceptance Scenarios**:

1. **Given** de bewerk-modal van een bestaande assistent staat open, **When** de gebruiker op de verwijderknop klikt, **Then** verschijnt een bevestigingsdialog ("Weet je zeker dat je [naam] wilt verwijderen?")
2. **Given** de bevestigingsdialog staat open, **When** de gebruiker bevestigt, **Then** wordt de assistent verwijderd, de modal sluit, en de lijst ververst
3. **Given** de bevestigingsdialog staat open, **When** de gebruiker annuleert, **Then** blijft de modal open en wordt de assistent niet verwijderd
4. **Given** de modal staat open voor een nieuwe assistent (create-modus), **When** we kijken naar de actieknoppen, **Then** is er geen verwijderknop zichtbaar

---

### Edge Cases

- Wat gebeurt er met gekoppelde conversaties bij verwijderen van een assistent? De conversaties en bijbehorende berichten worden mee verwijderd.
- Wat gebeurt er met gekoppelde kennisbronnen (assistant_knowledge_bases) bij verwijderen? De junction-rijen worden mee verwijderd.
- Wat als de gebruiker probeert de laatste assistent in de organisatie te verwijderen? Geen beperking — verwijderen is altijd toegestaan.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: De modal voor aanmaken/bewerken van assistenten toont ALLEEN de velden: Naam, Type, Beschrijving, Kennisbronnen, Actief
- **FR-002**: Het veld "Icoon" is verwijderd uit de modal
- **FR-003**: Het veld "System prompt" is verwijderd uit de modal
- **FR-004**: Het veld "N8N Webhook URL" is verwijderd uit de modal
- **FR-005**: De Type-dropdown toont alleen de optie "Chat" (uitbreidbaar voor toekomstige types)
- **FR-006**: Bij aanmaken van een nieuwe assistent wordt `type` standaard `'chat'` en `icon` standaard `'🤖'`
- **FR-007**: De bewerk-modal voor een bestaande assistent toont een verwijderknop in de footer
- **FR-008**: De verwijderknop is NIET zichtbaar bij het aanmaken van een nieuwe assistent
- **FR-009**: Na klikken op verwijderen verschijnt een bevestigingsdialog met de naam van de assistent
- **FR-010**: Bij bevestiging wordt de assistent, diens conversaties, en diens kennisbronkoppelingen permanent verwijderd
- **FR-011**: Na succesvol verwijderen sluit de modal en wordt de assistentenlijst ververst
- **FR-012**: Bestaande assistenten met type `agent` of `voice` worden gemigreerd naar type `chat`

### Key Entities *(include if feature involves data)*

- **AI Assistant**: Heeft een naam, type (chat), beschrijving, icon (standaardwaarde), is_actief-status. Gekoppeld aan een organisatie, 0-of-meer kennisbronnen (via junction), 0-of-meer conversaties.
- **Conversation**: Gekoppeld aan een assistent, bevat berichten. Wordt cascade verwijderd met de assistent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Gebruikers kunnen een nieuwe assistent aanmaken met maximaal 5 velden in de modal
- **SC-002**: Gebruikers kunnen een bestaande assistent permanent verwijderen in maximaal 2 klikken (verwijderknop → bevestigen)
- **SC-003**: Alle bestaande `agent`/`voice` assistenten functioneren na migratie als `chat` assistenten
- **SC-004**: Verwijderde assistenten verdwijnen direct uit de lijst zonder paginaverversing

## Assumptions

- De N8N webhook URL wordt globaal per organisatie ingesteld via de instellingenpagina (SettingsPage) en is reeds werkend
- De `icon` en `system_prompt` kolommen blijven in de database-tabel `ai_assistants` bestaan (geen DDL-migratie)
- Bij aanmaken krijgt `icon` de defaultwaarde `'🤖'` en `system_prompt` een lege string
- De database heeft cascade delete op `conversations.assistant_id` en `assistant_knowledge_bases.assistant_id`
- Voor het verwijderen van conversaties en berichten wordt een Supabase Edge Function gebruikt of handmatige cascade in de client
