# Tasks: Kennisbron Documenten — Darwin↔N8N Integratie

**Input**: Design documents from `/specs/001-knowledge-source-documents/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Geen test-tasks — tests niet expliciet aangevraagd in spec. Worden na implementatie via Playwright MCP toegevoegd per AGENTS.md workflow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Geen setup nodig — alle infrastructuur (Supabase client, Storage bucket, DB schema, page component) bestaat al. De feature is een pure applicatielogica-wijziging op twee bestaande bestanden.

**Checkpoint**: Foundation ready — direct door naar user stories.

---

## Phase 2: User Story 1 — Document uploaden naar kennisbron (Priority: P1) 🎯 MVP

**Goal**: Bij upload wordt een gesigneerde download URL (15 min) gegenereerd en verstuurd naar N8N met correcte payload `{ tenant_id, document_name, document_type, download_url }`. Bestandstype validatie voorkomt uploads van niet-toegestane typen.

**Independent Test**: Upload een PDF, check in browser console/network dat webhook POST juiste payload bevat, controleer dat `download_url` een `/sign/` path en `?token=` parameter heeft.

### Implementation for User Story 1

- [ ] T001 [P] [US1] Breid `uploadDocument` uit in `src/lib/storage.ts`: voeg `createSignedUrl(filePath, 900)` toe na upload, retourneer `{ document, signedUrl }`
- [ ] T002 [P] [US1] Voeg webhook call toe in `src/lib/storage.ts` binnen `uploadDocument`: POST naar `VITE_N8N_DOCUMENT_WEBHOOK` met payload `{ tenant_id, document_name, document_type, download_url }`, fire-and-forget met silent error handling
- [ ] T003 [P] [US1] Voeg constante `ALLOWED_EXTENSIONS` en `isValidFileType()` validatie toe in `src/pages/KnowledgePage.tsx`
- [ ] T004 [US1] Pas `handleUpload` aan in `src/pages/KnowledgePage.tsx`: voeg bestandstype validatie toe vóór `uploadDocument` call, toon foutmelding bij ongeldig type, verwijder inline webhook call (verplaatst naar storage.ts)

**Checkpoint**: Upload werkt — gesigneerde URL gegenereerd, webhook met 4-velden payload verstuurd, ongeldige bestandstypen geweigerd.

---

## Phase 3: User Story 2 — Document verwijderen (Priority: P2)

**Goal**: Document verwijderen werkt correct — bestand uit Storage én record uit DB. Bestaande code in `src/lib/storage.ts` (`deleteDocument`) is al correct — geen wijzigingen nodig.

**Independent Test**: Verwijder een document, controleer dat het verdwijnt uit de lijst en toast "Document verwijderd" verschijnt.

### Implementation for User Story 2

- [ ] T005 [US2] Verifieer `deleteDocument` in `src/lib/storage.ts` — bestaande implementatie is correct en dekt FR-004, geen code-wijzigingen nodig

**Checkpoint**: Verwijder-flow geverifieerd — bestaande code voldoet.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Verificatie dat alles compileert en quickstart validatie slaagt.

- [ ] T006 Run `tsc --noEmit` ter verificatie van TypeScript compilatie
- [ ] T007 Valideer tegen quickstart.md: handmatige test upload + delete + ongeldig bestandstype

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: Bestaand — direct door
- **User Story 1 (Phase 2)**: Geen dependencies — kan direct starten
  - T001 en T002 en T003 zijn onafhankelijk [P] — verschillende bestanden
  - T004 integreert de wijzigingen van T001+T002+T003
- **User Story 2 (Phase 3)**: T005 is verificatie-only, parallel met US1
- **Polish (Phase 4)**: Na US1 + US2

### User Story Dependencies

- **User Story 1 (P1)**: Geen dependencies
- **User Story 2 (P2)**: Geen dependencies op US1 — onafhankelijk

### Parallel Opportunities

- T001, T002, T003 kunnen parallel (verschillende bestanden)
- US1 en US2 kunnen parallel (onafhankelijk van elkaar)

---

## Parallel Example: User Story 1

```bash
# Parallel: T001 en T002 zitten in hetzelfde bestand (storage.ts) — sequentieel
# Parallel: T003 staat los van T001/T002 (KnowledgePage.tsx) — kan parallel

Task T001 + T002: "Breid uploadDocument uit in src/lib/storage.ts" (sequentieel, zelfde file)
Task T003: "Voeg bestandstype validatie toe in src/pages/KnowledgePage.tsx" (parallel met T001/T002)
Task T004: "Integreer in handleUpload in src/pages/KnowledgePage.tsx" (na T001+T002+T003)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 → T002 → T003 → T004 (implementatie US1)
2. T006 → T007 (verificatie)
3. **STOP and VALIDATE**: Upload werkt, webhook payload correct

### Incremental Delivery

1. User Story 1 → core functionaliteit (MVP!)
2. User Story 2 → verificatie van bestaande delete-flow
3. Polish → compile check + quickstart validatie
