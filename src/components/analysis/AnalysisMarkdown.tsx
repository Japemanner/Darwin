import { useMemo, useState } from 'react'
import { sanitizeMarkdown } from '@/lib/sanitize'

export interface AnalysisMarkdownProps {
  markdown: string
  onSourceClick?: (bronId: string) => void
}

// Renders [K1]-style references as clickable anchors by converting
// them to internal links pre-sanitization; DOMPurify keeps <a href>.
const BRON_REF_PATTERN = /^[KRA]\d+$/

function makeRefAnchors(markdown: string): string {
  return markdown.replace(/\[([KRA]\d+)\]/g, (_match, id: string) => `[${id}](#bron-${id.toLowerCase()})`)
}

export function AnalysisMarkdown({ markdown, onSourceClick }: AnalysisMarkdownProps) {
  const [invalid, setInvalid] = useState(false)
  const html = useMemo(() => {
    try {
      return sanitizeMarkdown(makeRefAnchors(markdown))
    } catch {
      setInvalid(true)
      return ''
    }
  }, [markdown])

  if (invalid) {
    return (
      <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        De analyse kon niet veilig worden weergegeven. Download het dossier-document of probeer het opnieuw.
      </div>
    )
  }

  return (
    <div
      className="prose prose-sm max-w-none"
      onClick={(e) => {
        const target = e.target as HTMLAnchorElement
        if (target.tagName === 'A' && target.getAttribute('href')?.startsWith('#bron-')) {
          e.preventDefault()
          const bronId = target.getAttribute('href')?.slice('#bron-'.length).toUpperCase()
          if (bronId && BRON_REF_PATTERN.test(bronId)) {
            onSourceClick?.(bronId)
          }
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}