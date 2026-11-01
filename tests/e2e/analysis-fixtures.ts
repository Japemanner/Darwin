import type { Page } from '@playwright/test'

// Shared fixtures and network mocks for the risk-analysis server route (021).
// The app no longer talks to the mock analysis server: these routes intercept
// the Supabase calls the browser actually makes (Edge Function + PostgREST +
// Storage) so the UI specs stay deterministic. Server-side enforcement is
// verified manually and with rls-verify (quickstart §5).

export const RICH_RESULT = {
  risicos: [
    'Inkomensderving bij arbeidsongeschaktheid gedurende de eerste twee jaar.',
    'Waardevermindering van de woonhuis bij waterschade in de kruipruimte.',
    'Stijgende zorgkosten zonder aanvullende dekking.',
  ],
  dekking: 'Huidige polis dekt waterschade aan de constructie, maar geen inhoud in de kruipruimte.',
  restgat: 'Arbeidsongeschaktheid buiten de wettelijke tweejaarstermijn blijft volledig ongedekt.',
  draagkracht: 'Maandlasten laten circa 12% van het netto-inkomen als buffer over.',
  opties: [
    {
      titel: 'Volledige verzekering',
      voor: ['Volledige afdekking van het restgat', 'Vaste premie'],
      tegen: ['Hogere maandlasten', 'Mogelijk dubbele dekking'],
    },
    {
      titel: 'Gedeeltelijke verzekering',
      voor: ['Lagere premie', 'Risico grotendeels beperkt'],
      tegen: ['Eigen risico blijft bestaan'],
    },
  ],
  lacunes: [
    'Huidige polisnummer van de opdrachtgever',
    'Jaaropgave van de afgelopen 12 maanden',
    'Overzicht van bestaande schades uit de afgelopen 5 jaar',
  ],
  intern_signalen: [
    'Op basis van het beschikbare patroon lijkt sprake van een beperkt restgat.',
    'Interne overweging: het dossier is mogelijk geschikt voor premie-optimalisatie.',
  ],
  bronnen: [
    {
      id: 'K1',
      document: 'Polisvoorwaarden Woonhuis 2026',
      locatie: 'Artikel 4.2, pagina 12',
      passage: 'Dekking geldt uitsluitend voor schade aan de constructie, niet voor inhoud in kruipruimten.',
    },
    {
      id: 'K2',
      document: 'Kennisbank Verzekeringswijzer',
      locatie: 'Hoofdstuk 3, paragraaf 1',
      passage: 'De wettelijke tweejaarstermijn voor arbeidsongeschaktheid eindigt na 104 weken.',
    },
    {
      id: 'R1',
      document: 'Regeling zorgverzekering 2026',
      locatie: 'Artikel 2.14',
      passage: 'De basisverzekering omvat geen tandartskosten boven de leeftijd van 18 jaar.',
    },
    {
      id: 'R2',
      document: 'Regeling inkomensvoorziening',
      locatie: 'Artikel 3:5, lid 2',
      passage: 'Aanvullende dekking is niet verplicht gesteld voor zelfstandigen.',
    },
    {
      id: 'A1',
      document: 'Bijlage draagkracht berekening',
      locatie: 'Tabel 2, rij 4',
      passage: 'Een buffer van ten minste 10 procent van het netto-inkomen is gangbaar.',
    },
    {
      id: 'A2',
      document: 'Bijlage klantgesprek intake',
      locatie: 'Vraag 7',
      passage: 'De opdrachtgever heeft geen lopende schadeclaims gemeld.',
    },
  ],
}

