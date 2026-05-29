import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database.types'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

let initialized = false

async function fetchProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data as Profile | null
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),

  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null, isAuthenticated: false })
  },

  initialize: async () => {
    if (initialized) return
    try {
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          set({ user: session.user, isAuthenticated: true })
          const profile = await fetchProfile(session.user.id)
          if (profile) set({ profile })
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, profile: null, isAuthenticated: false })
        }
      })

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        set({ user: session.user, isAuthenticated: true })
        const profile = await fetchProfile(session.user.id)
        if (profile) set({ profile })
      }
    } catch {
      // silent — user will need to login
    } finally {
      set({ isLoading: false })
      initialized = true
    }
  },
}))
