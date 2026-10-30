import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select } from '@/components/ui/select'
import { Settings, FileText, CheckCircle2, XCircle, Loader2, AlertTriangle, Building2, UserPlus } from 'lucide-react'
import { getFlowConfig, saveFlowConfig, testFlowConfig } from '@/lib/flow-config-client'
import { ROLE_LABELS } from '@/lib/labels'
import type { FlowConfigInfo, FlowConfigTestResult } from '@/lib/flow-config-client'

interface FlowConfigFormState {
  webhookUrl: string
  webhookToken: string
  webhookAuthHeader: string
  isSaving: boolean
  testResult: FlowConfigTestResult | null
  isTesting: boolean
}

function FlowConfigCard({
  flowType,
  title,
  description,
  placeholder,
}: {
  flowType: 'rag_chat' | 'document_processing'
  title: string
  description: string
  placeholder: string
}) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data: config, isPending } = useQuery<FlowConfigInfo>({
    queryKey: ['flow-config', flowType],
    queryFn: () => getFlowConfig(flowType),
  })
  const [state, setState] = useState<FlowConfigFormState>({
    webhookUrl: '',
    webhookToken: '',
    webhookAuthHeader: 'X-Webhook-Token',
    isSaving: false,
    testResult: null,
    isTesting: false,
  })

  const isTestUrl = state.webhookUrl.includes('/webhook-test/')

  useEffect(() => {
    if (config) {
      setState((prev) => ({
        ...prev,
        webhookUrl: config.webhook_url,
        webhookAuthHeader: config.webhook_auth_header || 'X-Webhook-Token',
      }))
    }
  }, [config])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.webhookUrl.trim()) return
    setState((prev) => ({ ...prev, isSaving: true, testResult: null }))

    try {
      await saveFlowConfig(flowType, {
        webhook_url: state.webhookUrl.trim(),
        webhook_auth_header: state.webhookAuthHeader.trim() || 'X-Webhook-Token',
        webhook_token: state.webhookToken.trim() || undefined,
      })

      await qc.invalidateQueries({ queryKey: ['flow-config', flowType] })

      if (config?.webhook_url) {
        toast({ title: 'Instellingen bijgewerkt', description: `${title} is succesvol opgeslagen` })
      } else {
        toast({ title: 'Instellingen opgeslagen', description: `${title} is aangemaakt` })
      }

      setState((prev) => ({ ...prev, webhookToken: '' }))
    } catch (err) {
      toast({ title: 'Fout bij opslaan', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    } finally {
      setState((prev) => ({ ...prev, isSaving: false }))
    }
  }

  const handleTest = async () => {
    if (!state.webhookUrl.trim()) {
      toast({ title: 'Voer eerst een webhook-URL in', variant: 'destructive' })
      return
    }

    setState((prev) => ({ ...prev, isTesting: true, testResult: null }))

    try {
      const result = await testFlowConfig(flowType, {
        webhook_url: state.webhookUrl.trim(),
        webhook_auth_header: state.webhookAuthHeader || 'X-Webhook-Token',
        webhook_token: state.webhookToken.trim() || undefined,
      })
      setState((prev) => ({ ...prev, testResult: result }))

      if (result.ok) {
        toast({ title: 'Verbinding geslaagd', description: result.message })
      } else {
        toast({ title: 'Verbinding mislukt', description: result.message, variant: 'destructive' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout bij het testen'
      setState((prev) => ({ ...prev, testResult: { ok: false, status: 0, message } }))
      toast({ title: 'Verbinding mislukt', description: message, variant: 'destructive' })
    } finally {
      setState((prev) => ({ ...prev, isTesting: false }))
    }
  }

  if (isPending) {
    return (
      <Card className="max-w-2xl">
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          {flowType === 'document_processing' ? <FileText className="h-5 w-5 text-primary" /> : <Settings className="h-5 w-5 text-primary" />}
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${flowType}-webhook-url`}>Webhook URL</Label>
            <Input
              id={`${flowType}-webhook-url`}
              value={state.webhookUrl}
              onChange={(e) => setState((prev) => ({ ...prev, webhookUrl: e.target.value, testResult: null }))}
              placeholder={placeholder}
              required
            />
            {isTestUrl && (
              <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-md">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Dit lijkt een n8n test-URL. Gebruik de productie-URL (<code>/webhook/</code>) in plaats van de test-URL (<code>/webhook-test/</code>).</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Gebruik de productie-URL uit n8n (bevat <code>/webhook/</code>, niet <code>/webhook-test/</code>).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${flowType}-auth-header`}>Naam autorisatieheader</Label>
            <Input
              id={`${flowType}-auth-header`}
              value={state.webhookAuthHeader}
              onChange={(e) => setState((prev) => ({ ...prev, webhookAuthHeader: e.target.value }))}
              placeholder="X-Webhook-Token"
            />
            <p className="text-xs text-muted-foreground">
              De naam van de HTTP-header die n8n verwacht. Standaard: <code>X-Webhook-Token</code>. Dit moet overeenkomen met de instelling Header Auth in uw n8n Webhook node.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${flowType}-token`}>Webhook Token</Label>
            <Input
              id={`${flowType}-token`}
              type="password"
              value={state.webhookToken}
              onChange={(e) => setState((prev) => ({ ...prev, webhookToken: e.target.value }))}
              placeholder={config?.has_token ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (Token is ingesteld; laat leeg om te behouden)' : 'De Header Value uit uw n8n Webhook node'}
            />
            <p className="text-xs text-muted-foreground">
              {config?.has_token
                ? 'Dit is de Header Value uit uw n8n Webhook node (Header Auth). De token wordt aan de serverkant opgeslagen en is na het opslaan niet meer uit te lezen. Laat leeg om de bestaande token te behouden.'
                : 'Voer de Header Value in uit uw n8n Webhook node (Header Auth). De token wordt aan de serverkant opgeslagen en is na het opslaan niet meer uit te lezen.'}
            </p>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={state.isSaving}>
              {state.isSaving ? 'Opslaan...' : config?.webhook_url ? 'Bijwerken' : 'Configuratie aanmaken'}
            </Button>
            <Button type="button" variant="outline" disabled={state.isTesting || !state.webhookUrl.trim()} onClick={handleTest}>
              {state.isTesting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testen...</>
              ) : (
                'Verbinding testen'
              )}
            </Button>
          </div>

          {state.testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${state.testResult.ok ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'}`}>
              {state.testResult.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{state.testResult.message}</span>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

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
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('webhooks')

  if (!profile) return null

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Instellingen</h1>
        <p className="text-muted-foreground">Beheer globale configuraties en organisaties</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="tenant">
            <Building2 className="h-4 w-4 mr-1.5" />
            Nieuwe organisatie
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks">
          <div className="space-y-6">
            {profile.role === 'admin' ? (
              <>
                <FlowConfigCard
                  flowType="rag_chat"
                  title="Chatassistent-configuratie"
                  description="Configureer de gedeelde n8n-webhook voor alle chatassistenten. Deze instelling geldt voor alle assistenten van het type &quot;chat&quot;."
                  placeholder="https://n8n.example.com/webhook/rag-chat"
                />

                <FlowConfigCard
                  flowType="document_processing"
                  title="Configuratie kennisbron-documentverwerking"
                  description="Configureer de n8n-webhook voor documentverwerking. Bij elke documentaanlevering maakt de server de ondertekende ophaal-URL en stuurt die naar de webhook."
                  placeholder="https://n8n.example.com/webhook/documents"
                />
              </>
            ) : (
              <Card className="max-w-2xl">
                <CardHeader>
                  <CardTitle className="text-base">Geen toegang</CardTitle>
                  <CardDescription>
                    Alleen beheerders kunnen de webhookconfiguratie bekijken en wijzigen. Neem contact op met de beheerder van uw organisatie.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            <div className="max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Handleiding n8n-webhookconfiguratie</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <div>
                    <p className="font-medium text-foreground">1. Webhook URL</p>
                    <p>In n8n: open de Webhook node → kopieer de <strong>Production URL</strong> (bevat <code>/webhook/</code>). Gebruik niet de Test URL (<code>/webhook-test/</code>).</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">2. CORS</p>
                    <p>In de Webhook node → Settings → zet <strong>CORS op Enabled</strong> met Allow Origin <code>*</code>.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">3. Authenticatie</p>
                    <p>In de Webhook node → Settings → Authentication → kies <strong>Header auth</strong>.</p>
                    <p>Stel in n8n de Header Name in op <code>X-Webhook-Token</code> en de Header Value op een token naar keuze. Vul dezelfde waarden hierboven in.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">4. Werkstroom activeren</p>
                    <p>Zorg dat de n8n-werkstroom op <strong>Active</strong> staat, anders is de webhook-URL niet bereikbaar.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">5. Documentverwerking</p>
                    <p>Maak een aparte n8n-werkstroom voor documentverwerking. Deze webhook ontvangt bij elke aanlevering een bericht met <code>tenantId</code>, <code>knowledgeSourceName</code>, <code>document_name</code>, <code>document_type</code> en <code>download_url</code>. De ophaal-URL is 15 minuten geldig.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tenant">
          <CreateTenantCard />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default SettingsPage