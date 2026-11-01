import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database.types'
import { supabase } from '@/lib/supabase'
import { unsubscribeThisDeviceQuietly } from '@/lib/push/client'
import { identifyUser, resetUser } from '@/lib/posthog'

interface AuthState {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isSigningIn: boolean
  isAuthenticated: boolean
  authError: string | null
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  clearAuthError: () => void
  signIn: (email: string, password: string) => Promise<{ error?: Error }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

const BLOCKED_OR_ORPHANED =
  'Uw account is geblokkeerd of niet gekoppeld aan een organisatie. Neem contact op met uw beheerder.'

type ProfileFetchResult =
  | { profile: Profile; error: null }
  | { profile: null; error: 'not_found' | 'failed' }

let initialized = false

async function fetchProfile(userId: string): Promise<ProfileFetchResult> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      // No PII in the log: the error code is enough to diagnose.
      console.error('[auth] Profile fetch failed', { code: error.code })
      return { profile: null, error: 'failed' }
    }

    if (!data) {
      return { profile: null, error: 'not_found' }
    }

    return { profile: data as Profile, error: null }
  } catch (err) {
    console.error('[auth] Profile fetch exception', {
      code: (err as { code?: string } | null)?.code,
    })
    return { profile: null, error: 'failed' }
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  // A missing profile after a valid session means the account is blocked (the
  // profile row is no longer readable through RLS) or orphaned. Sign out and
  // pass the message through the store, never through the URL.
  const signOutWithMessage = async (message: string) => {
    try {
      await supabase.auth.signOut()
    } catch {
      // Session already invalid.
    }
    set({
      user: null,
      profile: null,
      isAuthenticated: false,
      isSigningIn: false,
      authError: message,
    })
  }

  const applyProfile = async (userId: string): Promise<'ok' | 'missing' | 'failed'> => {
    const result = await fetchProfile(userId)
    if (result.error === null) {
      set({ profile: result.profile })
      return 'ok'
    }
    if (result.error === 'not_found') {
      await signOutWithMessage(BLOCKED_OR_ORPHANED)
      return 'missing'
    }
    // Network/server error: keep the session; the next read can retry.
    return 'failed'
  }

  return {
    user: null,
    profile: null,
    isLoading: true,
    isSigningIn: false,
    isAuthenticated: false,
    authError: null,

    setUser: (user) => set({ user, isAuthenticated: !!user }),

    setProfile: (profile) => set({ profile }),

    clearAuthError: () => set({ authError: null }),

    signIn: async (email, password) => {
      set({ isSigningIn: true, authError: null })

      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
          console.error('[auth] signIn error:', error.code)
          set({ isSigningIn: false })
          return { error: new Error(error.message) }
        }

        set({
          user: data.user,
          isAuthenticated: true,
          isSigningIn: false,
        })

        const result = await applyProfile(data.user.id)
        if (result === 'missing') {
          return { error: new Error(BLOCKED_OR_ORPHANED) }
        }

        return { error: undefined }
      } catch (err) {
        console.error('[auth] signIn exception:', (err as { code?: string } | null)?.code)
        set({ isSigningIn: false })
        return { error: err as Error }
      }
    },

    signOut: async () => {
      const { user } = get()
      // Stop notifications on THIS device before the session is revoked; a push
      // failure never blocks logout (spec US4, FR-017).
      if (user) {
        await unsubscribeThisDeviceQuietly(user.id)
      }
      set({ authError: null })
      try {
        await supabase.auth.signOut()
      } catch {
        // session already invalid
      }
      set({ user: null, profile: null, isAuthenticated: false, isSigningIn: false, authError: null })
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
          void applyProfile(session.user.id)
          return
        }

        if (event === 'SIGNED_OUT') {
          resetUser()
          set({
            user: null,
            profile: null,
            isAuthenticated: false,
            isSigningIn: false,
            // Preserve a blocked/orphan message set by applyProfile; a normal
            // sign-out clears it in the signOut action above.
            authError: state.authError,
          })
          return
        }

        if (session?.user) {
          identifyUser(session.user.id)
          set({ user: session.user, isAuthenticated: true })
          if (!state.profile) {
            void applyProfile(session.user.id)
          }
        }
      })

      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          set({ user: session.user, isAuthenticated: true })
          await applyProfile(session.user.id)
        }
      } catch (err) {
        console.error('[auth] getSession error:', (err as { code?: string } | null)?.code)
      } finally {
        set({ isLoading: false })
        initialized = true
      }
    },
  }
})