export const RICH_MARKDOWN = `## Risico's
- Inkomensderving bij arbeidsongeschaktheid gedurende de eerste twee jaar [K2]
- Waardevermindering van de woonhuis bij waterschade in de kruipruimte [K1]
- Stijgende zorgkosten zonder aanvullende dekking [R1]

## Dekking en restgat
De huidige polis dekt waterschade aan de constructie [K1]. Arbeidsongeschaktheid buiten de wettelijke tweejaarstermijn blijft volledig ongedekt [K2].

## Draagkracht
Maandlasten laten circa 12% van het netto-inkomen als buffer over [A1].

## Opties met voor en tegen
- Volledige verzekering: volledige afdekking tegen hogere maandlasten [R2]
- Gedeeltelijke verzekering: lagere premie, eigen risico blijft bestaan
- Zelf dragen: maximale flexibiliteit, volledig eigen risico bij schade [A1]

## Interne signalen
Op basis van het beschikbare patroon lijkt sprake van een beperkt restgat [A2]. Mogelijk bestaat een verwante lopende polis elders.`

export const ERROR_CODE = 'N8N_WORKFLOW_ERROR'
export const ERROR_MESSAGE = 'De analyse-workflow kon niet worden voltooid. Probeer het opnieuw of neem contact op met de beheerder.'

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface RunRow {
  id: string
  assistant_id: string
  advisor_id: string
  client_reference: string
  status: RunStatus
  started_at: string
  finished_at: string | null
  error_code: string | null
  error_message: string | null
  expires_at: string
  result_json: unknown | null
  intern_markdown: string | null
  dossier_path: string | null
}

export interface AnalysisMockOptions {
  /** Overrides the assistant query (used to simulate a disabled assistant). */
  assistant?: Record<string, unknown> | null
  /** Overrides the knowledge-base query (used without real assistant data). */
  knowledgeBases?: Array<Record<string, unknown>>
  /** Simulates an Edge Function error response. */
  submitError?: { status: number; code: string; message: string }
  /** Status before `durationMs`; defaults to 'queued'. */
  initialStatus?: RunStatus
  /** Status after `durationMs`; defaults to 'succeeded'. */
  finalStatus?: RunStatus
  /** Milliseconds before the run reaches `finalStatus` (0 = immediately). */
  durationMs?: number
  result?: unknown
  internMarkdown?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  clientReference?: string
  dossierPath?: string | null
  /** When true, run-status requests return no row (simulates another advisor). */
  runNotFound?: boolean
}

export interface AnalysisMock {
  assistantId: string | null
  submitCount: number
  submitAuthorizations: Array<string | undefined>
  restAuthorizations: Array<string | undefined>
  setAssistantId(id: string): void
  lastRunId(): string | null
}

const FALLBACK_ASSISTANT_ID = '00000000-0000-4000-8000-000000000001'
const FALLBACK_RUN_ID = '00000000-0000-4000-8000-0000000000aa'

function iso(deltaMs: number): string {
  return new Date(Date.now() + deltaMs).toISOString()
}

