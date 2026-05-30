# Feature Specification: RAG Assistant Management

**Feature Branch**: `002-rag-assistant-management`

**Created**: 2026-05-30

**Status**: Draft

**Input**: Build a generic AI assistant management system with RAG (Retrieval Augmented Generation) support via N8N webhooks.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Chat Assistant Aanmaken en Gebruiken (Priority: P1)

Een gebruiker wil een chat assistant configureren die vragen beantwoordt op basis van eigen documenten. De gebruiker maakt een assistant aan, koppelt deze aan een of meer kennisbronnen (knowledge bases), stelt een system prompt in, en start een gesprek. De assistant haalt relevante informatie uit de gekoppelde kennisbronnen en geeft een antwoord met bronverwijzingen.

**Why this priority**: Dit is de core value proposition — zonder deze flow is er geen product.

**Independent Test**: Kan volledig getest worden door een assistant aan te maken met een gekoppelde kennisbron en er een vraag aan te stellen. Levert direct waarde als minimale chat-ervaring.

**Acceptance Scenarios**:

1. **Given** een gebruiker is ingelogd, **When** de gebruiker een assistant aanmaakt met naam, system prompt en 2 kennisbronnen, **Then** de assistant verschijnt in de lijst en is beschikbaar voor chat.
2. **Given** een assistant met 2 gekoppelde kennisbronnen met geembeddde documenten, **When** de gebruiker een vraag stelt in de chat, **Then** de gebruiker ontvangt een antwoord met bronverwijzingen (titel, excerpt, relevance score) binnen 10 seconden.
3. **Given** een lopend gesprek met 5 eerdere berichten, **When** de gebruiker een vervolgvraag stelt die context uit eerdere berichten nodig heeft, **Then** de assistant begrijpt de context en geeft een relevant antwoord.

---

### User Story 2 — Kennisbronnen en Kennisitems Beheren (Priority: P1)

Een gebruiker wil documenten en kennis uploaden naar kennisbronnen, zodat deze doorzoekbaar worden voor de assistant. De gebruiker kan kennisbronnen aanmaken, documenten toevoegen (met titel, content, optionele source URL), en de embedding status monitoren.

**Why this priority**: Zonder gevulde kennisbronnen kan de RAG-flow niets ophalen — essentiële voorwaarde voor de core flow.

**Independent Test**: Kan getest worden door een kennisbron aan te maken, 3 documenten toe te voegen, en te verifiëren dat de embedding status van "pending" naar "done" gaat.

**Acceptance Scenarios**:

1. **Given** een gebruiker is ingelogd, **When** de gebruiker een kennisbron aanmaakt met naam, beschrijving en een vector collection ID, **Then** de kennisbron verschijnt in de lijst.
2. **Given** een bestaande kennisbron, **When** de gebruiker een document toevoegt met titel en content, **Then** het kennisitem verschijnt met status "pending" en wordt asynchroon verwerkt naar "done".
3. **Given** een kennisitem met status "failed", **When** de gebruiker de lijst bekijkt, **Then** de foutstatus is zichtbaar en de gebruiker kan het item opnieuw indienen of verwijderen.

---

### User Story 3 — Gesprekshistorie Bekijken en Hergebruiken (Priority: P2)

Een gebruiker wil eerdere gesprekken terugzien en voortzetten. De gebruiker kan een lijst van gesprekken per assistant bekijken, een gesprek openen, en de volledige berichtengeschiedenis zien met gebruikersvragen, assistant antwoorden en bronverwijzingen.

**Why this priority**: Gesprekshistorie biedt herbruikbaarheid en contextbehoud, maar het systeem is bruikbaar zonder (steeds nieuw gesprek starten).

**Independent Test**: Kan getest worden door 3 gesprekken te voeren, terug te navigeren naar de lijst, en een eerder gesprek te openen met alle berichten intact.

**Acceptance Scenarios**:

1. **Given** een assistant met 3 gesprekken, **When** de gebruiker de gesprekslijst opent, **Then** de 3 gesprekken worden getoond met aanmaakdatum.
2. **Given** een gesprek met 10 berichten, **When** de gebruiker het gesprek opent, **Then** alle 10 berichten worden chronologisch getoond met rol (user/assistant), content en eventuele bronnen.

---

### User Story 4 — FlowConfig Instellen als Beheerder (Priority: P2)

