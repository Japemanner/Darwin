import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, profile, isLoading, isAuthenticated, signIn, signOut } = useAuthStore()
  return { user, profile, isLoading, isAuthenticated, signIn, signOut }
}
