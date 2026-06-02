# Feature Specification: Chat Feedback — Duimpjes

**Feature Branch**: `004-chat-feedback-thumbs`

**Created**: 2026-06-02

**Status**: Draft

**Input**: User description: "onder assistenten, en als ik dan chat met een assistent wil ik boven het pijl van versturen een duimpje naar beneden en een duimpje naar boven. Wanneer een gebruiker een pijltje naar beneden drukt wil ik dat er een tekstvlak verschijnt. ik wil dat dit naar aparte tabel in supabase wordt weggeschreven."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Duimpje omhoog geven op een gesprek (Priority: P1)

Een gebruiker chat met een assistent en is tevreden over het antwoord. Onder de berichten, boven het invoerveld, ziet de gebruiker een duimpje-omhoog en duimpje-omlaag knop. De gebruiker klikt op duimpje omhoog. De waardering wordt direct opgeslagen en de knoppen worden gemuteerd.

**Why this priority**: Dit is de primaire interactie — positieve feedback snel en zonder wrijving kunnen geven.

**Independent Test**: Start een chat, stuur een bericht, wacht op antwoord, klik op duimpje omhoog. Verifieer dat de knoppen verdwijnen/muten en de rating is opgeslagen.

**Acceptance Scenarios**:

1. **Given** een chatgesprek met minimaal één assistant-antwoord, **When** de gebruiker op duimpje omhoog klikt, **Then** wordt de rating opgeslagen en de knoppen muteren naar een bevestigde staat (duimpje omhoog gemarkeerd, omlaag gedimd)

---

### User Story 2 - Duimpje omlaag met feedbacktekst (Priority: P1)

Een gebruiker is niet tevreden over het antwoord. De gebruiker klikt op duimpje omlaag. Er verschijnt een tekstvak waarin de gebruiker kan toelichten wat er niet goed was. De gebruiker vult feedback in en verstuurt deze.

**Why this priority**: Negatieve feedback met context is essentieel voor het verbeteren van de assistent-kwaliteit.

**Independent Test**: Start een chat, stuur een bericht, klik op duimpje omlaag, vul feedbacktekst in, verstuur. Verifieer dat de feedback + rating is opgeslagen.

**Acceptance Scenarios**:

1. **Given** een chatgesprek met minimaal één assistant-antwoord, **When** de gebruiker op duimpje omlaag klikt, **Then** verschijnt een tekstvak direct onder de duimpjes
2. **Given** het feedback-tekstvak is zichtbaar, **When** de gebruiker tekst invult en op verstuur klikt, **Then** wordt de rating + feedback opgeslagen en verdwijnen de knoppen + tekstvak
3. **Given** het feedback-tekstvak is zichtbaar, **When** de gebruiker op annuleren klikt, **Then** verdwijnt het tekstvak en blijven de duimpjes actief

---

### User Story 3 - Feedback permanent opgeslagen (Priority: P1)

Alle feedback (zowel duimpje omhoog als omlaag met tekst) wordt weggeschreven naar een aparte tabel. Per rating wordt vastgelegd welk gesprek, welke assistent, welke gebruiker, welke organisatie, en wanneer de feedback is gegeven.

**Why this priority**: Zonder opslag heeft de feature geen blijvende waarde. Dit is de data-laag die analyse en rapportage mogelijk maakt.

**Independent Test**: Geef feedback via de UI, controleer direct in de database dat er een rij is aangemaakt met de juiste gegevens.

**Acceptance Scenarios**:

1. **Given** een gebruiker geeft duimpje omhoog, **When** de rating is opgeslagen, **Then** bevat de database een rij met `thumbs_up = true` en de juiste conversatie-, gebruiker- en organisatie-ID's
2. **Given** een gebruiker geeft duimpje omlaag met feedbacktekst, **When** de rating is opgeslagen, **Then** bevat de database een rij met `thumbs_up = false`, de feedbacktekst, en de juiste verwijzingen

---

### User Story 4 - Opnieuw openen toont geen eerdere rating (Priority: P2)

Wanneer een gebruiker een gesprek waarop al feedback is gegeven opnieuw opent, worden de duimpjes opnieuw getoond alsof er nog geen feedback is gegeven. De gebruiker kan niet opnieuw feedback geven (de UI blokkeert dit na de eerste keer per gebruiker per gesprek).

**Why this priority**: Voorkomt verwarring en dubbele ratings, maar is minder kritisch dan de kernfunctionaliteit.

**Independent Test**: Geef feedback op een gesprek, sluit het chatvenster, open hetzelfde gesprek opnieuw. De duimpjes zijn opnieuw zichtbaar, maar klikken wordt geblokkeerd omdat er al een rating is.