Een beheerder wil de N8N webhook configuratie centraal beheren. Een configuratie per flow type (bijv. "rag_chat") geldt voor alle assistants. De webhook token wordt versleuteld opgeslagen en nooit blootgesteld in API responses.

**Why this priority**: Zonder deze configuratie werken de webhook calls niet. Het is een eenmalige setup die technisch voor de core flow komt, maar als aparte beheerder-actie wordt uitgevoerd.

**Independent Test**: Kan getest worden door als admin de FlowConfig in te stellen en te verifiëren dat de webhook token niet in GET responses verschijnt.

**Acceptance Scenarios**:

1. **Given** een beheerder is ingelogd, **When** de beheerder een FlowConfig instelt voor type "rag_chat" met webhook URL en token, **Then** de configuratie wordt opgeslagen en bij GET requests wordt het token niet teruggegeven.
2. **Given** een bestaande FlowConfig voor "rag_chat", **When** de beheerder de URL en token wijzigt, **Then** alle nieuwe chat requests gebruiken de nieuwe configuratie.

---

### User Story 5 — Bronnen Weergeven bij Antwoord (Priority: P3)

Wanneer een assistant een antwoord geeft op basis van kennisbronnen, wil de gebruiker kunnen zien welke documenten zijn gebruikt. Bronverwijzingen worden onder het antwoord getoond in een uitklapbare sectie, met titel, excerpt en relevantie score.

**Why this priority**: Bronverwijzingen verhogen vertrouwen en transparantie, maar de core chat-ervaring werkt ook zonder zichtbare bronnen.

**Independent Test**: Kan getest worden door een vraag te stellen die raakt aan 2+ documenten, en te verifiëren dat de bronverwijzingen correct en uitklapbaar zijn.

**Acceptance Scenarios**:

1. **Given** een assistant antwoord met sources-array, **When** het antwoord wordt weergegeven, **Then** onder het antwoord staat een uitklapbare "Bronnen (3)" sectie.
2. **Given** de bronnensectie is ingeklapt, **When** de gebruiker erop klikt, **Then** alle bronverwijzingen worden getoond met titel, excerpt en score.
3. **Given** een assistant antwoord zonder sources, **When** het antwoord wordt weergegeven, **Then** er wordt geen bronnensectie getoond.

---

### Edge Cases

- **Webhook timeout**: Wanneer N8N niet binnen 30 seconden reageert, krijgt de gebruiker een foutmelding en kan het bericht opnieuw verstuurd worden.
- **Lege kennisbron**: Wanneer een assistant gekoppeld is aan een kennisbron zonder documenten, antwoordt de assistant op basis van alleen de system prompt (geen RAG-context).
- **Embedding status "failed"**: Kennisitems die falen bij embedding worden gemarkeerd als "failed" — de gebruiker ziet dit en kan handmatig opnieuw indienen.
- **Concurrent gesprekken**: Meerdere gebruikers kunnen tegelijkertijd chatten met dezelfde assistant — elk gesprek is geïsoleerd via eigen conversation ID.
- **Webhook token rotatie**: Wanneer een beheerder de webhook token wijzigt, worden lopende gesprekken niet onderbroken — volgende berichten gebruiken de nieuwe token.
- **Grote gesprekshistorie**: Bij 50+ berichten in een gesprek wordt de historie getrunceerd naar de laatste 20 berichten bij het versturen naar N8N, om payload size te beperken.
- **Verwijderde kennisbron**: Als een kennisbron wordt verwijderd terwijl een assistant deze nog in knowledge_base_ids heeft, toont de assistant-configuratie een waarschuwing.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Systeem MOET gebruikers toestaan chat assistants aan te maken met een naam, type ("chat"), system prompt, en koppeling aan een of meer kennisbronnen.
- **FR-002**: Systeem MOET gebruikers toestaan kennisbronnen (kennisbron) aan te maken met naam, beschrijving en vector collection ID.
- **FR-003**: Systeem MOET gebruikers toestaan kennisitems toe te voegen aan een kennisbron, met titel, content, en optionele source URL.
- **FR-004**: Systeem MOET de embedding status van kennisitems bijhouden: "pending", "processing", "done", "failed".
- **FR-005**: Systeem MOET per chat bericht een POST-request sturen naar de geconfigureerde N8N webhook met het volledige payload formaat (assistant info, kennisbronnen, gesprekshistorie, user message).
- **FR-006**: Systeem MOET de webhook call authenticeren met de opgeslagen Bearer token.
- **FR-007**: Systeem MOET het N8N antwoord (answer + sources) opslaan als assistant message in de database.
- **FR-008**: Systeem MOET de webhook token versleuteld opslaan en deze NOOIT retourneren in API responses.
- **FR-009**: Systeem MOET een globale FlowConfig per flow_type opslaan (niet per assistant) — te beheren via een settings pagina.
- **FR-010**: Systeem MOET gesprekshistorie per conversation bijhouden, met berichten in chronologische volgorde.
- **FR-011**: Systeem MOET een laadindicator tonen tijdens het wachten op het N8N antwoord.
- **FR-012**: Systeem MOET bronverwijzingen onder assistant antwoorden tonen in een uitklapbare sectie, wanneer sources aanwezig zijn in de N8N response.
- **FR-013**: Systeem MOET bij gesprekshistorie > 20 berichten alleen de laatste 20 naar N8N sturen.
- **FR-014**: Systeem MOET een foutmelding tonen als de webhook niet binnen 30 seconden reageert.
- **FR-015**: Systeem MOET het type-veld op Assistant en flow_type op FlowConfig ontwerpen als enums, uitbreidbaar zonder code-wijzigingen.

