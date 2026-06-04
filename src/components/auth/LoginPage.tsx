import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      console.log('Attempting login for email:', email)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      toast({ title: 'Ingelogd', description: 'Welkom terug!' })
      console.log('Login successful for email:', email)
      
      // Redirect back to original URL or default to command center
      const redirectUrl = localStorage.getItem('redirectAfterLogin') || '/command-center'
      console.log('Redirecting to:', redirectUrl)
      localStorage.removeItem('redirectAfterLogin') // Clean up
      navigate(redirectUrl)
    } catch (err) {
      console.error('Login error for email:', email, err)
      toast({
        title: 'Inloggen mislukt',
        description: err instanceof Error ? err.message : 'Onbekende fout',
        variant: 'destructive',
       })
    } finally {
      setIsLoading(false)
    }
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Inloggen...' : 'Inloggen'}
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
