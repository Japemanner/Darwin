import { useState } from 'react'
import { GapsPanel } from '@/components/analysis/GapsPanel'
import { AnalysisMarkdown } from '@/components/analysis/AnalysisMarkdown'
import { SourcePanel } from '@/components/analysis/SourcePanel'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { AnalysisResultSchema } from '@/lib/analysis-schemas'
import { Download, Copy, AlertTriangle, FileText } from 'lucide-react'

export interface ResultViewProps {
  runId: string
  result: unknown
  internMarkdown: string
  dossierDocxUrl: string | null
  expiresAt: string
}

export function ResultView({ runId, result, internMarkdown, dossierDocxUrl, expiresAt }: ResultViewProps) {
  const { toast } = useToast()
  const [activeBronId, setActiveBronId] = useState<string | null>(null)
  const parsed = AnalysisResultSchema.safeParse(result)

  if (!parsed.success) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <p className="font-medium">Ongeldig resultaat ontvangen</p>
        <p className="mt-1">De analyse voldoet niet aan het verwachte formaat (code: INVALID_RESULT_SCHEMA). Download het dossier-document of start een nieuwe run.</p>
      </div>
    )
  }

  const data = parsed.data
  const expired = Date.now() > new Date(expiresAt).getTime()

  if (expired) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <p className="font-medium">Resultaat automatisch verwijderd</p>
        <p className="mt-1">De bewaartermijn van zeven dagen is verstreken. Alleen de run-metadata is nog beschikbaar.</p>
      </div>
    )
  }

  const retentionDate = new Date(expiresAt).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(internMarkdown)
      toast({ title: 'Gekopieerd', description: 'De interne tekst staat op het klembord.' })
    } catch {
      toast({ title: 'Fout', description: 'Kopiëren is niet gelukt. Probeer het opnieuw.', variant: 'destructive' })
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid={`result-${runId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <FileText className="h-4 w-4" aria-hidden="true" />
          CONCEPT, door adviseur te accorderen
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          Bewaartermijn: download vóór {retentionDate}
        </span>
      </div>

      <GapsPanel lacunes={data.lacunes} />

      <section aria-labelledby="analyse-title" className="flex flex-col gap-4">
        <h3 id="analyse-title" className="text-base font-semibold">Interne analyse</h3>

        <div className="rounded-lg border p-4">
          <AnalysisMarkdown markdown={internMarkdown} onSourceClick={setActiveBronId} />
        </div>

        <div
          className="rounded-lg border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/30"
          role="note"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Intern, speculatief
          </p>
          <ul className="list-disc space-y-1 pl-4 text-sm">
            {data.intern_signalen.map((signaal, index) => (
              <li key={index}>{signaal}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          {dossierDocxUrl ? (
            <a
              href={dossierDocxUrl}
              download
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download dossier (.docx) — CONCEPT, door adviseur te accorderen
            </a>
          ) : (
            <button type="button" disabled className="inline-flex h-10 items-center gap-2 rounded-md border px-4 py-2 text-sm text-muted-foreground">
              <Download className="h-4 w-4" aria-hidden="true" />
              Download dossier (.docx) niet beschikbaar
            </button>
          )}
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" aria-hidden="true" />
            Kopieer interne tekst
          </Button>
        </div>
      </section>

      <SourcePanel
        bronId={activeBronId}
        bronnen={data.bronnen}
        onClose={() => setActiveBronId(null)}
      />
    </div>
  )
}