export async function installAnalysisMock(
  page: Page,
  options: AnalysisMockOptions = {},
): Promise<AnalysisMock> {
  const startedAt = new Map<string, number>()
  let assistantId: string | null = null
  let submitCount = 0
  let lastRunId: string | null = null
  const submitAuthorizations: Array<string | undefined> = []
  const restAuthorizations: Array<string | undefined> = []

  const state: AnalysisMock = {
    get assistantId() {
      return assistantId
    },
    get submitCount() {
      return submitCount
    },
    submitAuthorizations,
    restAuthorizations,
    setAssistantId(id: string) {
      assistantId = id
    },
    lastRunId() {
      return lastRunId
    },
  }

  const statusFor = (runId: string): RunStatus => {
    if (!startedAt.has(runId)) startedAt.set(runId, Date.now())
    const elapsed = Date.now() - (startedAt.get(runId) ?? Date.now())
    if (elapsed < (options.durationMs ?? 0)) return options.initialStatus ?? 'queued'
    return options.finalStatus ?? 'succeeded'
  }

  const makeRun = (runId: string): RunRow => {
    const status = statusFor(runId)
    const succeeded = status === 'succeeded'
    const failed = status === 'failed'
    return {
      id: runId,
      assistant_id: assistantId ?? FALLBACK_ASSISTANT_ID,
      advisor_id: '00000000-0000-4000-8000-0000000000bb',
      client_reference: options.clientReference ?? 'KL-2026-003',
      status,
      started_at: iso(-5_000),
      finished_at: succeeded || failed ? iso(-1_000) : null,
      error_code: failed ? (options.errorCode ?? ERROR_CODE) : null,
      error_message: failed ? (options.errorMessage ?? ERROR_MESSAGE) : null,
      expires_at: iso(7 * 24 * 60 * 60 * 1000),
      result_json: succeeded ? (options.result ?? RICH_RESULT) : null,
      intern_markdown: succeeded ? (options.internMarkdown ?? RICH_MARKDOWN) : null,
      dossier_path: succeeded ? (options.dossierPath ?? `org/advisor/${runId}.docx`) : null,
    }
  }

  const toRecent = (run: RunRow) => ({
    id: run.id,
    assistant_id: run.assistant_id,
    client_reference: run.client_reference,
    status: run.status,
    started_at: run.started_at,
    finished_at: run.finished_at,
    error_code: run.error_code,
    expires_at: run.expires_at,
  })

  if (options.assistant !== undefined) {
    await page.route('**/rest/v1/ai_assistants*', async (route) => {
      const url = new URL(route.request().url())
      const idFilter = url.searchParams.get('id')
      if (!options.assistant) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        return
      }
      const row = { ...options.assistant }
      if (idFilter?.startsWith('eq.')) row.id = idFilter.slice(3)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([row]) })
    })
  }

  if (options.knowledgeBases !== undefined) {
    await page.route('**/rest/v1/assistant_knowledge_bases*', async (route) => {
      const rows = options.knowledgeBases!.map((kb) => ({ knowledge_bases: kb }))
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
    })
  }

  await page.route('**/functions/v1/analysis-run-submit', async (route) => {
    submitCount += 1
    submitAuthorizations.push(route.request().headers()['authorization'])
    if (options.submitError) {
      await route.fulfill({
        status: options.submitError.status,
        contentType: 'application/json',
        body: JSON.stringify({ code: options.submitError.code, message: options.submitError.message }),
      })
      return
    }
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ run_id: FALLBACK_RUN_ID }),
    })
  })

  await page.route('**/rest/v1/analysis_runs*', async (route) => {
    restAuthorizations.push(route.request().headers()['authorization'])
    const url = new URL(route.request().url())
    const idFilter = url.searchParams.get('id')

    if (idFilter?.startsWith('eq.')) {
      const runId = idFilter.slice(3)
      lastRunId = runId
      if (options.runNotFound) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([makeRun(runId)]),
      })
      return
    }

    if (options.runNotFound) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      return
    }
    const runId = lastRunId ?? FALLBACK_RUN_ID
    const rows = lastRunId ? [toRecent(makeRun(runId))] : []
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })

  await page.route('**/storage/v1/object/sign/analysis-dossiers/**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ signedURL: '/object/sign/analysis-dossiers/test/dossier.docx?token=test' }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      headers: { 'Content-Disposition': 'attachment; filename="dossier.docx"' },
      body: Buffer.from('UEsDBBQABgAIAAAA', 'base64'),
    })
  })

  return state
}

/** Opens the analysis form from the assistants page and returns the assistant id. */
export async function openAnalysisForm(page: Page): Promise<string> {
  await page.goto('/assistants')
  await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()
  await page.waitForURL(/\/analyse\/new\/[0-9a-f-]{36}/)
  const match = page.url().match(/\/analyse\/new\/([0-9a-f-]{36})/)
  return match?.[1] ?? FALLBACK_ASSISTANT_ID
}

/** Fills the minimal valid form (group rule satisfied by Klantsituatie). */
export async function fillMinimalAnalysisForm(
  page: Page,
  clientReference: string,
  question = 'Vraagstuk',
): Promise<void> {
  await page.getByLabel(/verzekeringsvraagstuk/i).fill(question)
  await page.getByRole('checkbox').first().check()
  await page.getByLabel(/klantsituatie/i).fill('Karige situatie')
  await page.getByLabel(/klantreferentie/i).fill(clientReference)
}
