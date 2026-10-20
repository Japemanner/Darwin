# Quality Criteria — Feature Specifications (Spec Kit)

**Domein**: specs (feature specifications via /speckit.specify)
**Gemaakt**: 2026-10-16
**Bron**: eerste toepassing bij 011-resumable-chat-page

## Evaluatie 2026-10-16 — 011-resumable-chat-page

## Output: Feature spec 011-resumable-chat-page (9 stories, FR-001 t/m FR-020, 11 succescriteria) + quality checklist
## Criteria checked:
- Volledig (geen placeholders/markers): PASS — gecontroleerd via grep; alle secties gevuld
- Toetsbaar: PASS — elke FR heeft meetbare grens (80 tekens, 15 s, max 4, exact 1 bericht)
- Wat-niet-hoe: PASS — routevorm/API alleen als aannames, niet als eis
- Acceptatiecriteria uit input: PASS — alle 5 expliciete criteria gemapt op FR's/scenario's
- Constitution I–VI: PASS — III (FR-002), IV (FR-019), V (FR-015), VI (Scope-sectie)
- Scope begrensd: PASS — buiten-scope-lijst conform input
- Nederlands voor stakeholders: PASS — zakelijk Nederlands, actors adviseur/beheerder
- Onafhankelijk testbare stories: PASS — P1-stories vormen levensvatbare MVP
- Aannames gedocumenteerd: PASS — 11 aannames, incl. 2 bewuste productkeuzes
## Score: 9/9
## Gaps: geen
## Verdict: SHIP

## Evaluatie 2026-10-19 — 012-per-answer-feedback

## Output: Feature spec 012-per-answer-feedback (5 stories, FR-001 t/m FR-012, 7 succescriteria) + quality checklist
## Criteria checked:
- Volledig (geen placeholders/markers): PASS — grep-controle leeg; alle verplichte secties + Scope-sectie gevuld
- Toetsbaar: PASS — exacte aantallen (5 redenen, max 1 oordeel, 100% van nieuwe antwoorden), expliciete UI-toestanden (actieve duim, aria-pressed)
- Wat-niet-hoe: PASS — RLS/aria-pressed/databasefunctie komen uitsluitend uit de eigen input van de opdrachtgever (getraceerd in checklist Notes); geen frameworks/talen in eisen
- Acceptatiecriteria uit input: PASS — alle 5 expliciete criteria gemapt (FR-005/SC-003, FR-007/SC-006, FR-009, FR-011/SC-005, FR-012/SC-007); alle 5 user stories overgenomen met originele prioriteit
- Constitution I–VI: PASS — I (u-vorm, aanname), II (CONCEPT ongewijzigd, aanname), III (geen inhoud in adressen/logs, aanname), IV (FR-012/SC-007), V (FR-008 + edge case), VI (Scope-sectie, 5 buiten-scope-items)
- Scope begrensd: PASS — buiten-scope-lijst conform input plus 2 gemotiveerde afbakeningen (geen UI-weergave van metadata, geen migratie van oude feedback)
- Nederlands voor stakeholders: PASS — zakelijk Nederlands, actors adviseur/beheerder herkenbaar
- Onafhankelijk testbare stories: PASS — P1-stories vormen levensvatbare MVP; P2's (data-vastlegging, beheerdersoverzicht) elk zelfstandig testbaar
- Aannames gedocumenteerd: PASS — 12 aannames, incl. interpretatie van story 4 (opslag bij het antwoord, geen UI-weergave) en opname van herschreven zoekvraag + responstijd in het overzicht
## Score: 9/9
## Gaps: geen
## Verdict: SHIP

## Wat is een goede spec in dit project?

1. **Volledig**: alle verplichte template-secties gevuld, geen placeholders, geen [NEEDS CLARIFICATION].
2. **Toetsbaar**: elke functionele eis is concreet verifieerbaar (aantallen, tekens, seconden, zichtbare UI-toestanden).
3. **Wat, niet hoe**: geen frameworks, talen of API-details in eisen en succescriteria; implementatiekeuzes staan als aannames gemarkeerd.
4. **Acceptatiecriteria verwerkt**: álle expliciete acceptatiecriteria uit de input zijn gedekt door FR's, scenario's of edge cases.
5. **Constitution-veilig**: adressen/gegevens (III), toetsenbord/WCAG (IV), geen stille fouten (V), geen scope-creep (VI) zijn expliciet meegenomen.
6. **Scope begrensd**: buiten-scope-lijst aanwezig; geen ongevraagde features in de eisen.
7. **Nederlands voor stakeholders**: inhoud in zakelijk Nederlands; de actor (adviseur/beheerder) is herkenbaar.
8. **Onafhankelijk testbare stories**: elke story heeft priority, eigen test en Given/When/Then-scenario's; P1 vormt zonder P2/P3 een levensvatbaar product.
9. **Aannames gedocumenteerd**: bewuste productkeuzes staan expliciet in Assumptions zodat clarify/plan ze kan bijstellen.