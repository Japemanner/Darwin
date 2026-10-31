import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useIsPlatformAdmin } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import {
  listOrganizations,
  listOrgAssistants,
  setAssistantActive,
} from '@/lib/platform-admin-client'
import type { OrgAssistant } from '@/lib/platform-admin-client'
import { assistantTypeLabel } from '@/lib/labels'
import { ArrowLeft } from 'lucide-react'

// Per-organization assistant switches (feature 019, US1/FR-004..FR-007).
// Optimistic toggle with revert and a Dutch error toast on failure.
function SettingsOrganizationPage() {
  const { organizationId = '' } = useParams<{ organizationId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: isPlatformAdmin, isPending: isCheckingAccess } = useIsPlatformAdmin()

  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const { data: organizations } = useQuery({
    queryKey: ['platform-organizations'],
    queryFn: listOrganizations,
    enabled: isPlatformAdmin === true,
  })

  const {
    data: assistants,
    isPending: assistantsPending,
    refetch,
  } = useQuery({
    queryKey: ['platform-org-assistants', organizationId],
    queryFn: () => listOrgAssistants(organizationId),
    enabled: isPlatformAdmin === true && !!organizationId,
  })

  if (isCheckingAccess) {
    return (
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80 mt-2" />
        <div className="flex gap-4 mt-8">
          <Skeleton className="h-32 w-56" />
          <Skeleton className="h-32 w-56" />
        </div>
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

  const organizationName =
    (organizations ?? []).find((organization) => organization.id === organizationId)?.name
    ?? 'Organisatie'

  const handleToggle = async (assistant: OrgAssistant, next: boolean) => {
    setOverrides((prev) => ({ ...prev, [assistant.catalog_id]: next }))
    setSaving((prev) => ({ ...prev, [assistant.catalog_id]: true }))

    try {
      await setAssistantActive(organizationId, assistant.catalog_id, next)
      setOverrides((prev) => {
        const copy = { ...prev }
        delete copy[assistant.catalog_id]
        return copy
      })
      await refetch()
    } catch (err) {
      // Revert to the value from the last successful load.
      setOverrides((prev) => {
        const copy = { ...prev }
        delete copy[assistant.catalog_id]
        return copy
      })
      toast({
        title: 'Fout bij opslaan',
        description: err instanceof Error ? err.message : 'Onbekende fout bij het opslaan.',
        variant: 'destructive',
      })
    } finally {
      setSaving((prev) => ({ ...prev, [assistant.catalog_id]: false }))
    }
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
        Terug naar organisaties
      </Button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">{organizationName}</h1>
        <p className="text-muted-foreground">
          Zet assistenten aan of uit voor deze organisatie.
        </p>
      </div>

      {assistantsPending ? (
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-56 shrink-0" />
          ))}
        </div>
      ) : (assistants ?? []).length === 0 ? (
        <Card className="max-w-2xl">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Er staan nog geen assistenten in de catalogus.
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3" role="list" aria-label="Assistenten">
          {(assistants ?? []).map((assistant) => {
            const isOn = overrides[assistant.catalog_id] ?? assistant.is_active
            const isSaving = saving[assistant.catalog_id] === true
            return (
              <div
                key={assistant.catalog_id}
                role="listitem"
                className="w-56 shrink-0 rounded-lg border bg-background p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" title={assistant.name}>
                      {assistant.name}
                    </p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {assistantTypeLabel(assistant.type)}
                    </Badge>
                  </div>
                  <span className="text-2xl" aria-hidden="true">{assistant.icon}</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{isOn ? 'Aan' : 'Uit'}</span>
                  <Switch
                    checked={isOn}
                    disabled={isSaving}
                    onCheckedChange={(next) => handleToggle(assistant, next)}
                    label={`${assistant.name} voor ${organizationName}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default SettingsOrganizationPage
