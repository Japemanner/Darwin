import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui/toast'
import LoginPage from '@/components/auth/LoginPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'

const CommandCenterPage = lazy(() => import('@/pages/CommandCenterPage'))
const AssistantsPage = lazy(() => import('@/pages/AssistantsPage'))
const KnowledgePage = lazy(() => import('@/pages/KnowledgePage'))
const TeamPage = lazy(() => import('@/pages/TeamPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'))

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
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/command-center" element={<CommandCenterPage />} />
                  <Route path="/assistants" element={<AssistantsPage />} />
                  <Route path="/knowledge" element={<KnowledgePage />} />
                  <Route path="/team" element={<TeamPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/command-center" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
