import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Public invitation activation route (feature 020).
// Contract: specs/020-team-management/contracts/auth-confirm.md
// The one-time token_hash is removed from the address bar before verifyOtp; it
// never reaches storage, logs or analytics.

const EXPIRED_MESSAGE =
  'Deze uitnodigingslink is verlopen of al gebruikt. Vraag uw beheerder om een nieuwe uitnodiging.'
const ACTIVATION_FAILED_MESSAGE =
  'Uw account kon niet worden geactiveerd. Neem contact op met uw beheerder.'

function AuthConfirmPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      const type = params.get('type')

      // Remove the token before any further auth call or analytics pageview.
      window.history.replaceState({}, document.title, window.location.pathname)

      if (!tokenHash || type !== 'invite') {
        if (!cancelled) {
          setMessage(EXPIRED_MESSAGE)
          setStatus('error')
        }
        return
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'invite',
      })

      if (error) {
        if (!cancelled) {
          setMessage(EXPIRED_MESSAGE)
          setStatus('error')
        }
        return
      }

      const { error: activateError } = await supabase.rpc('activate_own_profile')
      if (activateError) {
        // Do not leave an invited session behind: without the status change the
        // account must not enter the app.
        try {
          await supabase.auth.signOut()
        } catch {
          // session already invalid
        }
        if (!cancelled) {
          setMessage(ACTIVATION_FAILED_MESSAGE)
          setStatus('error')
        }
        return
      }

      if (!cancelled) {
        navigate('/reset-password', { replace: true })
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [navigate])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Uitnodiging</CardTitle>
          <CardDescription>Uw account activeren</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-destructive" role="alert">{message}</p>
          <Link to="/login">
            <Button className="w-full">Naar inloggen</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

export default AuthConfirmPage
