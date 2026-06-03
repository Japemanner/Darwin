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
    // Add timeout to prevent hanging
    const result = await Promise.race([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout after 5 seconds')), 5000)
      ),
    ])
    
    const { data, error } = result as { data: Profile | null; error: any }
    
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
        console.log('Auth state change event:', event, session?.user?.id)
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in:', session.user.id)
          set({ user: session.user, isAuthenticated: true })
          const profile = await fetchProfile(session.user.id)
          if (profile) {
            console.log('Profile loaded for signed in user:', profile.id, profile.full_name)
            set({ profile })
          } else {
            console.warn('No profile found for signed in user:', session.user.id)
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out')
          // Handle session expiry
          set({ user: null, profile: null, isAuthenticated: false })
          // Optionally redirect to login with a message
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            // Store current location for redirect after login
            localStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search)
            // Redirect to login
            window.location.href = '/login'
          }
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed')
          // Token refresh doesn't change authentication state
        } else if (event === 'USER_UPDATED') {
          console.log('User updated')
          // Refresh profile when user is updated
          if (session?.user) {
            const profile = await fetchProfile(session.user.id)
            if (profile) {
              console.log('Profile refreshed:', profile.id, profile.full_name)
              set({ profile })
            }
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
        console.log('Session found for user:', session.user.id)
        set({ user: session.user, isAuthenticated: true })
        const profile = await fetchProfile(session.user.id)
        if (profile) {
          console.log('Profile loaded for user:', profile.id, profile.full_name)
          set({ profile })
        } else {
          console.warn('No profile found for user:', session.user.id)
        }
      } else {
        console.log('No active session found')
      }
    } catch {
      // silent — user will need to login
    } finally {
      set({ isLoading: false })
      initialized = true
    }
  },
}))
