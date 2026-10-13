# Analyse: 009-secure-n8n-proxy

**Date**: 2026-10-13 | **Fase**: /speckit.analyze (cross-domein review)
**Input**: volledige artefactenset (spec, plan, research, data-model, contracts, quickstart, tasks) + codebasis
**Reviews**: 1) adversariële securityreview van het ontwerp; 2) consistentie- en volledigheidsreview (traceerbaarheid FR/SC → taken, contracten ↔ taken, plan ↔ realiteit)

## Bevindingen en oplossing

Alle CRITICAL/HIGH-bevindingen zijn vóór implementatie opgelost in de
artefacten. MEDIUM/LOW-bevindingen zijn in dezelfde pass meegenomen;
rest-risico's zijn expliciet gedocumenteerd en geaccepteerd.

### HIGH (3, alle opgelost)

| # | Bevinding | Oplossing |
|---|-----------|-----------|
| H1 | **flow_configs UPDATE-policy mist `WITH CHECK`** — een beheerder kan een config-rij naar een andere organisatie verhuizen en zo diens chatverkeer naar een eigen webhook leiden (verslaat FR-002/FR-003). | Migratie 014 hercreëert de policy mét `WITH CHECK` (data-model.md; T001). |
| H2 | **WCVG-foute premise + ontbrekende taak**: toast.tsx heeft geen `role`/`aria-live`; FR-009 eist toegankelijke foutmeldingen en geen enkele taak raakte het component. | Nieuwe taak T019: `role="status"`/`aria-live` in `src/components/ui/toast.tsx` (assertive voor destructive). |
| H3 | **Delete-melding blijft onzichtbaar**: `KnowledgePage.handleDeleteDoc` vangt leeg af en toont alleen "Fout bij verwijderen" — de NL-melding + code uit T008 zou never verschijnen (FR-009/US2-3). | T008 uitgebreid: `catch (err)` en `err.message` als toast-beschrijving; KnowledgePage toegevoegd aan plan-boom. |

### MEDIUM (11, alle opgelost in artefacten)

| # | Bevinding | Oplossing |
|---|-----------|-----------|
| M1 | SSRF: de "admin-only" premise klopt niet — members kunnen `n8n_webhook_url` zetten (assistants zijn lid-wijzigbaar); een admin kon bij `test` met een nieuwe URL het opgeslagen token naar een eigen host laten sturen. | Server-side URL-guard (https, geen letterlijk IP/localhost/link-local) in alle contracten; **test-tokenregel**: afwijkende URL + leeg tokenveld → weigering met NL-melding (contracts/flow-config.md; T003/T007/T010). |
| M2 | rag-chat liet de type-branching vallen (`chat` → org-config; `agent`/`voice` → per-assistent URL): agent/voice-assistenten zouden ineens de org-config mét token gebruiken. | Exacte poort van `webhook.ts:218-238` in contracts/rag-chat.md + T003. |
| M3 | Cutover-venster verkeerd gedocumenteerd (chat breekt bij stap 3, niet 4) + wipe-migratie wist ook vóór stap 4 opgeslagen nieuwe tokens. | quickstart.md: venster is stap 3–5, expliciete waarschuwing bij stap 4 (token-invoer pas ná de migratie), notitie over oude browsertabs. |
| M4 | CORS faalt niet gedefinieerd; het huispatroon is wildcard. | Fail-closed CORS-sectie in alle drie de contracten + taken (geen ACAO-header bij ongeconfigureerde/niet-matchende Origin; nooit `*`). |
| M5 | SC-001-grep op de naam `VITE_ENCRYPTION_KEY` is waardeloos — Vite inline't de waarde. | quickstart grep't de **oude sleutelwaarde** + `crypto.subtle`; F-18 verbreed naar `crypto.subtle.` (dekt ook encrypt/importKey). |
| M6 | PostgREST-gedrag bij kolom-grants onzeker (weglaten vs. 42501); `useSaveFlowConfig` deed een unqualified `.select().single()` die post-migratie faalt. | Beide hooks verwijderd (T012/T013; enige consumer SettingsPage) — er resteert geen `flow_configs`-query in de frontend; data-model/quickstart-tekst herwoord. |
| M7 | `SC-003`-foutmatrix onvolledig gedekt (UPSTREAM_ERROR/UPSTREAM_UNREACHABLE en ongeldig antwoord ontbraken; US4-2 (401) ontestbaar tegen de mock). | T002: alle zeven codes + ongeldig-body-geval; T014: gemockte 401-variant; T006: delete-succes + -faal gevallen. |
| M8 | SC-005 ("zoekstap vindt niets is opgelost") was onwaarmaakbaar zonder de n8n-wijziging N1 en had geen enkele verificatiestap. | SC-005 herwoord naar het Darwin-deel (lijst gestuurd, payload-controle in quickstart §6); N1-afhankelijkheid expliciet als buiten scope. |
| M9 | SC-004 beloofde een geautomatiseerde test die geen taak leverde (onmogelijk vóór de rollout). | SC-004 herwoord: REST-controle uit quickstart.md, na rollout, scriptbaar. |
| M10 | Niet-beheerders kregen na T010 een 403 zonder gespecificeerde UX. | T012: UI-gate `profile.role === 'admin'` met NL-melding; T009(h). |
| M11 | Nieuwe e2e's schreven echte data (gesprekken, uploads) naar het productieproject. | T002 vangt `conversations`/`messages`-REST af; T006 mockt storage- en document-REST. |

