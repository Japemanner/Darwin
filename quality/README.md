# Quality Gates

Deze map bevat per-domein kwaliteitscriteria.

## Index

| Domein       | Pad                          | Status |
|--------------|------------------------------|--------|
| _nog te vullen_ | `/quality/<domein>/criteria.md` | —      |

## Werkmethode

Voor elke taak wordt `criteria.md` voor dat domein geëvalueerd.
Bestaat deze nog niet? Maak hem dan aan op basis van wat "goed" is voor dit project.

Evaluation format:

```
## Output: {korte beschrijving}
## Criteria checked:
  - {criterium 1}: PASS / FAIL / PARTIAL — {observatie}
  - {criterium 2}: PASS / FAIL / PARTIAL — {observatie}
## Score: {X}/{totaal}
## Gaps: {wat zou dit beter maken}
## Verdict: SHIP / REVISE / REJECT
```

Score onder drempel → revisie voor presentatie als "done".
Nieuwe kwaliteitssignalen → criteria bijwerken.