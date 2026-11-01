import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useIsPlatformAdmin } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select } from '@/components/ui/select'
import { Settings, Building2, UserPlus, CheckCircle2, Loader2, ChevronRight, Users } from 'lucide-react'
import { listOrganizations } from '@/lib/platform-admin-client'
import { ConnectionsDialog } from '@/components/settings/ConnectionsDialog'
import TeamManager from '@/components/team/TeamManager'
import { ROLE_LABELS } from '@/lib/labels'

const TENANT_ROLE_OPTIONS = [
  { value: 'admin', label: ROLE_LABELS.admin },
  { value: 'member', label: ROLE_LABELS.member },
]

function CreateTenantCard() {
  const { toast } = useToast()
  const [orgName, setOrgName] = useState('')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [userRole, setUserRole] = useState('admin')
  const [isCreating, setIsCreating] = useState(false)
  const [result, setResult] = useState<{ organization: { id: string; name: string }; user: { id: string; email: string } } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setResult(null)

    try {
      const { data, error } = await supabase.functions.invoke('create-tenant', {
        body: {
          organization_name: orgName.trim(),
          user_email: userEmail.trim(),
          user_full_name: userName.trim(),
          user_password: userPassword,
          user_role: userRole,
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)
      if (!data?.success) throw new Error(data?.error || 'Onbekende fout bij aanmaken organisatie')

      setResult(data)
      toast({ title: 'Organisatie aangemaakt', description: `${data.organization.name} is succesvol aangemaakt met beheerder ${data.user.email}` })
      setOrgName('')
      setUserName('')
      setUserEmail('')
      setUserPassword('')
      setUserRole('admin')
    } catch (err) {
      toast({ title: 'Fout bij aanmaken', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>Nieuwe organisatie en gebruiker</CardTitle>
        </div>
        <CardDescription>
          Maak een nieuwe organisatie aan met een beheerdersaccount. De gebruiker kan direct inloggen met het opgegeven wachtwoord.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tenant-org-name">Organisatienaam</Label>
            <Input
              id="tenant-org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Bijv. Acme BV"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tenant-user-name">Naam gebruiker</Label>
            <Input
              id="tenant-user-name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Bijv. Jan de Vries"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tenant-user-email">E-mailadres</Label>
            <Input
              id="tenant-user-email"
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="jan@acme.nl"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tenant-user-password">Wachtwoord</Label>
            <Input
              id="tenant-user-password"
              type="password"
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              placeholder="Minimaal 6 tekens"
              minLength={6}
              required
            />
            <p className="text-xs text-muted-foreground">
              Geef dit wachtwoord aan de gebruiker. Later kan uitnodiging per e-mail worden toegevoegd.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tenant-user-role">Rol</Label>
            <Select
              value={userRole}
              onValueChange={setUserRole}
              options={TENANT_ROLE_OPTIONS}
            />
          </div>

          <Button type="submit" disabled={isCreating}>
            {isCreating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aanmaken...</>
            ) : (
              <><UserPlus className="h-4 w-4 mr-2" /> Organisatie aanmaken</>
            )}
          </Button>

          {result && (
            <div className="flex items-start gap-2 p-3 rounded-md text-sm bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Organisatie aangemaakt</p>
                <p className="text-xs mt-1">Organisatiecode: <code>{result.organization.id}</code></p>
                <p className="text-xs">Gebruiker: <code>{result.user.email}</code> (code: <code>{result.user.id}</code>)</p>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function SettingsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedOrg = searchParams.get('org') ?? ''
  const [activeTab, setActiveTab] = useState(() => (selectedOrg ? 'team' : 'assistants'))
  const [connectionsOpen, setConnectionsOpen] = useState(false)
  const { data: isPlatformAdmin, isPending: isCheckingAccess } = useIsPlatformAdmin()

  // Platform-admin-only data; the Edge Function enforces the same rule.
  const { data: organizations, isPending: organizationsPending } = useQuery({
    queryKey: ['platform-organizations'],
    queryFn: listOrganizations,
    enabled: isPlatformAdmin === true,
  })

  if (isCheckingAccess) {
    return (
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 mt-2" />
        <Skeleton className="h-24 w-full max-w-2xl mt-8" />
      </div>
    )
  }

  if (!isPlatformAdmin) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Geen toegang</CardTitle>
          <CardDescription>
            Alleen de platformbeheerder kan de instellingen bekijken en wijzigen.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Instellingen</h1>
        <p className="text-muted-foreground">Beheer de assistentcatalogus, de koppelingen, teams en organisaties</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="assistants">Assistenten</TabsTrigger>
          <TabsTrigger value="team">
            <Users className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Team
          </TabsTrigger>
          <TabsTrigger value="tenant">
            <Building2 className="h-4 w-4 mr-1.5" />
            Nieuwe organisatie
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assistants">
          <div className="space-y-6">
            <div>
              <Button
                variant="outline"
                onClick={() => setConnectionsOpen(true)}
                aria-label="Koppelingen"
              >
                <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
                Koppelingen
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Headernaam, secret en de webhook-URL's voor alle organisaties.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-1">Organisaties</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Kies een organisatie om te bepalen welke assistenten daar aan staan.
              </p>

              {organizationsPending ? (
                <div className="space-y-3 max-w-2xl">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (organizations ?? []).length === 0 ? (
                <Card className="max-w-2xl">
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    Er zijn nog geen organisaties.
                  </CardContent>
                </Card>
              ) : (
                <ul className="space-y-3 max-w-2xl">
                  {(organizations ?? []).map((organization) => (
                    <li key={organization.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/settings/organizations/${organization.id}`)}
                        className="w-full flex items-center justify-between gap-3 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <span className="text-sm font-medium">{organization.name}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="team">
          <div className="max-w-5xl space-y-4">
            <div className="max-w-md space-y-2">
              <Label htmlFor="settings-team-org">Organisatie</Label>
              {organizationsPending ? (
                <Skeleton className="h-9 w-full" />
              ) : (organizations ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Er zijn nog geen organisaties.</p>
              ) : (
                <Select
                  id="settings-team-org"
                  value={selectedOrg}
                  onValueChange={(value) => {
                    if (!value) return
                    setSearchParams({ org: value })
                    setActiveTab('team')
                  }}
                  options={(organizations ?? []).map((organization) => ({
                    value: organization.id,
                    label: organization.name,
                  }))}
                  placeholder="Kies een organisatie"
                />
              )}
            </div>

            {selectedOrg ? (
              <TeamManager organizationId={selectedOrg} />
            ) : (
              <Card className="max-w-2xl">
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Kies een organisatie.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tenant">
          <CreateTenantCard />
        </TabsContent>
      </Tabs>

      <ConnectionsDialog open={connectionsOpen} onOpenChange={setConnectionsOpen} />
    </div>
  )
}

export default SettingsPage
