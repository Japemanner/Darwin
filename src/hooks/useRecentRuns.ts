import { useQuery } from '@tanstack/react-query'
import { fetchRecentRuns, AnalysisClientError } from '@/lib/analysis-client'
import type { RecentRun } from '@/lib/analysis-schemas'

export function useRecentRuns(advisorId: string | undefined) {
  return useQuery<RecentRun[], AnalysisClientError>({
    queryKey: ['analysis-recent-runs', advisorId],
    enabled: !!advisorId,
    queryFn: () => fetchRecentRuns(advisorId!, 10),
    staleTime: 5_000,
    refetchInterval: 10_000,
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