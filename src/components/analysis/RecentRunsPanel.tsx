import { useRecentRuns, formatStartedAt } from '@/hooks/useRecentRuns'
import { Badge } from '@/components/ui/badge'
import type { RecentRun } from '@/lib/analysis-schemas'
import { History } from 'lucide-react'

export interface RecentRunsPanelProps {
  advisorId: string
  onOpenRun: (runId: string) => void
}

export function RecentRunsPanel({ advisorId, onOpenRun }: RecentRunsPanelProps) {
  const { data: runs, error } = useRecentRuns(advisorId)

  return (
    <section aria-label="Recente runs" className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <History className="h-4 w-4" aria-hidden="true" /> Recente runs
      </h2>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Recente runs konden niet worden opgehaald. Controleer de verbinding.
        </p>
      )}
      {!error && (!runs || runs.length === 0) && (
        <p className="text-sm text-muted-foreground">Nog geen runs gestart.</p>
      )}
      {runs && runs.length > 0 && (
        <ul className="space-y-1">
          {runs.map((run: RecentRun) => (
            <li key={run.id}>
              <button
                type="button"
                onClick={() => onOpenRun(run.id)}
                className="flex w-full items-center justify-between gap-4 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="truncate">{run.client_reference}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={run.status === 'failed' ? 'destructive' : run.status === 'succeeded' ? 'default' : 'secondary'}>
                    {run.status === 'queued' ? 'in wachtrij' : run.status === 'running' ? 'bezig' : run.status === 'succeeded' ? 'klaar' : 'mislukt'}
                  </Badge>
                  <span>{formatStartedAt(run.started_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}