import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { trackEvent, PostHogEvent } from '@/lib/posthog'
import { useRoadmapFeatures, useVote, type FeatureWithScore } from '@/hooks/queries'
import type { RoadmapFeature } from '@/types/database.types'
import { Map as MapIcon, ChevronUp, ChevronDown, Lightbulb } from 'lucide-react'

const STATUS_LABELS: Record<RoadmapFeature['status'], string> = {
  in_overweging: 'In overweging',
  gepland: 'Gepland',
  in_ontwikkeling: 'In ontwikkeling',
  verzonden: 'Verzonden',
}

const STATUS_COLORS: Record<RoadmapFeature['status'], string> = {
  in_overweging: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  gepland: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  in_ontwikkeling: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  verzonden: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

const FILTER_TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'in_overweging', label: 'In overweging' },
  { value: 'gepland', label: 'Gepland' },
  { value: 'in_ontwikkeling', label: 'In ontwikkeling' },
  { value: 'verzonden', label: 'Verzonden' },
]

function RoadmapPage() {
  const { profile } = useAuth()
  const { data: features, isPending } = useRoadmapFeatures(profile?.id)
  const [activeFilter, setActiveFilter] = useState('all')
  const [requestModalOpen, setRequestModalOpen] = useState(false)

  const filteredFeatures = activeFilter === 'all'
    ? (features ?? [])
    : (features ?? []).filter((f) => f.status === activeFilter)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Roadmap</h1>
          <p className="text-muted-foreground">Waar we aan werken en wat eraan komt — stem op features die jij belangrijk vindt</p>
        </div>
        <Button onClick={() => setRequestModalOpen(true)}>
          <Lightbulb className="h-4 w-4 mr-2" /> Feature request
        </Button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveFilter(tab.value)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              activeFilter === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-72" />
                </div>
                <Skeleton className="h-6 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredFeatures.length === 0 ? (
        <EmptyState
          icon={<MapIcon className="h-12 w-12" />}
          title="Nog geen features"
          description="Er zijn nog geen roadmap-items in deze categorie"
        />
      ) : (
        <div className="space-y-2">
          {filteredFeatures.map((feature) => (
            <FeatureRow
              key={feature.id}
              feature={feature}
              userId={profile?.id ?? ''}
            />
          ))}
        </div>
      )}

      <FeatureRequestModal
        open={requestModalOpen}
        onOpenChange={setRequestModalOpen}
      />
    </div>
  )
}

function FeatureRow({
  feature,
  userId,
}: {
  feature: FeatureWithScore
  userId: string
}) {
  const { toast } = useToast()
  const voteMutation = useVote(feature.id, userId)

  const handleVote = async (direction: number) => {
    trackEvent(PostHogEvent.ROADMAP_VOTED, { feature_id: feature.id, direction })
    try {
      await voteMutation.mutateAsync(direction)
    } catch (err) {
      toast({ title: 'Stemmen mislukt', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-4">
        <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
          <button
            onClick={() => handleVote(1)}
            disabled={!feature}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              feature.user_vote === 1
                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                : 'hover:bg-accent text-muted-foreground hover:text-foreground'
            )}
            title="Stem omhoog"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
          <span className={cn(
            'text-sm font-bold tabular-nums',
            feature.score > 0 ? 'text-green-600 dark:text-green-400' : feature.score < 0 ? 'text-red-500' : 'text-muted-foreground'
          )}>
            {feature.score}
          </span>
          <button
            onClick={() => handleVote(-1)}
            disabled={!feature}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              feature.user_vote === -1
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'hover:bg-accent text-muted-foreground hover:text-foreground'
            )}
            title="Stem omlaag"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{feature.title}</h3>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[feature.status])}>
              {STATUS_LABELS[feature.status]}
            </span>
          </div>
          {feature.description && (
            <p className="text-sm text-muted-foreground line-clamp-3">{feature.description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function FeatureRequestModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [motivation, setMotivation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setMotivation('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim() || isSubmitting) return

    setIsSubmitting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast({ title: 'Niet ingelogd', variant: 'destructive' })
        return
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-feature-request`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            motivation: motivation.trim() || null,
          }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Verzenden mislukt')
      }

      trackEvent(PostHogEvent.FEATURE_REQUEST_SUBMITTED, { title: title.trim() })

      toast({ title: 'Request verzonden', description: 'Je feature request is ingestuurd' })
      resetForm()
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Fout bij versturen',
        description: err instanceof Error ? err.message : 'Onbekende fout',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Feature request indienen</DialogTitle>
        </DialogHeader>
        <DialogContent className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            Heb je een idee voor een nieuwe feature? Laat het weten — je request wordt direct naar Jaap gestuurd.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fr-title">Titel</Label>
            <Input
              id="fr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Korte titel van je idee"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fr-description">Beschrijving</Label>
            <Textarea
              id="fr-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschrijf wat de feature moet doen"
              rows={4}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fr-motivation">Waarom heb je dit nodig?</Label>
            <Textarea
              id="fr-motivation"
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder="Welk probleem lost dit op? (optioneel)"
              rows={3}
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuleren
          </Button>
          <Button type="submit" disabled={isSubmitting || !title.trim() || !description.trim()}>
            {isSubmitting ? <><Spinner className="h-4 w-4 mr-2" /> Verzenden...</> : 'Verzenden'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

export default RoadmapPage