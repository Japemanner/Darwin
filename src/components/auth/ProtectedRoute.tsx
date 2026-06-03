import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    // Store the attempted URL so we can redirect back after login
    localStorage.setItem('redirectAfterLogin', location.pathname + location.search)
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
