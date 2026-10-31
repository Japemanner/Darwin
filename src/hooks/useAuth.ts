import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, profile, isLoading, isAuthenticated, signIn, signOut } = useAuthStore()
  return { user, profile, isLoading, isAuthenticated, signIn, signOut }
}

// Platform administrator check (feature 019, FR-001/FR-012). The server is the
// only authority; this hook mirrors `is_platform_admin()` for the UI so the
// menu entry and the route gate match what the Edge Functions enforce.
export function useIsPlatformAdmin() {
  const userId = useAuthStore((s) => s.user?.id)

  return useQuery<boolean>({
    queryKey: ['is-platform-admin', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_platform_admin')
      if (error) throw error
      return data === true
    },
  })
}
