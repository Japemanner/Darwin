# Quickstart: Risico-analyse UI (mock-first)

**Feature**: 008-risico-analyse-ui | **Datum**: 2026-10-09

## Voorwaarden

- Node 20+, bestaand Darwin frontend (`npm install` al gedaan)
- Supabase-config in `.env.local` (auth/kennisbronnen draaien op het echte
  Supabase-project; alleen de run-flow loopt tegen de mock)

## Draaien

```bash
# 1. Start de mock analysis server (poort 4010)
node scripts/mock-analysis-server.mjs

# 2. Zet in .env.local (niet committen — staat al in .gitignore):
VITE_ANALYSIS_API_URL=http://localhost:4010

# 3. Start de frontend
npm run dev
```

## Uittesten (handmatig, happy path)

1. Log in als adviseur (bestaand account).
2. Ga naar **Assistenten** → maak (of gebruik) een assistent van type
   `risico_analyse` met minstens één kennisbron gekoppeld.
3. Klik **Risico-analyse starten** → formulier opent.
4. Vul: Verzekeringsvraagstuk, minstens één Kennisbron, Klantreferentie
   en één van Klantsituatie/Bestanden/URL's → **Start analyse**.
5. Run-kaart toont "in wachtrij" → "bezig" met verstreken tijd; navigeer
   gerust weg en terug.
6. Bij "klaar": resultaatweergave — checklist "Ontbrekende informatie
   voor het gesprek", de vijf analyse-secties (interne signalen gemarkeerd
   "intern, speculatief"), klikbare bronverwijzingen met zijpaneel,
   .docx-download (CONCEPT-label) en kopieerknop.
7. Mock-scenario's forceren: `?scenario=rich|thin|error|slow` bij de
   run-submit of via `MOCK_SCENARIO`-env in de mock server — error toont
   de foutcode + "Opnieuw" met vooraf gevuld formulier.

## Playwright-tests

```bash
# mock server moet draaien; tests gebruiken deterministische tijdlijnen
npx playwright test tests/e2e/analysis-ui.spec.ts
```

Dekking: formuliergroepsvalidatie, statusovergangen, bronpaneelresolutie,
error + retry-prefill (conform plan).