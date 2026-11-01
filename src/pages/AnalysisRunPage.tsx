import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAnalysisRun } from '@/hooks/useAnalysisRun'
import { useAnalysisSeenStore } from '@/store/analysisSeenStore'
import { hasRetrySnapshot } from '@/lib/analysis-retry'
import { RunCard } from '@/components/analysis/RunCard'
import { ResultView } from '@/components/analysis/ResultView'
import { Button } from '@/components/ui/button'

// Analysis run page: status + result of one analysis at a permanent id-only
// address (feature 014 — replaces the AnalysisFlow side panel). Polling stops
// at succeeded/failed (useAnalysisRun); retry navigates to the start page with
// the snapshot id in router state.
function AnalysisRunPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { run, isLoading, error } = useAnalysisRun(runId ?? null)
  const markSeen = useAnalysisSeenStore((state) => state.markSeen)

  // Viewing a finished analysis marks it seen (US2) — also when it finishes
  // while the advisor is watching this page.
  useEffect(() => {
    if (!run) return
    if (run.status === 'succeeded' || run.status === 'failed') markSeen([run.id])
  }, [run, markSeen])

  if (isLoading && !run) {
    return <p className="text-sm text-muted-foreground">Analyse wordt geladen…</p>
  }

  // --- Not-found / no-access state (FR-004: Dutch message, no content of others)
  if (error?.code === 'NOT_FOUND') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <h1 className="text-xl font-semibold">Analyse niet gevonden</h1>
        <p className="text-sm text-muted-foreground">Deze analyse bestaat niet of u heeft er geen toegang toe.</p>
        <Button variant="outline" onClick={() => navigate('/assistants')}>Terug naar assistenten</Button>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <p className="font-medium">Status kon niet worden opgehaald</p>
        <p className="mt-1">{error.message}</p>
      </div>
    )
  }

  if (!run) return null

  const showResult = run.status === 'succeeded'
  const retryAvailable = run.status === 'failed' && hasRetrySnapshot(run.id)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <RunCard
        runId={run.id}
        status={run.status}
        startedAt={run.started_at}
        errorCode={run.error_code}
        errorMessage={run.error_message}
        onRetry={
          retryAvailable
            ? () => navigate(`/analyse/new/${run.assistant_id}`, { state: { retryRunId: run.id } })
            : undefined
        }
      />
      {showResult && run.result && run.intern_markdown && (
        <ResultView
          runId={run.id}
          result={run.result}
          internMarkdown={run.intern_markdown}
          dossierPath={run.dossier_path ?? null}
          expiresAt={run.expires_at}
        />
      )}
      {run.status === 'failed' && !retryAvailable && (
        <p className="text-sm text-muted-foreground">
          De eerdere invoer is niet meer beschikbaar in deze sessie. Vul het formulier opnieuw in.
        </p>
      )}
    </div>
  )
}

export default AnalysisRunPage