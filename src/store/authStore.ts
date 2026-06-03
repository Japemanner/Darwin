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
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }
    
    return data as Profile | null
  } catch (error) {
    console.error('Error fetching profile:', error)
    return null
  }
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
    try {
      await supabase.auth.signOut()
    } catch {
      // session already invalid — clean up locally
    }
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
        } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          // Handle session expiry
          set({ user: null, profile: null, isAuthenticated: false })
          // Optionally redirect to login with a message
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            // Store current location for redirect after login
            localStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search)
            // Redirect to login
            window.location.href = '/login'
          }
        }
      })

      const { data: { session } } = await Promise.race([
        supabase.auth.getSession(),
        new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 10000)
        ),
      ])
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
