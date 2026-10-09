import { useQuery } from '@tanstack/react-query'
import { fetchAnalysisRun, AnalysisClientError } from '@/lib/analysis-client'
import type { AnalysisRun } from '@/lib/analysis-schemas'

const BACKOFF_DELAYS_MS: readonly number[] = [6_000, 12_000, 24_000, 30_000]

export interface UseAnalysisRunResult {
  run: AnalysisRun | undefined
  isLoading: boolean
  error: AnalysisClientError | null
}

export function useAnalysisRun(runId: string | null): UseAnalysisRunResult {
  const query = useQuery({
    queryKey: ['analysis-run', runId],
    enabled: !!runId,
    queryFn: async (): Promise<AnalysisRun> => fetchAnalysisRun(runId!),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'succeeded' || status === 'failed') return false
      return 3_000
    },
    refetchIntervalInBackground: false,
    retry: (failureCount: number, error: AnalysisClientError): boolean => {
      if (error.code === 'NOT_FOUND') return false
      return failureCount < BACKOFF_DELAYS_MS.length
    },
    retryDelay: (failureCount: number): number => {
      const delay = BACKOFF_DELAYS_MS[Math.min(failureCount, BACKOFF_DELAYS_MS.length - 1)]
      return delay !== undefined ? delay : 30_000
    },
    staleTime: 0,
  })

  return {
    run: query.data,
    isLoading: query.isLoading,
    error: (query.error as AnalysisClientError | null) ?? null,
  }
}