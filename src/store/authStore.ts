import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database.types'
import { supabase } from '@/lib/supabase'
import { identifyUser, resetUser } from '@/lib/posthog'

interface AuthState {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isSigningIn: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  signIn: (email: string, password: string) => Promise<{ error?: Error }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

let initialized = false

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('[auth] Profile fetch error:', error.message)
      return null
    }

    return data as Profile | null
  } catch (err) {
    console.error('[auth] Profile fetch exception:', err)
    return null
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isSigningIn: false,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setProfile: (profile) => set({ profile }),

  signIn: async (email, password) => {
    set({ isSigningIn: true })

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        console.error('[auth] signIn error:', error.message)
        set({ isSigningIn: false })
        return { error: new Error(error.message) }
      }

      set({
        user: data.user,
        isAuthenticated: true,
        isSigningIn: false,
      })

      fetchProfile(data.user.id).then((profile) => {
        if (profile) {
          set({ profile })
        }
      })

      return { error: undefined }
    } catch (err) {
      console.error('[auth] signIn exception:', err)
      set({ isSigningIn: false })
      return { error: err as Error }
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // session already invalid
    }
    set({ user: null, profile: null, isAuthenticated: false, isSigningIn: false })
  },

  initialize: async () => {
    if (initialized) return

    supabase.auth.onAuthStateChange((event, session) => {
      const state = get()

      if (event === 'SIGNED_IN' && session?.user) {
        if (state.isSigningIn) {
          return
        }
        identifyUser(session.user.id)
        set({ user: session.user, isAuthenticated: true })
        fetchProfile(session.user.id).then((profile) => {
          if (profile) set({ profile })
        })
        return
      }

      if (event === 'SIGNED_OUT') {
        resetUser()
        set({ user: null, profile: null, isAuthenticated: false, isSigningIn: false })
        return
      }

      if (session?.user) {
        identifyUser(session.user.id)
        const profilePromise = state.profile
          ? Promise.resolve(state.profile)
          : fetchProfile(session.user.id)
        set({ user: session.user, isAuthenticated: true })
        profilePromise.then((profile) => {
          if (profile) set({ profile })
        })
      }
    })

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        set({ user: session.user, isAuthenticated: true })
        fetchProfile(session.user.id).then((profile) => {
          if (profile) set({ profile })
        })
      }
    } catch (err) {
      console.error('[auth] getSession error:', err)
    } finally {
      set({ isLoading: false })
      initialized = true
    }
  },
}))