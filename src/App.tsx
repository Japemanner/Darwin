import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui/toast'
import LoginPage from '@/components/auth/LoginPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'

const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const AssistantsPage = lazy(() => import('@/pages/AssistantsPage'))
const KnowledgePage = lazy(() => import('@/pages/KnowledgePage'))
const TeamPage = lazy(() => import('@/pages/TeamPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

const queryClient = new QueryClient()

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

function App() {
  const initialize = useAuthStore((s) => s.initialize)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initialize().catch(() => {}).finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/assistants" element={<AssistantsPage />} />
                  <Route path="/knowledge" element={<KnowledgePage />} />
                  <Route path="/team" element={<TeamPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