### Key Entities *(include if feature involves data)*

- **Assistant**: Chat configuratie — naam, type (enum), system prompt, gekoppelde kennisbronnen. Een assistant kan meerdere gesprekken hebben.
- **KnowledgeBase (Kennisbron)**: Container voor documenten — naam, beschrijving, vector collection ID (koppelt aan externe vector store). Bevat meerdere kennisitems.
- **KnowledgeItem (Kennis)**: Individueel document — titel, content, source URL, embedding status. Behoort tot een kennisbron.
- **FlowConfig**: Globale webhook configuratie per flow type — webhook URL, versleutelde token. Geldt voor alle assistants van dat type.
- **Conversation**: Gesprek tussen gebruiker en een assistant — bevat chronologische berichten.
- **Message**: Enkel bericht — rol (user/assistant), content, optionele sources (JSON). Behoort tot een gesprek.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Gebruikers kunnen binnen 2 minuten een werkende chat assistant configureren (aanmaken assistant, kennisbron koppelen, eerste vraag stellen).
- **SC-002**: Chat antwoorden met RAG verschijnen binnen 10 seconden na het versturen van een vraag bij normale belasting.
- **SC-003**: 95% van de webhook calls naar N8N resulteren in een geldig antwoord (of duidelijke foutmelding) — geen stille failures.
- **SC-004**: Gebruikers kunnen gesprekshistorie van minstens 50 berichten per gesprek probleemloos terugzien.
- **SC-005**: Beheerders kunnen de FlowConfig in maximaal 1 formulier per flow_type configureren.
- **SC-006**: Webhook tokens zijn in geen enkele API response zichtbaar — 100% afscherming.

## Assumptions

1. **N8N webhook is vooraf geconfigureerd**: De N8N webhook die het RAG-flow afhandelt (vector retrieval + LLM call) bestaat al en is getest. Het systeem stuurt alleen requests en verwerkt responses.
2. **Vector database is extern beheerd**: Embedding en opslag in de vector database (pgvector, Pinecone, Qdrant, etc.) gebeurt buiten dit systeem. Dit systeem slaat alleen metadata op en verwijst naar collections via `vector_collection_id`.
3. **Authenticatie is herbruikbaar**: Er is een bestaand authenticatiesysteem (Supabase Auth of vergelijkbaar) dat wordt hergebruikt. Dit feature spec definieert geen nieuwe auth flows.
4. **Beheerder-rol**: De FlowConfig settings pagina is alleen toegankelijk voor gebruikers met een admin/beheerder rol. Rollenbeheer valt buiten scope van deze feature.
5. **Single-tenant**: Het systeem gaat uit van een organisatie. Multi-tenancy (isolatie per organisatie) is out-of-scope voor v1.
6. **Embedding verwerking is asynchroon**: Kennisitems worden door een extern proces (N8N webhook of background job) embedded. Dit systeem beheert alleen de status en triggert de verwerking.
7. **Standaard timeout**: 30 seconden timeout op N8N webhook calls is een redelijke default voor een LLM + RAG pipeline.
8. **Webhook token encryptie**: Versleuteling van de token gebeurt via omgevingsvariabelen of AES-256 — het systeem ontsleutelt de token alleen server-side bij het uitvoeren van de webhook call.
