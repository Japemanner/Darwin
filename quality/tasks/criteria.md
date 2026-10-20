# Quality Criteria — Task Lists (Spec Kit)

**Domein**: tasks (taakgeneratie via /speckit.tasks)
**Gemaakt**: 2026-10-19
**Bron**: eerste toepassing bij 012-per-answer-feedback; afgeleid van het 011-takenbestand en de tasks-template-regels

## Evaluatie 2026-10-19 — 012-per-answer-feedback

## Output: tasks.md (19 taken, 8 fasen: setup, foundational, US1-US5, polish)
## Criteria checked:
- Format: PASS — elke taak `- [ ] TXXX [P?] [Story?]` met bestandspad; story-fasen gelabeld [US1]-[US5], setup/foundational/polish zonder label (template-regels exact gevolgd)
- Story-organisatie: PASS — 5 story-fasen in prioriteitsvolgorde, elk met goal, independent test en checkpoint; US5 als verificatietaak na uitrol (011 T025-patroon, functie server-side foundational)
- Uitvoerbaarheid: PASS — elke taak verwijst naar concrete paragrafen (data-model §, contracts §, research #, FR-nummers, bestandsregels/patronen); een LLM kan zonder extra context aan de slag
- Volledigheid: PASS — alle 4 route-items gedekt (migratie T002/T017, rag-chat T013/T018, frontend T005-T008, tests T004/T009/T011+groen in T017); FR-001 t/m FR-012 traceerbaar; tests-first per story; DoD-fase aanwezig; randvoorwaarden expliciet (geen nieuwe deps, MCP-bevestiging, geen testmigratie nodig met onderbouwing)
- Dependencies: PASS — fasedenkwoud, binnen-story volgorde en [P]-parallellisme consistent met plan.md/research.md; real-DB-testvolgorde (migratie vóór answer-feedback-spec) expliciet gemaakt in T016/T017
- Huisstijl: PASS — zakelijk Nederlands, Engelse identifiers/paden, handmatige productiestappen als verificatietaken gemarkeerd (niet als codetaak vermomd), constitution-verwijzingen op de juiste plekken
## Score: 6/6
## Gaps: geen
## Verdict: SHIP

## Wat is een goede takenlijst in dit project?

1. **Format**: elke taak volgt exact `- [ ] TXXX [P?] [Story?] Beschrijving met bestandspad`;
   story-fasen hebben een story-label, setup/foundational/polish-fasen niet; ID's zijn
   doorlopend genummerd in uitvoervolgorde.
2. **Story-organisatie**: één fase per user story in prioriteitsvolgorde, elk met goal,
   independent test en checkpoint; server-side werk dat meerdere stories dient ligt in
   de foundational-fase; verificatie-only stories krijgen een expliciete
   verificatietaak na uitrol (niet stilletjes samengevoegd).
3. **Uitvoerbaarheid**: elke taak is zelfdragend — verwijst naar de juiste paragrafen
   in research/data-model/contracts en noemt concrete bestanden, patronen en
   regelnummers; een implementerende agent heeft geen extra context nodig.
4. **Volledigheid**: alle route-items en FR's zijn gedekt; tests staan per story vóór
   de implementatie (FAIL-first) wanneer tests gevraagd zijn; de Definition of Done
   (tsc/eslint/build/suite groen) is een eigen fase; productiestappen (migratie,
   deploys) zijn expliciet als handmatige stappen met bevestiging gemarkeerd.
5. **Dependencies**: fasedenkwoud, binnen-story volgorde en [P]-parallellisme staan
   expliciet en zijn consistent met plan.md en research.md; conflicterende
   bestandsmutaties worden niet als parallel gemarkeerd.
6. **Huisstijl**: zakelijk Nederlands voor de opdrachtgever, Engels voor
   identifiers en paden; constitution-punten (III/V) staan waar ze gelden; de lijst
   verwijst naar het 011-patroon waar dat hergebruikt wordt.