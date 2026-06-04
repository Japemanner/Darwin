import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { encryptToken, decryptToken, testWebhook } from '@/lib/webhook'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Settings, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import type { FlowConfig } from '@/types/database.types'
import type { WebhookTestResult } from '@/lib/webhook'

function SettingsPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [config, setConfig] = useState<FlowConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookToken, setWebhookToken] = useState('')
  const [webhookAuthHeader, setWebhookAuthHeader] = useState('X-Webhook-Token')
  const [isSaving, setIsSaving] = useState(false)
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const isTestUrl = webhookUrl.includes('/webhook-test/')

  useEffect(() => {
    if (!profile) return
    const loadConfig = async () => {
      const { data } = await (supabase as any).from('flow_configs') // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        .select('*')
        .eq('flow_type', 'rag_chat')
        .eq('organization_id', profile.organization_id)
        .single()
      if (data) {
        const cfg = data as FlowConfig
        setConfig(cfg)
        setWebhookUrl(cfg.webhook_url)
        setWebhookAuthHeader(cfg.webhook_auth_header || 'X-Webhook-Token')
      }
      setIsLoading(false)
    }
    loadConfig()
  }, [profile])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!webhookUrl.trim() || !profile) return
    setIsSaving(true)
    setTestResult(null)

    try {
      const tokenToSave = webhookToken.trim()
        ? await encryptToken(webhookToken.trim())
        : config?.webhook_token ?? ''

      const payload = {
        flow_type: 'rag_chat' as const,
        webhook_url: webhookUrl.trim(),
        webhook_token: tokenToSave,
        webhook_auth_header: webhookAuthHeader.trim() || 'X-Webhook-Token',
        organization_id: profile.organization_id,
      }

      if (config) {
        const { error } = await (supabase as any).from('flow_configs').update(payload).eq('id', config.id) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        if (error) throw error
        toast({ title: 'Instellingen bijgewerkt', description: 'De RAG configuratie is succesvol opgeslagen' })
      } else {
        const { data: created, error } = await (supabase as any).from('flow_configs').insert(payload).select().single() // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        if (error) throw error
        setConfig(created)
        toast({ title: 'Instellingen opgeslagen', description: 'De RAG configuratie is aangemaakt' })
      }

      const { data: refreshed } = await supabase
        .from('flow_configs')
        .select('*')
        .eq('flow_type', 'rag_chat')
        .eq('organization_id', profile.organization_id)
        .single()
      if (refreshed) setConfig(refreshed)

      setWebhookToken('')
    } catch (err) {
      toast({ title: 'Fout bij opslaan', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    if (!webhookUrl.trim()) {
      toast({ title: 'Voer eerst een webhook URL in', variant: 'destructive' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      let tokenToTest: string | undefined
      if (webhookToken.trim()) {
        tokenToTest = webhookToken.trim()
      } else if (config?.webhook_token) {
        tokenToTest = await decryptToken(config.webhook_token)
      }

      const result = await testWebhook(webhookUrl.trim(), tokenToTest, webhookAuthHeader || 'X-Webhook-Token')
      setTestResult(result)

      if (result.ok) {
        toast({ title: 'Verbinding geslaagd', description: result.message })
      } else {
        toast({ title: 'Verbinding mislukt', description: result.message, variant: 'destructive' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout bij het testen'
      setTestResult({ ok: false, status: 0, message })
      toast({ title: 'Verbinding mislukt', description: message, variant: 'destructive' })
    } finally {
      setIsTesting(false)
    }
  }

  if (isLoading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <Card><CardHeader><Skeleton className="h-6 w-32" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Instellingen</h1>
        <p className="text-muted-foreground">Beheer globale configuraties voor AI flows</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle>RAG Chat Configuratie</CardTitle>
          </div>
          <CardDescription>
            Configureer de gedeelde n8n webhook voor alle chat assistants. Deze instelling geldt voor alle assistants van type &quot;chat&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                value={webhookUrl}
                onChange={(e) => { setWebhookUrl(e.target.value); setTestResult(null) }}
                placeholder="https://n8n.example.com/webhook/rag-chat"
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
              <Label htmlFor="webhook-auth-header">Auth Header Naam</Label>
              <Input
                id="webhook-auth-header"
                value={webhookAuthHeader}
                onChange={(e) => setWebhookAuthHeader(e.target.value)}
                placeholder="X-Webhook-Token"
              />
              <p className="text-xs text-muted-foreground">
                De HTTP-header naam die n8n verwacht. Standaard: <code>X-Webhook-Token</code>. Dit moet overeenkomen met de Header Auth instelling in je n8n Webhook node.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="webhook-token">Webhook Token</Label>
              <Input
                id="webhook-token"
                type="password"
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                placeholder={config ? '•••••••• (laat leeg om huidige token te behouden)' : 'De Header Value uit je n8n Webhook node'}
              />
              <p className="text-xs text-muted-foreground">
                {config
                  ? 'Dit is de Header Value uit je n8n Webhook node (Header Auth). De token wordt versleuteld opgeslagen. Laat leeg om de bestaande token te behouden.'
                  : 'Voer de Header Value in uit je n8n Webhook node (Header Auth). De token wordt versleuteld opgeslagen.'}
              </p>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Opslaan...' : config ? 'Bijwerken' : 'Configuratie aanmaken'}
              </Button>
              <Button type="button" variant="outline" disabled={isTesting || !webhookUrl.trim()} onClick={handleTest}>
                {isTesting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testen...</>
                ) : (
                  'Verbinding testen'
                )}
              </Button>
            </div>

            {testResult && (
              <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${testResult.ok ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'}`}>
                {testResult.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">n8n Webhook Configuratie Handleiding</CardTitle>
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
              <p>In de Webhook node → Settings → Authentication → kies <strong>Header Auth</strong>.</p>
              <p>Stel in n8n de Header Name in op <code>X-Webhook-Token</code> en de Header Value op een token naar keuze. Vul dezelfde waarden hierboven in.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">4. Workflow activeren</p>
              <p>Zorg dat de n8n workflow op <strong>Active</strong> staat, anders is de webhook URL niet bereikbaar.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!config && !isLoading && (
        <div className="mt-8 max-w-2xl">
          <EmptyState
            icon={<Settings className="h-12 w-12" />}
            title="Nog niet geconfigureerd"
            description="Stel de RAG webhook in voordat je chat assistants gebruikt. Zonder deze configuratie kunnen assistants geen antwoorden genereren."
          />
        </div>
      )}
    </div>
  )
}

export default SettingsPage