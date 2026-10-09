import { useEffect, useRef } from 'react'
import type { BronRef } from '@/lib/analysis-schemas'
import { Button } from '@/components/ui/button'
import { AlertCircle, X } from 'lucide-react'

export interface SourcePanelProps {
  bronId: string | null
  bronnen: BronRef[]
  onClose: () => void
}

export function SourcePanel({ bronId, bronnen, onClose }: SourcePanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (bronId) closeRef.current?.focus()
  }, [bronId])

  const bron = bronId ? bronnen.find((b) => b.id === bronId) : undefined

  return (
    <aside
      role="dialog"
      aria-label="Bronverwijzing"
      data-side-panel=""
      aria-hidden={!bronId}
      className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-background shadow-2xl transition-transform ${
        bronId ? 'translate-x-0' : 'translate-x-full'
      }`}
      {...(bronId ? {} : { inert: '' })}
    >
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="font-semibold">Bronverwijzing</h3>
        <Button ref={closeRef} variant="ghost" size="icon" onClick={onClose} aria-label="Paneel sluiten">
          <X className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {!bronId && <p className="text-sm text-muted-foreground">Klik op een bronverwijzing in de analyse.</p>}
        {bronId && !bron && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Bron {bronId} is niet beschikbaar. Mogelijk is de bron inmiddels verwijderd.</span>
          </div>
        )}
        {bron && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Referentie</p>
              <p className="text-lg font-semibold">{bron.id}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Document</p>
              <p className="text-sm font-medium">{bron.document}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Locatie</p>
              <p className="text-sm">{bron.locatie}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Letterlijke passage</p>
              <blockquote className="border-l-2 border-primary/40 pl-3 text-sm italic">{bron.passage}</blockquote>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}