**Acceptance Scenarios**:

1. **Given** een gebruiker heeft al feedback gegeven op een gesprek, **When** de gebruiker het gesprek opnieuw opent, **Then** zijn de duimpjes zichtbaar maar klikken erop resulteert niet in een nieuwe opslag (één rating per gebruiker per gesprek)

---

### Edge Cases

- Wat gebeurt er als een gebruiker nog geen assistant-antwoord heeft ontvangen? De duimpjes zijn niet zichtbaar — ze verschijnen pas na het eerste assistant-antwoord.
- Wat gebeurt er als de opslag faalt (netwerkfout)? De UI toont een foutmelding en de rating blijft onopgeslagen. Gebruiker kan opnieuw proberen.
- Wat als een gebruiker duimpje omlaag klikt maar geen feedbacktekst invult? Feedbacktekst is verplicht bij duimpje omlaag — de verstuurknop blijft disabled totdat er minimaal 1 teken is ingevuld.
- Wat als een gebruiker tussen duimpje omhoog en omlaag wisselt zonder te bevestigen? Klikken op het andere duimpje annuleert de huidige keuze (als er nog geen opslag heeft plaatsgevonden).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: De chatvenster toont een duimpje-omhoog en duimpje-omlaag knop onder de berichtenlijst en boven het invoerveld
- **FR-002**: De duimpjes verschijnen pas nadat er minimaal één assistant-antwoord in het gesprek is
- **FR-003**: Bij klikken op duimpje omhoog wordt de rating direct opgeslagen (geen extra bevestiging)
- **FR-004**: Bij klikken op duimpje omlaag verschijnt een tekstvak waarin de gebruiker verplicht feedback moet invullen
- **FR-005**: Het feedback-tekstvak heeft een annuleren-knop om de duimpje-omlaag actie ongedaan te maken
- **FR-006**: Bij duimpje omlaag + ingevulde feedback wordt de rating + feedbacktekst opgeslagen
- **FR-007**: Per gebruiker per gesprek kan maximaal één rating worden opgeslagen
- **FR-008**: Feedback wordt opgeslagen in een aparte tabel met velden: interaction ID, gesprek-ID, assistent-ID, gebruikers-ID, organisatie-ID, thumbs_up (boolean), feedback (tekst, optioneel), aangemaakt-op
- **FR-009**: Na succesvolle opslag muteren de duimpjes naar een bevestigde staat (geslaagde actie visueel weergegeven)
- **FR-010**: Bij heropenen van een gesprek waarvoor al feedback is gegeven, worden de duimpjes getoond maar klikken wordt geblokkeerd
- **FR-011**: Bij een opslagfout blijft de UI staat behouden en kan de gebruiker opnieuw proberen

### Key Entities *(include if feature involves data)*

- **Feedback Interaction**: Een eenmalige rating per gebruiker per gesprek. Bevat een interaction ID, verwijzing naar het gesprek, de assistent, de gebruiker en de organisatie. Legt vast of de rating positief (thumbs_up) was, en optioneel een feedbacktekst bij negatieve ratings. Wordt opgeslagen met een timestamp.
- **Conversation**: Bestaande entiteit. Een feedback interaction is gekoppeld aan precies één gesprek. Een gesprek kan 0 of 1 feedback interaction per gebruiker hebben.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Gebruikers kunnen positieve feedback geven in 1 klik (duimpje omhoog)
- **SC-002**: Gebruikers kunnen negatieve feedback met toelichting geven in maximaal 3 stappen (duimpje omlaag → tekst invullen → versturen)
- **SC-003**: Feedback wordt binnen 2 seconden na klikken opgeslagen en visueel bevestigd
- **SC-004**: 100% van de feedback interacties wordt correct weggeschreven naar de database
- **SC-005**: Geen dubbele ratings per gebruiker per gesprek mogelijk

## Assumptions

- Feedback is per gesprek, niet per individueel bericht — één rating voor de hele conversatie per gebruiker
- Eenmaal opgeslagen feedback kan niet gewijzigd of verwijderd worden door de gebruiker
- De database-tabel wordt aangemaakt via een Supabase migratie (nieuwe `feedback_interactions` tabel)
- RLS wordt ingesteld op de nieuwe tabel: gebruikers mogen alleen hun eigen feedback lezen en aanmaken, admins mogen alle feedback inzien
- De webhook-call (`callRagWebhook`) in de bestaande chatcode blijft ongewijzigd — feedback is een aanvulling op de bestaande flow
- De `conversation_id` is aanwezig in de chat-state en kan gebruikt worden als koppeling naar de feedback
