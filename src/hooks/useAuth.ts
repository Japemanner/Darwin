import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, profile, isLoading, isAuthenticated, signOut } = useAuthStore()
  return { user, profile, isLoading, isAuthenticated, signOut }
}
