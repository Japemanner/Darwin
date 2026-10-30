import type { AnalysisFormValues } from '@/components/analysis/AnalysisForm'

// Retry snapshot for a failed analysis run: the submitted form values plus
// whether that attempt had attachments. Files themselves are deliberately
// NOT kept — the retry notice tells the advisor to re-add them (US5). In-memory
// only, module-level — never browser storage (constitution III).
export interface AnalysisRetrySnapshot {
  values: AnalysisFormValues
  hadBestanden: boolean
}

const retrySnapshots = new Map<string, AnalysisRetrySnapshot>()

export function saveRetrySnapshot(runId: string, values: AnalysisFormValues, hadBestanden: boolean): void {
  retrySnapshots.set(runId, { values, hadBestanden })
}

export function getRetrySnapshot(runId: string): AnalysisRetrySnapshot | undefined {
  return retrySnapshots.get(runId)
}

export function hasRetrySnapshot(runId: string): boolean {
  return retrySnapshots.has(runId)
}