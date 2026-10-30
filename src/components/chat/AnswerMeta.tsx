import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BronRef } from '@/lib/analysis-schemas'
import type { RagSource, RagVerification } from '@/lib/rag-client'

// Constitution II: every generated output is visibly labeled as a draft for
// advisor review — same wording as the analysis flow (AnalysisNewPage.tsx).
const CONCEPT_LABEL = 'CONCEPT, door adviseur te accorderen'

// FR-005: warning threshold as a named constant in code (0.7, strictly
// below triggers the warning; exactly 0.7 with grounded = true does not).
const CONFIDENCE_THRESHOLD = 0.7

const AMBER_TEXT = 'text-amber-700 dark:text-amber-400'

interface AnswerMetaProps {
  verification?: RagVerification | null
  sources: RagSource[]
  onOpenBron: (bronnen: BronRef[], bronId: string, trigger: HTMLButtonElement) => void
}

// Maps a chat source to the shared analysis panel shape (contracts/
// chat-source-display.md §1): the K-prefix matches the analysis convention.
function toBronRef(source: RagSource, index: number): BronRef {
  return {
    id: `K${index + 1}`,
    document: source.title ?? 'Zonder titel',
    locatie: source.page ?? '',
    passage: source.excerpt ?? '',
  }
}

// One verdict line per answer with verification data (FR-005/FR-006);
// nothing when verification is absent (FR-007).
function VerificationLine({ verification }: { verification: RagVerification }) {
  const warning = !verification.grounded || verification.confidence < CONFIDENCE_THRESHOLD

  if (!warning) {
    return <p className="text-muted-foreground">Gecontroleerd tegen de bronnen</p>
  }

  return (
    <div
      role="note"
      className="rounded-md border border-amber-300/60 bg-amber-50 p-2 dark:border-amber-500/30 dark:bg-amber-950/30"
    >
      <p className={cn('flex items-center gap-1 font-medium', AMBER_TEXT)}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Dit antwoord is niet volledig onderbouwd door de bronnen.
      </p>
      {verification.issues.length > 0 && (
        <>
          <p className={cn('mt-1', AMBER_TEXT)}>Gevonden problemen:</p>
          <ul className={cn('list-disc pl-4', AMBER_TEXT)}>
            {verification.issues.map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// Meta block under each assistant answer: CONCEPT badge, the verification
// verdict line and the numbered source buttons (feature 013).
export function AnswerMeta({ verification, sources, onOpenBron }: AnswerMetaProps) {
  const bronnen = sources.map(toBronRef)

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <Badge variant="outline" className="w-fit font-normal text-muted-foreground">
        {CONCEPT_LABEL}
      </Badge>
      {verification && <VerificationLine verification={verification} />}
      {bronnen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bronnen.map((bron, index) => (
            <button
              key={bron.id}
              type="button"
              onClick={(event) => onOpenBron(bronnen, bron.id, event.currentTarget)}
              className="rounded-md border bg-background px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              [{index + 1}] {bron.document}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}