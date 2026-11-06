import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { useArchivedAssistants, useRestoreAssistant } from '@/hooks/queries'
import { assistantTypeLabel } from '@/lib/labels'
import type { ArchivedAssistant } from '@/lib/platform-admin-client'

interface ArchiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  onRestored?: () => void
}

function formatArchivedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function ArchiveDialog({ open, onOpenChange, organizationId, onRestored }: ArchiveDialogProps) {
  const { toast } = useToast()
  const { data, isPending, isError, error, refetch } = useArchivedAssistants(open)
  const restoreMutation = useRestoreAssistant(organizationId)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const handleRestore = async (assistant: ArchivedAssistant) => {
    if (restoringId) return
    setRestoringId(assistant.catalog_id)
    try {
      await restoreMutation.mutateAsync(assistant.catalog_id)
      toast({
        title: 'Assistent hersteld',
        description: `${assistant.name} is weer beschikbaar voor alle organisaties.`,
      })
      onRestored?.()
      closeButtonRef.current?.focus()
    } catch (err) {
      toast({
        title: 'Herstellen mislukt',
        description:
          err instanceof Error ? err.message : 'Herstellen is mislukt. Probeer het opnieuw.',
        variant: 'destructive',
      })
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} ariaLabel="Archief">
      <DialogHeader>
        <DialogTitle>Archief</DialogTitle>
        <DialogDescription>
          Verwijderde assistenten. Herstel ze om ze weer beschikbaar te maken.
        </DialogDescription>
      </DialogHeader>
      <DialogContent className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto">
        {isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Archief laden…</p>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p role="alert" className="text-sm text-destructive">
              {error instanceof Error ? error.message : 'Het archief kon niet worden geladen.'}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Opnieuw proberen
            </Button>
          </div>
        ) : (data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Geen verwijderde assistenten
          </p>
        ) : (
          (data ?? []).map((assistant) => (
            <div
              key={assistant.catalog_id}
              className="flex items-center gap-3 border-b py-3 last:border-b-0"
            >
              <span className="text-xl" aria-hidden="true">{assistant.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{assistant.name}</p>
                <p className="text-xs text-muted-foreground">
                  {assistantTypeLabel(assistant.type)} · Verwijderd op{' '}
                  {formatArchivedAt(assistant.archived_at)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleRestore(assistant)}
                disabled={restoringId !== null}
                aria-label={`${assistant.name} herstellen`}
              >
                {restoringId === assistant.catalog_id ? 'Herstellen…' : 'Herstellen'}
              </Button>
            </div>
          ))
        )}
      </DialogContent>
      <DialogFooter>
        <Button
          ref={closeButtonRef}
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Sluiten
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

export default ArchiveDialog
