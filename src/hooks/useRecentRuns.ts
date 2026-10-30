import { useQuery } from '@tanstack/react-query'
import { fetchRecentRuns, AnalysisClientError } from '@/lib/analysis-client'
import type { RecentRun } from '@/lib/analysis-schemas'

export function useRecentRuns(advisorId: string | undefined) {
  return useQuery<RecentRun[], AnalysisClientError>({
    queryKey: ['analysis-recent-runs', advisorId],
    enabled: !!advisorId,
    queryFn: () => fetchRecentRuns(advisorId!, 10),
    staleTime: 5_000,
    // Poll only while analyses are actually running (feature 014, FR-007):
    // no periodic requests once every run in the list is finished.
    refetchInterval: (query) => {
      const runs = query.state.data
      if (!runs) return false
      const hasRunning = runs.some((run) => run.status === 'queued' || run.status === 'running')
      return hasRunning ? 10_000 : false
    },
  })
}

export function formatStartedAt(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}