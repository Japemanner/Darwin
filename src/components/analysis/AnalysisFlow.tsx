import { useCallback, useState } from 'react'
import { randomUUID } from '@/lib/uuid'
import { AnalysisForm, type AnalysisFormValues } from '@/components/analysis/AnalysisForm'
import { RunCard } from '@/components/analysis/RunCard'
import { RecentRunsPanel } from '@/components/analysis/RecentRunsPanel'
import { ResultView } from '@/components/analysis/ResultView'
import { submitAnalysisRun, AnalysisClientError } from '@/lib/analysis-client'
import { useAnalysisRun } from '@/hooks/useAnalysisRun'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import type { AIAssistant } from '@/types/database.types'
import { X } from 'lucide-react'

type Screen = 'form' | 'run'

export interface AnalysisFlowProps {
  assistant: AIAssistant
  onClose: () => void
}

// In-memory only — never persisted (constitution Principle III).
const retrySnapshots = new Map<string, AnalysisFormValues>()

export function AnalysisFlow({ assistant, onClose }: AnalysisFlowProps) {
  const { profile } = useAuth()
  const [screen, setScreen] = useState<Screen>('form')
  const [runId, setRunId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<AnalysisClientError | null>(null)
  const [retryValues, setRetryValues] = useState<AnalysisFormValues | null>(null)
  const { run, isLoading: isRunLoading, error: runError } = useAnalysisRun(runId)

  const handleSubmit = useCallback(async (values: AnalysisFormValues) => {
    if (!profile) {
      setSubmitError(new AnalysisClientError('UNAUTHORIZED', 'Uw sessie is verlopen. Log opnieuw in.'))
      return
    }
    setIsSubmitting(true)
    setSubmitError(null)
    const newRunId = randomUUID()
    try {
      await submitAnalysisRun({
        run_id: newRunId,
        assistant_id: assistant.id,
        advisor_id: profile.id,
        adviseur_naam: profile.full_name,
        verzekeringsvraagstuk: values.verzekeringsvraagstuk,
        kennisbronnen: values.kennisbronnen,
        klantsituatie: values.klantsituatie,
        bestanden: values.bestanden,
        urls: values.urls,
        klant_ref: values.klantreferentie,
      })
      retrySnapshots.set(newRunId, values)
      setRunId(newRunId)
      setScreen('run')
    } catch (err) {
      const error = err instanceof AnalysisClientError
        ? err
        : new AnalysisClientError('BACKEND_ERROR', 'Er trad een onverwachte fout op.')
      setSubmitError(error)
    } finally {
      setIsSubmitting(false)
    }
  }, [assistant.id, profile])

  const handleRetry = useCallback(() => {
    const values = runId ? retrySnapshots.get(runId) : null
    setRetryValues(values ? { ...values, bestanden: [] } : null)
    setScreen('form')
    setRunId(null)
  }, [runId])

  const handleOpenRecentRun = useCallback((id: string) => {
    setRunId(id)
    setScreen('run')
  }, [])

  const showResult = screen === 'run' && run?.status === 'succeeded'
  const showFailed = screen === 'run' && run?.status === 'failed'
  const retryAvailable = showFailed && runId !== null && retrySnapshots.has(runId)

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-background shadow-2xl md:w-[720px] lg:w-[880px]">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">{assistant.icon}</span>
          <div>
            <h2 className="font-semibold">{assistant.name}</h2>
            <p className="text-xs text-muted-foreground">Risico-analyse — CONCEPT, door adviseur te accorderen</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Sluiten">
          <X className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {screen === 'form' && (
          <div className="mx-auto flex max-w-2xl flex-col gap-8">
            <AnalysisForm
              assistant={assistant}
              initial={retryValues}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onSubmit={handleSubmit}
            />
            {profile && <RecentRunsPanel advisorId={profile.id} onOpenRun={handleOpenRecentRun} />}
          </div>
        )}

        {screen === 'run' && (
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            {isRunLoading && !run && <p className="text-sm text-muted-foreground">Run wordt geladen...</p>}

            {runError && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-medium">Status kon niet worden opgehaald</p>
                <p className="mt-1">{runError.message}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setScreen('form')}>
                  Terug naar het formulier
                </Button>
              </div>
            )}

            {run && (
              <>
                <RunCard
                  runId={run.id}
                  status={run.status}
                  startedAt={run.started_at}
                  errorCode={run.error_code}
                  errorMessage={run.error_message}
                  onRetry={retryAvailable ? handleRetry : undefined}
                />
                {showResult && run.result && run.intern_markdown && (
                  <ResultView
                    runId={run.id}
                    result={run.result}
                    internMarkdown={run.intern_markdown}
                    dossierDocxUrl={run.dossier_docx_url ?? null}
                    expiresAt={run.expires_at}
                  />
                )}
                {showFailed && retryValues === null && (
                  <p className="text-sm text-muted-foreground">
                    De eerdere invoer is niet meer beschikbaar in deze sessie. Vul het formulier opnieuw in.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}