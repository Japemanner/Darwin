import { Button } from '@/components/ui/button'

interface ChatEmptyStateProps {
  assistantName: string
  description: string | null
  exampleQuestions: string[]
  onAsk: (question: string) => void
  disabled?: boolean
}

export function ChatEmptyState({ assistantName, description, exampleQuestions, onAsk, disabled }: ChatEmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      {description && (
        <p className="max-w-lg text-sm text-muted-foreground">{description}</p>
      )}
      <p className="text-sm text-muted-foreground">
        Stel uw vraag om het gesprek te starten met {assistantName}.
      </p>
      {exampleQuestions.length > 0 && (
        <div className="w-full max-w-lg flex flex-col gap-2" aria-label="Voorbeeldvragen">
          {exampleQuestions.slice(0, 4).map((question, index) => (
            <Button
              key={index}
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onAsk(question)}
              className="justify-start whitespace-normal h-auto py-2 text-left font-normal"
            >
              {question}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}