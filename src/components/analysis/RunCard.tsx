import { useEffect, useState } from 'react'
import type { RunStatus } from '@/lib/analysis-schemas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle, RotateCcw } from 'lucide-react'

const STATUS_LABELS: Record<RunStatus, string> = {
  queued: 'in wachtrij',
  running: 'bezig',
  succeeded: 'klaar',
  failed: 'mislukt',
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`
}

export interface RunCardProps {
  runId: string
  status: RunStatus
  startedAt: string
  errorCode?: string | null
  errorMessage?: string | null
  onOpenResult?: () => void
  onRetry?: () => void
}

export function RunCard({ runId, status, startedAt, errorCode, errorMessage, onOpenResult, onRetry }: RunCardProps) {
  const [elapsed, setElapsed] = useState(() => Date.now() - new Date(startedAt).getTime())

  useEffect(() => {
    if (status === 'succeeded' || status === 'failed') return
    const timer = setInterval(() => {
      setElapsed(Date.now() - new Date(startedAt).getTime())
    }, 1_000)
    return () => clearInterval(timer)
  }, [status, startedAt])

  const label = STATUS_LABELS[status] ?? null

  return (
    <div className="rounded-lg border p-4" aria-live="polite" data-testid={`run-card-${runId}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {(status === 'queued' || status === 'running') && <Spinner className="h-4 w-4" />}
          {label ? (
            <Badge variant={status === 'failed' ? 'destructive' : status === 'succeeded' ? 'default' : 'secondary'}>
              {label}
            </Badge>
          ) : (
            <Badge variant="outline">
              <AlertCircle className="h-3 w-3 mr-1" aria-hidden="true" />
              onbekende status
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">{formatElapsed(elapsed)}</span>
        </div>
        {status === 'succeeded' && onOpenResult && (
          <Button size="sm" onClick={onOpenResult}>
            Resultaat bekijken
          </Button>
        )}
      </div>
      {status === 'failed' && (
        <div className="mt-3 flex flex-col gap-2">
          <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p>{errorMessage ?? 'De analyse is mislukt. Probeer het opnieuw of neem contact op met de beheerder.'}</p>
              {errorCode && <p className="mt-1 text-xs">Foutcode: {errorCode}</p>}
            </div>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="self-start">
              <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" /> Opnieuw
            </Button>
          )}
        </div>
      )}
    </div>
  )
}