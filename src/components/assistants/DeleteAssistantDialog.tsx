import { useState } from 'react'
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
import { useArchiveAssistant } from '@/hooks/queries'
import { PlatformAdminClientError } from '@/lib/platform-admin-client'
import type { AIAssistant } from '@/types/database.types'

interface DeleteAssistantDialogProps {
  assistant: AIAssistant | null
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  onArchived: () => void
}

// Confirmation for feature 023. Deleting archives the assistant for every
// organisation; the caller refreshes the list and moves focus afterwards.
function DeleteAssistantDialog({
  assistant,
  open,
  onOpenChange,
  organizationId,
  onArchived,
}: DeleteAssistantDialogProps) {
  const { toast } = useToast()
  const archiveMutation = useArchiveAssistant(organizationId)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    if (!assistant || isDeleting) return
    setIsDeleting(true)
    try {
      await archiveMutation.mutateAsync(assistant.catalog_id)
      onOpenChange(false)
      toast({
        title: 'Assistent verwijderd',
        description: `${assistant.name} is verwijderd voor alle organisaties. U vindt hem terug in het archief.`,
      })
      onArchived()
    } catch (err) {
      const alreadyArchived =
        err instanceof PlatformAdminClientError && err.message.includes('al verwijderd')
      toast({
        title: 'Verwijderen mislukt',
        description:
          err instanceof Error ? err.message : 'Verwijderen is mislukt. Probeer het opnieuw.',
        variant: 'destructive',
      })
      // Another administrator archived the assistant between opening the page
      // and confirming. The refetch already removed the card; close the dialog
      // instead of leaving it open for an assistant that no longer exists.
      if (alreadyArchived) {
        onOpenChange(false)
        onArchived()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} ariaLabel="Assistent verwijderen">
      <DialogHeader>
        <DialogTitle>Assistent verwijderen</DialogTitle>
        <DialogDescription>Deze actie geldt voor alle organisaties.</DialogDescription>
      </DialogHeader>
      <DialogContent className="flex flex-col gap-3">
        <p className="text-sm">
          Weet u zeker dat u{' '}
          <span className="font-medium">{assistant?.name ?? 'deze assistent'}</span> wilt
          verwijderen?
        </p>
        <p className="text-sm text-muted-foreground">
          De assistent verdwijnt voor alle organisaties uit AI-assistenten, het startscherm,
          de geschiedenis en de koppelingen. Bestaande gesprekken en analyses blijven
          leesbaar. U kunt de assistent later herstellen via het archief.
        </p>
      </DialogContent>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isDeleting}
        >
          Annuleren
        </Button>
        <Button type="button" variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
          {isDeleting ? 'Verwijderen…' : 'Verwijderen'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

export default DeleteAssistantDialog
