# Quality Criteria — Implementation Plans (Spec Kit)

**Domein**: plans (implementation planning via /speckit.plan)
**Gemaakt**: 2026-10-19
**Bron**: eerste toepassing bij 012-per-answer-feedback; afgeleid van het 011-plan en de spec-criteria

## Evaluatie 2026-10-19 — 012-per-answer-feedback

## Output: plan.md + research.md (14 beslissingen) + data-model.md + contracts/feedback-db.md + quickstart.md + AGENTS.md-context
## Criteria checked:
- Volledig: PASS — alle templatesecties gevuld incl. Constitution Check-re-check en Complexity Tracking; Phase 0/1-artefacten compleet
- Route-getrouw: PASS met noot — alle route-items uitgewerkt; 2 gemotiveerde afwijkingen (volledige unieke index i.p.v. partieel, research #1; latency_ms in functie-output, research #4), beide vermeld in gatetabel en completion report
- Constitution-check: PASS — 6 gates expliciet, re-check na Phase 1, geen violations (Complexity Tracking motiveert waarom leeg)
- Toetsbaar: PASS — volledige migratie-SQL, upsert-semantiek incl. foutgedrag (42501/42703/23514), UI-state-transities, functie-resultaatvorm, SQL-verificatieblokken in data-model.md en quickstart.md — tasks 1-op-1 afleidbaar
- Consistentie met spec: PASS — FR-001 t/m FR-012 en alle 7 SC's traceerbaar gedekt (FR-001/2/3→AnswerFeedback, FR-004/5→upsert, FR-006→query+aria-pressed, FR-007→RLS, FR-008→toast, FR-009→balkverwijdering, FR-010→rag-chat, FR-011→functie, FR-012→a11y)
- Rollout en rollback: PASS — verplichte volgorde, breekraam gedocumenteerd (research #13, quickstart §3), 8 handmatige verificatiestappen, rollback per component
- Randvoorwaarden: PASS — geen nieuwe dependencies (native radios), alleen route-benodigde bestanden, u-vorm-teksten (gate 1), geen klantinhoud buiten de feature-tabel zelf (gate 3), klaar-definitie in Technical Context
- Huisstijl: PASS — zakelijk Nederlands, Engelse identifiers/SQL, relatieve paden, verwijzingen naar 004/011-patronen en eerder gedane decisions
## Score: 8/8
## Gaps: geen
## Verdict: SHIP

## Wat is een goed plan in dit project?

1. **Volledig**: alle plan-templatesecties gevuld (Summary, Technical Context, Constitution
   Check met 6 gates + re-check na Phase 1, Project Structure docs + source,
   Complexity Tracking); Phase 0/1-artefacten compleet (research, data-model, contracts
   indien externe interfaces, quickstart).
2. **Route-getrouw**: elk item uit de technische route van de opdrachtgever is uitgewerkt;
   afwijkingen zijn expliciet, gemotiveerd (met alternatieven) en worden gemeld in het
   completion report — nooit stil geïntroduceerd.
3. **Constitution-check**: de 6 principes krijgen een status + toelichting in de gatetabel;
   na het design volgt een re-check; schendingen landen in Complexity Tracking met
   afgewezen simpeler alternatieven.
4. **Toetsbaar**: migratie-SQL, request/response- en upsert-semantiek, UI-state-transities
   en functie-outputvormen zijn zo concreet dat /speckit.tasks ze 1-op-1 kan afleiden;
   er is een SQL- of handmatig verificatiepad per onderdeel.
5. **Consistentie met de spec**: elke FR en SC is terug te voeren op een
   planonderdeel; geen eis blijft ongedekt en geen planonderdeel zweeft buiten de spec.
6. **Rollout en rollback**: verplichte releasevolgorde met argumentatie, bekende
   breekramen gedocumenteerd, handmatige verificatiestappen en rollback per component.
7. **Randvoorwaarden uit de opdracht**: geen nieuwe dependencies, alleen benodigde
   bestanden, u-vorm-teksten, constitution III-regels en de definitie van klaar zijn
   terug te vinden in het plan zelf.
8. **Huisstijl**: zakelijk Nederlands voor de opdrachtgever, Engels voor
   code/identifiers/SQL, relatieve paden in verwijzingen, hergebruik van en verwijzing
   naar bestaande patronen en eerder gedane decisions.