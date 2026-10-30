import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAssistant } from '@/hooks/queries'
import { useAuth } from '@/hooks/useAuth'
import { useRecentRuns } from '@/hooks/useRecentRuns'
import { useAnalysisSeenStore } from '@/store/analysisSeenStore'
import { submitAnalysisRun, AnalysisClientError } from '@/lib/analysis-client'
import { getRetrySnapshot, saveRetrySnapshot } from '@/lib/analysis-retry'
import { randomUUID } from '@/lib/uuid'
import { AnalysisForm, type AnalysisFormValues } from '@/components/analysis/AnalysisForm'
import { RecentRunsPanel } from '@/components/analysis/RecentRunsPanel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// Analysis start page: form + recent analyses for one risico-analyse
// assistant (feature 014 — replaces the AnalysisFlow side panel). The URL
// contains only ids (constitution III); retry prefill arrives via router
// state, never via the URL.
function AnalysisNewPage() {
  const { assistantId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const { data: assistant, isPending } = useAssistant(assistantId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<AnalysisClientError | null>(null)

  const retryRunId = (location.state as { retryRunId?: string } | null)?.retryRunId ?? null
  const retrySnapshot = retryRunId ? getRetrySnapshot(retryRunId) : undefined

  // Viewing the analyses resets the notification count (US2): every finished
  // run in the list is marked seen. Same queryKey as the panel — no extra
  // request.
  const { data: recentRuns } = useRecentRuns(profile?.id)
  const markSeen = useAnalysisSeenStore((state) => state.markSeen)
  useEffect(() => {
    if (!recentRuns) return
    const finished = recentRuns
      .filter((run) => run.status === 'succeeded' || run.status === 'failed')
      .map((run) => run.id)
    if (finished.length > 0) markSeen(finished)
  }, [recentRuns, markSeen])

  const handleSubmit = useCallback(async (values: AnalysisFormValues) => {
    if (!profile) {
      setSubmitError(new AnalysisClientError('UNAUTHORIZED', 'Uw sessie is verlopen. Log opnieuw in.'))
      return
    }
    if (!assistant) return
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
      saveRetrySnapshot(newRunId, { ...values, bestanden: [] }, values.bestanden.length > 0)
      navigate(`/analyse/${newRunId}`)
    } catch (err) {
      const error = err instanceof AnalysisClientError
        ? err
        : new AnalysisClientError('BACKEND_ERROR', 'Er trad een onverwachte fout op.')
      setSubmitError(error)
    } finally {
      setIsSubmitting(false)
    }
  }, [profile, assistant, navigate])

  // --- Loading state
  if (isPending && !assistant) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 mt-2" />
        <Skeleton className="h-96 w-full mt-6" />
      </div>
    )
  }

  // --- Not-found state (FR-004: no content of others, id-only URL)
  if (!assistant || assistant.type !== 'risico_analyse' || !assistant.is_active) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <h1 className="text-xl font-semibold">Assistent niet gevonden</h1>
        <p className="text-sm text-muted-foreground">Deze assistent bestaat niet of is niet beschikbaar voor een analyse.</p>
        <Button variant="outline" onClick={() => navigate('/assistants')}>Terug naar assistenten</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">{assistant.icon}</span>
          <div>
            <h1 className="text-xl font-semibold">{assistant.name}</h1>
            <p className="text-xs text-muted-foreground">Risico-analyse — CONCEPT, door adviseur te accorderen</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Adviseur</p>
          <p className="text-sm font-medium">{profile?.full_name ?? ''}</p>
        </div>
      </div>

      <AnalysisForm
        assistant={assistant}
        initial={retrySnapshot?.values ?? null}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onSubmit={handleSubmit}
      />

      {profile && (
        <RecentRunsPanel advisorId={profile.id} onOpenRun={(runId) => navigate(`/analyse/${runId}`)} />
      )}
    </div>
  )
}

export default AnalysisNewPage