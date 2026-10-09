import {
  AnalysisRunSchema,
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_FILE_SIZE_BYTES,
  isAllowedFile,
  isHttpsUrl,
  type AnalysisRun,
  type RecentRun,
} from './analysis-schemas'

export interface SubmitAnalysisInput {
  run_id: string
  assistant_id: string
  advisor_id: string
  adviseur_naam: string
  verzekeringsvraagstuk: string
  kennisbronnen: Array<{ id: string; name: string }>
  klantsituatie?: string
  bestanden?: File[]
  urls?: string[]
  klant_ref: string
}

export type AnalysisErrorCode =
  | 'VALIDATION'
  | 'GROUP_VALIDATION'
  | 'FILE_TOO_LARGE'
  | 'FILE_TYPE_INVALID'
  | 'URL_INVALID'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'BACKEND_ERROR'
  | 'BACKEND_TIMEOUT'
  | 'CONNECTION_ERROR'
  | 'INVALID_RESPONSE'

export class AnalysisClientError extends Error {
  readonly code: AnalysisErrorCode
  constructor(code: AnalysisErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export interface SubmitValidationResult {
  ok: boolean
  errors: Array<{ field: string; code: AnalysisErrorCode; message: string }>
}

export function validateSubmitInput(input: SubmitAnalysisInput): SubmitValidationResult {
  const errors: SubmitValidationResult['errors'] = []
  if (!input.verzekeringsvraagstuk.trim()) {
    errors.push({ field: 'verzekeringsvraagstuk', code: 'VALIDATION', message: 'Vul het verzekeringsvraagstuk in.' })
  }
  if (input.kennisbronnen.length === 0) {
    errors.push({ field: 'kennisbronnen', code: 'VALIDATION', message: 'Selecteer minimaal één kennisbron.' })
  }
  if (!input.klant_ref.trim()) {
    errors.push({ field: 'klant_ref', code: 'VALIDATION', message: 'Vul de klantreferentie in.' })
  }
  const hasGroup = Boolean(input.klantsituatie?.trim()) || (input.bestanden?.length ?? 0) > 0 || (input.urls?.length ?? 0) > 0
  if (!hasGroup) {
    errors.push({ field: 'group', code: 'GROUP_VALIDATION', message: 'Vul minimaal één van Klantsituatie, Bestanden of URL\u2019s in.' })
  }
  for (const file of input.bestanden ?? []) {
    if (!isAllowedFile(file)) {
      errors.push({ field: 'bestanden', code: 'FILE_TYPE_INVALID', message: `Alleen ${ALLOWED_FILE_EXTENSIONS.join(', ')} toegestaan: ${file.name}` })
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push({ field: 'bestanden', code: 'FILE_TOO_LARGE', message: `Bestand overschrijdt de limiet van 10 MB: ${file.name}` })
    }
  }
  const totalSize = (input.bestanden ?? []).reduce((sum, f) => sum + f.size, 0)
  if (totalSize > MAX_TOTAL_FILE_SIZE_BYTES) {
    errors.push({ field: 'bestanden', code: 'FILE_TOO_LARGE', message: 'De totale bestandsgrootte overschrijdt 25 MB.' })
  }
  for (const url of input.urls ?? []) {
    if (!isHttpsUrl(url)) {
      errors.push({ field: 'urls', code: 'URL_INVALID', message: 'URL\u2019s moeten beginnen met https:// ' })
    }
  }
  return { ok: errors.length === 0, errors }
}

const API_URL = import.meta.env.VITE_ANALYSIS_API_URL

function requireApiUrl(): string {
  if (!API_URL) {
    throw new AnalysisClientError('CONNECTION_ERROR', 'De risico-analyse API is niet geconfigureerd.')
  }
  return API_URL
}

function classifyStatusError(status: number): AnalysisClientError {
  if (status === 401) return new AnalysisClientError('UNAUTHORIZED', 'Uw sessie is verlopen. Log opnieuw in.')
  if (status === 404) return new AnalysisClientError('NOT_FOUND', 'De run is niet gevonden.')
  if (status === 413) return new AnalysisClientError('FILE_TOO_LARGE', 'De bestanden overschrijden de toegestane grootte.')
  if (status === 422) return new AnalysisClientError('GROUP_VALIDATION', 'De ingediende gegevens voldoen niet aan de validatie.')
  return new AnalysisClientError('BACKEND_ERROR', 'Er trad een fout op bij de risico-analyse-service.')
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AnalysisClientError('BACKEND_TIMEOUT', 'De risico-analyse-service reageert niet binnen de verwachte tijd.')
    }
    throw new AnalysisClientError('CONNECTION_ERROR', 'Kon geen verbinding maken met de risico-analyse-service.')
  } finally {
    clearTimeout(timer)
  }
}

