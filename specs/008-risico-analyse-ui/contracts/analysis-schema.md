# Contract: analysis JSON schema (zod)

**Feature**: 008-risico-analyse-ui | **Datum**: 2026-10-09

Zod-schema's leven in `src/lib/analysis-schemas.ts`; de mock server en
latere Edge Function valideren met hetzelfde patroon (single source of
truth = dit contract).

## AnalysisResultSchema

```ts
import { z } from 'zod'

export const BronRefIdSchema = z.string().regex(/^[KRA][0-9]+$/)
// K = kennisbron-document, R = regelgeving, A = artikel/bijlage

export const BronRefSchema = z.object({
  id: BronRefIdSchema,
  document: z.string().min(1),
  locatie: z.string().min(1),
  passage: z.string().min(1),
})

export const OptieSchema = z.object({
  titel: z.string().min(1),
  voor: z.array(z.string().min(1)),
  tegen: z.array(z.string().min(1)),
})

export const AnalysisResultSchema = z.object({
  risicos: z.array(z.string().min(1)),
  dekking: z.string().min(1),
  restgat: z.string().min(1),
  draagkracht: z.string().min(1),
  opties: z.array(OptieSchema),
  lacunes: z.array(z.string().min(1)),
  intern_signalen: z.array(z.string().min(1)),
  bronnen: z.array(BronRefSchema),
})

export const RunStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed'])

export const RunErrorSchema = z.object({
  run_id: z.string().uuid(),
  status: z.literal('error'),
  code: z.string().min(1),
  message: z.string().min(1),
})
```

## Validatie- en foutgedrag (constitution Principe V)

- Ongeldig `AnalysisResult` (parse-fout) → run krijgt in de UI de
  expliciete foutstatus "Ongeldig resultaat ontvangen" (code
  `INVALID_RESULT_SCHEMA`); nooit een deels gerenderd resultaat.
- `bronnen`-ids dupliceren of niet aan `^[KRA][0-9]+$` voldoen →
  schema-fout (bovenstaande regel).
- Een verwijzing in `intern_markdown` die niet in `bronnen` voorkomt →
  geen schema-fout (markdown en bronnen zijn onafhankelijk), maar het
  zijpaneel toont de expliciete melding "Bron niet beschikbaar"
  (FR-012 / edge case).

## Mock fixtures (`scripts/mock-analysis-server.mjs`)

| Fixture | Doel |
|---------|------|
| rich | alle secties gevuld, 6+ bronverwijzingen (K/R/A), volledige passages → result view + zijpaneel-tests (SC-002, SC-003) |
| thin | karige analyse, veel lacunes (gaps-checklist prominent) → "assistant copes with thin input" |
| error | status `failed` met code `N8N_WORKFLOW_ERROR` + Nederlandse melding → error + retry-prefill-tests |
| slow | status `running` ≥ 2 minuten (configurable) → polling/backoff/elapsed-time-tests |

De markdown in fixtures bevat `[K1]`-achtige referenties zodat de UI ze
klikbaar kan renderen en aan het zijpaneel kan koppelen. Fixtures bevatten
geen echte klantdata.