import { Badge } from '@/components/ui/badge'

// Constitution II: every generated output is visibly labeled as a draft for
// advisor review — same wording as the analysis flow (AnalysisFlow.tsx).
const CONCEPT_LABEL = 'CONCEPT, door adviseur te accorderen'

// Meta block under each assistant answer: CONCEPT badge (this file), the
// verification verdict line and the numbered source buttons (feature 013).
export function AnswerMeta() {
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <Badge variant="outline" className="w-fit font-normal text-muted-foreground">
        {CONCEPT_LABEL}
      </Badge>
    </div>
  )
}