### LOW / INFO (weggewerkt of geaccepteerd)

- Stale "30 seconden"-restant in de spec-aanname → gecorrigeerd naar 60 s.
- Ghost-document (n8n-delete geslaagd, lokale delete faalt) → herstelpad gedocumenteerd in contracts/document-webhook.md (opnieuw verwijderen; n8n-delete is idempotent).
- `get` zonder bestaande configuratie ongedefinieerd → 200 met lege strings + `has_token: false` (contract + T009(b)).
- `VALIDATION`-code zonder NL-tekst → toegevoegd aan contracts/flow-config.md + T010/T011.
- `WebhookTestResult`-type-import vergeten in de verwijdertaken → T012 (client-type) + T016 (grep-lijst).
- Toast-titelheuristiek verouderd → T005 mapt titels op `RagClientError.code`.
- Fallback-generalisatie (geen config-rij → per-assistent URL) bewust gemaakt als kleine, gunstige uitbreiding (contracts/rag-chat.md).
- Organisatie-herleiding expliciet vastgepind op het `profiles`-record van `auth.uid()` (alle contracten + taken) — nooit body/user-metadata.
- Berichtlengte-cap 10.000 tekens toegevoegd (contracts/rag-chat.md + T003).
- Rest-risico geaccepteerd en gedocumenteerd: de token-loze per-assistent fallback-URL blijft rechtstreeks bij n8n aanroepbaar (spec-aanname + plan-beslissing 2).

### Gecontroleerd en kloppend (geen actie)

AuthN via `getUser`; RLS-dekking van cross-tenant reads (assistants/conversations/messages/documents); admin-403 op flow-config; token-lekvrije responsvormen; wipe-mechanica (NOT NULL + DEFAULT ''); releasevolgorde; nummering (migratie 014, fitness F-18); volledige FR/SC/contract-traceerbaarheid na de correcties; analysis-jwt-test haalbaar tegen de mock; e2e-conventies.

## Verdict

**Geen CRITICAL of HIGH open.** Het ontwerp sluit het gelekte-sleutel- en tenant-beslissingsprobleem volledig af; de resterende bevindingen waren privilege-randen, documentatie-accuratesse en hardening — allemaal opgelost in de artefacten. Klaar voor implementatie.

**Volgende stap**: implementeren per tasks.md (werk fase voor fase; draai na elke fase `npx tsc --noEmit` en `npx eslint src/ --max-warnings 0`; commit per user story; geen migraties/deploys zonder expliciete bevestiging).