export async function submitAnalysisRun(input: SubmitAnalysisInput): Promise<{ run_id: string }> {
  const validation = validateSubmitInput(input)
  if (!validation.ok) {
    const [first] = validation.errors
    if (first) {
      throw new AnalysisClientError(first.code, first.message)
    }
    throw new AnalysisClientError('VALIDATION', 'Controleer de ingevulde gegevens.')
  }

  const body: Record<string, unknown> = {
    run_id: input.run_id,
    assistant_id: input.assistant_id,
    advisor_id: input.advisor_id,
    adviseur: { id: input.advisor_id, full_name: input.adviseur_naam },
    verzekeringsvraagstuk: input.verzekeringsvraagstuk,
    kennisbronnen: input.kennisbronnen,
    klantsituatie: input.klantsituatie?.trim() || undefined,
    bestanden: (input.bestanden ?? []).map((f) => f.name),
    urls: input.urls ?? [],
    klant_ref: input.klant_ref,
    callback_url: `${requireApiUrl()}/analysis-run-callback`,
  }

  let res: Response
  try {
    res = await fetchWithTimeout(`${requireApiUrl()}/analysis-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 30_000)
  } catch (err) {
    if (err instanceof AnalysisClientError) throw err
    throw new AnalysisClientError('CONNECTION_ERROR', 'Kon geen verbinding maken met de risico-analyse-service.')
  }

  if (!res.ok) {
    throw classifyStatusError(res.status)
  }

  const parsed = await res.json().catch(() => null)
  if (!parsed || typeof parsed.run_id !== 'string') {
    throw new AnalysisClientError('INVALID_RESPONSE', 'De service gaf een onverwacht antwoord.')
  }
  return { run_id: parsed.run_id }
}

export async function fetchAnalysisRun(runId: string): Promise<AnalysisRun> {
  let res: Response
  try {
    res = await fetchWithTimeout(`${requireApiUrl()}/analysis-runs/${runId}`, { method: 'GET' }, 15_000)
  } catch (err) {
    if (err instanceof AnalysisClientError) throw err
    throw new AnalysisClientError('CONNECTION_ERROR', 'Kon geen verbinding maken met de risico-analyse-service.')
  }

  if (!res.ok) {
    throw classifyStatusError(res.status)
  }

  const raw: unknown = await res.json().catch(() => null)
  const parsed = AnalysisRunSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AnalysisClientError('INVALID_RESPONSE', 'De runstatus kon niet worden uitgelezen (ongeldig antwoord).')
  }
  return parsed.data
}

export async function fetchRecentRuns(advisorId: string, limit = 10): Promise<RecentRun[]> {
  let res: Response
  try {
    res = await fetchWithTimeout(`${requireApiUrl()}/analysis-runs?advisor_id=${encodeURIComponent(advisorId)}&limit=${limit}`, { method: 'GET' }, 15_000)
  } catch (err) {
    if (err instanceof AnalysisClientError) throw err
    throw new AnalysisClientError('CONNECTION_ERROR', 'Kon geen verbinding maken met de risico-analyse-service.')
  }

  if (!res.ok) {
    throw classifyStatusError(res.status)
  }

  const raw: unknown = await res.json().catch(() => null)
  if (!Array.isArray(raw)) {
    throw new AnalysisClientError('INVALID_RESPONSE', 'De lijst recente runs kon niet worden uitgelezen.')
  }
  const runs: RecentRun[] = []
  for (const item of raw) {
    // item is unknown per no-explicit-any policy; validate each entry
    const parsed = (await import('./analysis-schemas')).RecentRunSchema.safeParse(item)
    if (parsed.success) runs.push(parsed.data)
  }
  return runs
}