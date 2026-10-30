import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// Finished analysis runs the advisor has already seen (feature 014). The
// store holds run-ids ONLY — no client content — and persists to
// sessionStorage: session-bound, per constitution III. `initialized` marks
// that the first list load has marked all existing finished runs as seen,
// so a fresh session never counts historical completions.
interface AnalysisSeenState {
  seenIds: string[]
  initialized: boolean
  markSeen: (ids: string[]) => void
}

const MAX_SEEN_IDS = 50

export const useAnalysisSeenStore = create<AnalysisSeenState>()(
  persist(
    (set) => ({
      seenIds: [],
      initialized: false,
      markSeen: (ids) =>
        set((state) => {
          const merged = new Set(state.seenIds)
          for (const id of ids) merged.add(id)
          const next = [...merged].slice(-MAX_SEEN_IDS)
          const changed = next.some((id) => !state.seenIds.includes(id))
          if (!changed && state.initialized) {
            return state
          }
          return {
            seenIds: changed ? next : state.seenIds,
            initialized: true,
          }
        }),
    }),
    {
      name: 'analysis-seen-runs',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)