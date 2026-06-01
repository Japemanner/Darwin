import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { encryptToken } from '@/lib/webhook'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Settings } from 'lucide-react'
import type { FlowConfig } from '@/types/database.types'

function SettingsPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [config, setConfig] = useState<FlowConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookToken, setWebhookToken] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    const loadConfig = async () => {
      const { data } = await (supabase as any).from('flow_configs') // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        .select('*')
        .eq('flow_type', 'rag_chat')
        .eq('organization_id', profile.organization_id)
        .single()
      if (data) {
        setConfig(data as FlowConfig)
        setWebhookUrl((data as FlowConfig).webhook_url)
      }
      setIsLoading(false)
    }
    loadConfig()
  }, [profile])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!webhookUrl.trim() || !profile) return
    setIsSaving(true)

    try {
      const tokenToSave = webhookToken.trim()
        ? await encryptToken(webhookToken.trim())
        : config?.webhook_token ?? ''

      const payload = {
        flow_type: 'rag_chat' as const,
        webhook_url: webhookUrl.trim(),
        webhook_token: tokenToSave,
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
            Configureer de gedeelde N8N webhook voor alle chat assistants. Deze instelling geldt voor alle assistants van type &quot;chat&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://n8n.example.com/webhook/rag-chat"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="webhook-token">Webhook Token</Label>
              <Input
                id="webhook-token"
                type="password"
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                placeholder={config ? '•••••••• (laat leeg om huidige token te behouden)' : 'sk-your-token'}
              />
              <p className="text-xs text-muted-foreground">
                {config
                  ? 'Laat leeg om de bestaande token te behouden. De token wordt versleuteld opgeslagen.'
                  : 'De token wordt versleuteld opgeslagen en is nooit zichtbaar in API responses.'}
              </p>
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Opslaan...' : config ? 'Bijwerken' : 'Configuratie aanmaken'}
            </Button>
          </form>
        </CardContent>
      </Card>

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
