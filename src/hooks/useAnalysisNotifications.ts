import { useEffect, useMemo } from 'react'
import { useRecentRuns } from '@/hooks/useRecentRuns'
import { useAnalysisSeenStore } from '@/store/analysisSeenStore'

// Finished-but-unseen analysis count for the sidebar badge and the tab title
// (feature 014, US2). Shares the recent-runs query with the list (one
// request, one conditional poll). "Seen" is a sessionStorage set of run-ids;
// viewing the analyses marks them seen and resets the count.
export function useAnalysisNotifications(advisorId: string | undefined): number {
  const { data: runs } = useRecentRuns(advisorId)
  const seenIds = useAnalysisSeenStore((state) => state.seenIds)
  const initialized = useAnalysisSeenStore((state) => state.initialized)
  const markSeen = useAnalysisSeenStore((state) => state.markSeen)

  // First use of the session: everything that is already finished counts as
  // seen — the badge only counts completions from now on (spec edge case).
  useEffect(() => {
    if (!runs || initialized) return
    const finished = runs
      .filter((run) => run.status === 'succeeded' || run.status === 'failed')
      .map((run) => run.id)
    markSeen(finished)
  }, [runs, initialized, markSeen])

  const count = useMemo(() => {
    if (!runs) return 0
    const seen = new Set(seenIds)
    return runs.filter(
      (run) => (run.status === 'succeeded' || run.status === 'failed') && !seen.has(run.id),
    ).length
  }, [runs, seenIds])

  return count
}