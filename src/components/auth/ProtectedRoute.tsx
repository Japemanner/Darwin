import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
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
    const alreadyRedirected = localStorage.getItem('redirectAfterLogin')
    if (alreadyRedirected) {
      localStorage.removeItem('redirectAfterLogin')
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-destructive font-semibold">Sessie verlopen</p>
            <p className="text-muted-foreground text-sm">Je sessie is verlopen. Log opnieuw in.</p>
            <Link to="/login" className="text-primary text-sm hover:underline">Naar inloggen</Link>
          </div>
        </div>
      )
    }
    localStorage.setItem('redirectAfterLogin', location.pathname + location.search)
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
