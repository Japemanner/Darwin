import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js'
import { supabase } from './supabase'
import {
  AnalysisRunSchema,
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_FILE_SIZE_BYTES,
  RecentRunSchema,
  isAllowedFile,
  isHttpsUrl,
  type AnalysisRun,
  type RecentRun,
} from './analysis-schemas'

// Typed client for the risk-analysis server route (feature 021).
// Contract: specs/021-analysis-server-route/contracts/{analysis-run-submit,analysis-runs-read}.md
//
// The browser never talks to n8n and never sees the webhook URL or secret:
// starting a run goes through the analysis-run-submit Edge Function, status and
// the recent list are read from analysis_runs under RLS, and the dossier is
// downloaded through a 60-second signed URL created at click time.

export interface SubmitAnalysisInput {
  run_id: string
  assistant_id: string
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
  | 'NOT_CONFIGURED'
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

const TEXT_NOT_CONFIGURED = 'Er is geen koppeling geconfigureerd. Neem contact op met de beheerder.'
const TEXT_UNAUTHORIZED = 'Uw sessie is verlopen. Log opnieuw in.'
const TEXT_NOT_FOUND = 'De uitvoering is niet gevonden.'
const TEXT_BACKEND = 'Er trad een fout op bij de risico-analyse-service.'
const TEXT_CONNECTION = 'Kon geen verbinding maken met de risico-analyse-service.'
const TEXT_TIMEOUT = 'De risico-analyse-service reageert niet binnen de verwachte tijd.'

// FunctionsHttpError carries the Edge Function's JSON error body. Map every
// server code to the existing typed errors; never swallow an error.
async function toAnalysisError(err: unknown): Promise<AnalysisClientError> {
  if (err instanceof FunctionsHttpError) {
    const body = await err.context.json().catch(() => null) as
      | { code?: string; message?: string }
      | null
    const code = body?.code
    const message = body?.message
    if (code === 'NOT_CONFIGURED') {
      return new AnalysisClientError('NOT_CONFIGURED', message || TEXT_NOT_CONFIGURED)
    }
    if (code === 'UNAUTHORIZED') {
      return new AnalysisClientError('UNAUTHORIZED', message || TEXT_UNAUTHORIZED)
    }
    if (code === 'FILE_TOO_LARGE') {
      return new AnalysisClientError('FILE_TOO_LARGE', message || 'De bestanden overschrijden de toegestane grootte.')
    }
    if (code === 'GROUP_VALIDATION') {
      return new AnalysisClientError('GROUP_VALIDATION', message || 'De ingediende gegevens voldoen niet aan de validatie.')
    }
    if (code === 'VALIDATION') {
      return new AnalysisClientError('VALIDATION', message || 'Controleer de ingevulde gegevens.')
    }
    if (code === 'FORBIDDEN') {
      return new AnalysisClientError('BACKEND_ERROR', message || 'Deze assistent is niet beschikbaar voor een analyse.')
    }
    if (code === 'CONFLICT') {
      return new AnalysisClientError('BACKEND_ERROR', message || 'De analyse kon niet worden gestart. Probeer het opnieuw.')
    }
    if (code === 'UPSTREAM_TIMEOUT') {
      return new AnalysisClientError('BACKEND_TIMEOUT', message || TEXT_TIMEOUT)
    }
    if (code === 'UPSTREAM_UNREACHABLE') {
      return new AnalysisClientError('CONNECTION_ERROR', message || TEXT_CONNECTION)
    }
    // Platform-level responses (e.g. a rejected JWT before the function runs)
    // carry no application code; keep the existing status-based mapping.
    const status = err.context.status
    if (status === 401) return new AnalysisClientError('UNAUTHORIZED', message || TEXT_UNAUTHORIZED)
    if (status === 403) return new AnalysisClientError('BACKEND_ERROR', message || 'Deze assistent is niet beschikbaar voor een analyse.')
    if (status === 413) return new AnalysisClientError('FILE_TOO_LARGE', message || 'De bestanden overschrijden de toegestane grootte.')
    if (status === 422) return new AnalysisClientError('GROUP_VALIDATION', message || 'De ingediende gegevens voldoen niet aan de validatie.')
    if (status === 400) return new AnalysisClientError('VALIDATION', message || 'Controleer de ingevulde gegevens.')
    return new AnalysisClientError('BACKEND_ERROR', message || TEXT_BACKEND)
  }
  if (err instanceof FunctionsRelayError || err instanceof FunctionsFetchError) {
    return new AnalysisClientError('CONNECTION_ERROR', TEXT_CONNECTION)
  }
  return new AnalysisClientError('BACKEND_ERROR', TEXT_BACKEND)
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

  // FormData lets supabase-js send the real File objects without setting a
  // Content-Type, so the browser adds the multipart boundary.
  const form = new FormData()
  form.set('run_id', input.run_id)
  form.set('assistant_id', input.assistant_id)
  form.set('verzekeringsvraagstuk', input.verzekeringsvraagstuk)
  form.set('kennisbronnen', JSON.stringify(input.kennisbronnen))
  if (input.klantsituatie?.trim()) form.set('klantsituatie', input.klantsituatie.trim())
  for (const file of input.bestanden ?? []) form.append('bestanden', file, file.name)
  form.set('urls', JSON.stringify(input.urls ?? []))
  form.set('klant_ref', input.klant_ref)

  const { data, error } = await supabase.functions.invoke('analysis-run-submit', { body: form })
  if (error) throw await toAnalysisError(error)

  const parsed = data as { run_id?: unknown } | null
  if (!parsed || typeof parsed.run_id !== 'string') {
    throw new AnalysisClientError('INVALID_RESPONSE', 'De service gaf een onverwacht antwoord.')
  }
  return { run_id: parsed.run_id }
}

export async function fetchAnalysisRun(runId: string): Promise<AnalysisRun> {
  const { data, error } = await supabase
    .from('analysis_runs')
    .select('id, assistant_id, advisor_id, client_reference, status, started_at, finished_at, error_code, error_message, result_json, intern_markdown, dossier_path, expires_at')
    .eq('id', runId)
    .maybeSingle()

  if (error) {
    throw new AnalysisClientError('BACKEND_ERROR', 'De status van de uitvoering kon niet worden opgehaald.')
  }
  if (!data) {
    throw new AnalysisClientError('NOT_FOUND', TEXT_NOT_FOUND)
  }

  const mapped = {
    ...data,
    result: data.result_json,
    // The server route stores a path, not a URL; the URL is created at click time.
    dossier_docx_url: null,
  }
  const parsed = AnalysisRunSchema.safeParse(mapped)
  if (!parsed.success) {
    throw new AnalysisClientError('INVALID_RESPONSE', 'De status van de uitvoering kon niet worden uitgelezen (ongeldig antwoord).')
  }
  return parsed.data
}

export async function fetchRecentRuns(advisorId: string, limit = 10): Promise<RecentRun[]> {
  const { data, error } = await supabase
    .from('analysis_runs')
    .select('id, assistant_id, client_reference, status, started_at, finished_at, error_code, expires_at')
    .eq('advisor_id', advisorId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new AnalysisClientError('BACKEND_ERROR', 'De lijst met recente uitvoeringen kon niet worden opgehaald.')
  }

  const runs: RecentRun[] = []
  for (const item of data ?? []) {
    const parsed = RecentRunSchema.safeParse(item)
    if (parsed.success) runs.push(parsed.data)
  }
  return runs
}

// Creates the signed URL only when the advisor clicks download (60 seconds).
// The URL is intentionally never stored in React state, browser storage or the
// address bar: a temporary anchor triggers the download and is removed again.
export async function downloadAnalysisDossier(path: string): Promise<void> {
  const { data, error } = await supabase.storage
    .from('analysis-dossiers')
    .createSignedUrl(path, 60, { download: 'dossier.docx' })

  if (error || !data?.signedUrl) {
    throw new AnalysisClientError('NOT_FOUND', 'Het dossier is niet meer beschikbaar.')
  }

  const link = document.createElement('a')
  link.href = data.signedUrl
  link.download = 'dossier.docx'
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
