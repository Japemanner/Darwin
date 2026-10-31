import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import {
  getConnections,
  saveConnections,
  testConnection,
  PlatformAdminClientError,
} from '@/lib/platform-admin-client'
import type { ConnectionTestResult } from '@/lib/platform-admin-client'
import { assistantTypeLabel } from '@/lib/labels'
import { CheckCircle2, XCircle } from 'lucide-react'

// Central n8n connection window (feature 019, US2/FR-013..FR-017).
// The secret is write-only: the field is always empty on open and an empty
// value on save keeps the stored token.
interface AssistantForm {
  catalog_id: string
  name: string
  type: string
  test: string
  prod: string
}

interface ConnectionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ConnectionsDialog({ open, onOpenChange }: ConnectionsDialogProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [authHeader, setAuthHeader] = useState('X-Webhook-Token')
  const [token, setToken] = useState('')
  const [hasToken, setHasToken] = useState(false)
  const [documentUrl, setDocumentUrl] = useState('')
  const [assistants, setAssistants] = useState<AssistantForm[]>([])
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult>>({})
  const [testingId, setTestingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    setIsLoading(true)
    setLoadError(null)
    setToken('')
    setTestResults({})

    getConnections()
      .then((info) => {
        if (cancelled) return
        setAuthHeader(info.auth_header || 'X-Webhook-Token')
        setHasToken(info.has_token)
        setDocumentUrl(info.document_webhook_url ?? '')
        setAssistants(
          info.assistants.map((assistant) => ({
            catalog_id: assistant.catalog_id,
            name: assistant.name,
            type: assistant.type,
            test: assistant.test_webhook_url ?? '',
            prod: assistant.prod_webhook_url ?? '',
          })),
        )
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'De koppelingen konden niet worden geladen.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const updateAssistant = (catalogId: string, field: 'test' | 'prod', value: string) => {
    setAssistants((prev) =>
      prev.map((assistant) =>
        assistant.catalog_id === catalogId ? { ...assistant, [field]: value } : assistant,
      ),
    )
    setTestResults((prev) => {
      if (!prev[catalogId]) return prev
      const next = { ...prev }
      delete next[catalogId]
      return next
    })
  }

  const handleTest = async (assistant: AssistantForm) => {
    if (!assistant.prod.trim()) {
      toast({ title: 'Voer eerst een productie-URL in', variant: 'destructive' })
      return
    }

    setTestingId(assistant.catalog_id)
    try {
      const result = await testConnection(assistant.prod.trim())
      setTestResults((prev) => ({ ...prev, [assistant.catalog_id]: result }))
      toast({
        title: result.ok ? 'Verbinding geslaagd' : 'Verbinding mislukt',
        description: result.message,
        ...(result.ok ? {} : { variant: 'destructive' as const }),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout bij het testen.'
      setTestResults((prev) => ({
        ...prev,
        [assistant.catalog_id]: { ok: false, status: 0, message },
      }))
      toast({ title: 'Verbinding mislukt', description: message, variant: 'destructive' })
    } finally {
      setTestingId(null)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const result = await saveConnections({
        auth_header: authHeader,
        ...(token.trim() ? { token: token.trim() } : {}),
        document_webhook_url: documentUrl.trim() || null,
        assistants: assistants.map((assistant) => ({
          catalog_id: assistant.catalog_id,
          test_webhook_url: assistant.test.trim() || null,
          prod_webhook_url: assistant.prod.trim() || null,
        })),
      })

      setHasToken(result.has_token)
      setToken('')
      toast({ title: 'Koppelingen opgeslagen', description: 'De instellingen gelden voor alle organisaties.' })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof PlatformAdminClientError || err instanceof Error
        ? err.message
        : 'Onbekende fout bij het opslaan.'
      toast({ title: 'Fout bij opslaan', description: message, variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleSave}>
        <DialogHeader>
          <DialogTitle>Koppelingen</DialogTitle>
          <DialogDescription>
            Deze instellingen gelden voor alle organisaties.
          </DialogDescription>
        </DialogHeader>

        <DialogContent className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" /> Koppelingen laden...
            </div>
          ) : loadError ? (
            <p className="text-sm text-destructive" role="alert">{loadError}</p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="connections-auth-header">Headernaam</Label>
                <Input
                  id="connections-auth-header"
                  value={authHeader}
                  onChange={(e) => setAuthHeader(e.target.value)}
                  placeholder="X-Webhook-Token"
                />
                <p className="text-xs text-muted-foreground">
                  De naam van de HTTP-header die alle n8n-webhooks verwachten.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="connections-token">Secret</Label>
                <Input
                  id="connections-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={hasToken ? 'Secret is ingesteld; laat leeg om te behouden' : 'Voer het secret in'}
                />
                <p className="text-xs text-muted-foreground">
                  {hasToken
                    ? 'Het secret is opgeslagen en na het opslaan niet meer uit te lezen. Laat het veld leeg om het bestaande secret te behouden.'
                    : 'Eén secret voor alle n8n-webhooks. Na opslaan is het niet meer uit te lezen.'}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="connections-document-url">Productie-URL documentverwerking</Label>
                <Input
                  id="connections-document-url"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  placeholder="https://n8n.example.com/webhook/documents"
                />
                <p className="text-xs text-muted-foreground">
                  Gebruik de productie-URL uit n8n (bevat <code>/webhook/</code>, niet <code>/webhook-test/</code>).
                </p>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-3">Assistenten</h3>
                <div className="space-y-5">
                  {assistants.map((assistant) => {
                    const result = testResults[assistant.catalog_id]
                    const isTesting = testingId === assistant.catalog_id
                    return (
                      <div key={assistant.catalog_id} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{assistant.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {assistantTypeLabel(assistant.type)}
                          </Badge>
                        </div>

                        <Label htmlFor={`connections-test-${assistant.catalog_id}`}>
                          {`Test-URL — ${assistant.name}`}
                        </Label>
                        <Input
                          id={`connections-test-${assistant.catalog_id}`}
                          value={assistant.test}
                          onChange={(e) => updateAssistant(assistant.catalog_id, 'test', e.target.value)}
                          placeholder="https://n8n.example.com/webhook-test/…"
                        />

                        <Label htmlFor={`connections-prod-${assistant.catalog_id}`}>
                          {`Productie-URL — ${assistant.name}`}
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id={`connections-prod-${assistant.catalog_id}`}
                            value={assistant.prod}
                            onChange={(e) => updateAssistant(assistant.catalog_id, 'prod', e.target.value)}
                            placeholder="https://n8n.example.com/webhook/…"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isTesting || !assistant.prod.trim()}
                            onClick={() => handleTest(assistant)}
                          >
                            {isTesting ? (
                              <><Spinner className="h-4 w-4 mr-2" /> Testen...</>
                            ) : (
                              'Verbinding testen'
                            )}
                          </Button>
                        </div>

                        {result && (
                          <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${result.ok ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'}`}>
                            {result.ok
                              ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                              : <XCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />}
                            <span>{result.message}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </DialogContent>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button type="submit" disabled={isSaving || isLoading || !!loadError}>
            {isSaving ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

export { ConnectionsDialog }
