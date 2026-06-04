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
  signIn: (email: string, password: string) => Promise<{ error?: Error }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

let initialized = false
let isSigningIn = false

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

  signIn: async (email, password) => {
    isSigningIn = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      
      // Set user state immediately to prevent UI hanging
      if (data.user) {
        set({ user: data.user, isAuthenticated: true })
        // Fetch profile in background
        fetchProfile(data.user.id).then(profile => {
          if (profile) set({ profile })
        })
      }
      
      return { error: undefined }
    } catch (error) {
      console.error('Sign in error:', error)
      return { error: error as Error }
    } finally {
      // Reset flag after auth state change has time to fire
      setTimeout(() => { isSigningIn = false }, 500)
    }
  },

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
          // Skip if signIn function already handled this (prevents race condition)
          if (isSigningIn) {
            console.log('Skipping redundant SIGNED_IN event — signIn function handled it')
            return
          }
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
          set({ user: null, profile: null, isAuthenticated: false })
        } else if (event === 'INITIAL_SESSION') {
          console.log('Initial session loaded')
          if (session?.user) {
            set({ user: session.user, isAuthenticated: true })
            const profile = await fetchProfile(session.user.id)
            if (profile) set({ profile })
          }
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed')
          // Token refresh doesn't change authentication state, but update user if present
          if (session?.user) {
            set({ user: session.user })
          }
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
