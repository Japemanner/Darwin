import { Link } from 'react-router-dom'
import { ArrowLeft, MessagesSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatHeaderProps {
  assistant: {
    id: string
    name: string
    icon: string
    description: string | null
  }
  onNewConversation: () => void
}

export function ChatHeader({ assistant, onNewConversation }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 border-b">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          to="/assistants"
          aria-label="Terug naar assistenten"
          className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-xl shrink-0">{assistant.icon}</span>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold truncate">{assistant.name}</h1>
          <p className="text-xs text-muted-foreground truncate">{assistant.description}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" className="shrink-0" onClick={onNewConversation}>
        <MessagesSquare className="h-4 w-4 mr-2" /> Nieuw gesprek
      </Button>
    </div>
  )
}