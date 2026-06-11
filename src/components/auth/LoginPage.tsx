import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/authStore'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const signIn = useAuthStore((s) => s.signIn)
  const isSigningIn = useAuthStore((s) => s.isSigningIn)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const navigate = useNavigate()
  const { toast } = useToast()

  console.log('[LoginPage] render, isSigningIn:', isSigningIn)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)

    console.log('[LoginPage] handleLogin called for:', email)

    const { error } = await signIn(email, password)

    if (error) {
      console.error('[LoginPage] signIn returned error:', error.message)
      setLoginError(error.message)
      toast({
        title: 'Inloggen mislukt',
        description: error.message,
        variant: 'destructive',
      })
      return
    }

    console.log('[LoginPage] signIn success, isAuthenticated:', isAuthenticated)

    const redirectUrl = localStorage.getItem('redirectAfterLogin') || '/command-center'
    localStorage.removeItem('redirectAfterLogin')

    navigate(redirectUrl, { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Darwin</CardTitle>
          <CardDescription>Log in met je e-mailadres en wachtwoord</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="naam@organisatie.nl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {loginError && (
              <p className="text-sm text-destructive">{loginError}</p>
            )}
            <Button type="submit" disabled={isSigningIn}>
              {isSigningIn ? 'Inloggen...' : 'Inloggen'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            <Link to="/forgot-password" className="hover:text-primary">
              Wachtwoord vergeten?
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginPage