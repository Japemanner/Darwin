import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setHasSession(true)
      }
      setIsCheckingSession(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 8) {
      toast({
        title: 'Wachtwoord te kort',
        description: 'Je wachtwoord moet minimaal 8 tekens bevatten.',
        variant: 'destructive',
      })
      return
    }

    if (password !== confirm) {
      toast({
        title: 'Wachtwoorden komen niet overeen',
        description: 'Controleer of beide velden hetzelfde wachtwoord bevatten.',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast({
        title: 'Wachtwoord aangepast',
        description: 'Je kunt nu inloggen met je nieuwe wachtwoord.',
      })
      await supabase.auth.signOut()
      navigate('/login')
    } catch (err) {
      toast({
        title: 'Fout bij aanpassen',
        description: err instanceof Error ? err.message : 'Onbekende fout',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Link verlopen</CardTitle>
            <CardDescription>
              Deze reset-link is verlopen of ongeldig. Vraag een nieuwe aan.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/forgot-password">
              <Button>Nieuwe reset-link aanvragen</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Nieuw wachtwoord</CardTitle>
          <CardDescription>
            Kies een nieuw wachtwoord voor je account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Nieuw wachtwoord</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimaal 8 tekens"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm">Bevestig wachtwoord</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Herhaal je wachtwoord"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Opslaan...' : 'Wachtwoord opslaan'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default ResetPasswordPage
