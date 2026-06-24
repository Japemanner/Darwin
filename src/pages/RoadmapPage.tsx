import { useState, useEffect, useCallback } from 'react'
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
import type { RoadmapFeature, RoadmapVote } from '@/types/database.types'
import { Map as MapIcon, ChevronUp, ChevronDown, Lightbulb } from 'lucide-react'

interface FeatureWithScore extends RoadmapFeature {
  score: number
  user_vote: number | null
}

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
  const { toast } = useToast()
  const [features, setFeatures] = useState<FeatureWithScore[]>([])
  const [userVotes, setUserVotes] = useState<Map<string, number>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [requestModalOpen, setRequestModalOpen] = useState(false)

  const loadFeatures = useCallback(async () => {
    // Haal features met score op via de publieke view (bypasses vote RLS voor aggregate)
    const { data: featureData, error: featureError } = await supabase
      .from('roadmap_features_with_score')
      .select('*')
      .order('score', { ascending: false })

    if (featureError) {
      toast({ title: 'Fout bij laden roadmap', variant: 'destructive' })
      setIsLoading(false)
      return
    }

    const features = (featureData ?? []) as Array<RoadmapFeature & { score: number }>

    // Haal eigen votes op (RLS beperkt tot user_id = auth.uid())
    const { data: voteData } = await supabase
      .from('roadmap_votes')
      .select('feature_id, direction')
      .eq('user_id', profile?.id ?? '')

    const voteMap = new Map<string, number>()
    for (const v of (voteData ?? []) as RoadmapVote[]) {
      voteMap.set(v.feature_id, v.direction)
    }
    setUserVotes(voteMap)

    const featuresWithScore: FeatureWithScore[] = features.map((f) => ({
      ...f,
      user_vote: voteMap.get(f.id) ?? null,
    }))

    setFeatures(featuresWithScore)
    setIsLoading(false)
  }, [profile, toast])

  useEffect(() => {
    loadFeatures()
  }, [loadFeatures])

  const handleVote = async (featureId: string, direction: number) => {
    if (!profile) return

    const currentVote = userVotes.get(featureId) ?? null
    const feature = features.find((f) => f.id === featureId)
    if (!feature) return

    // Optimistic update
    const newVoteMap = new Map(userVotes)
    let newScore = feature.score

    if (currentVote === direction) {
      // Toggle uit: verwijder vote
      newVoteMap.delete(featureId)
      newScore -= direction
    } else if (currentVote === null) {
      // Nieuwe vote
      newVoteMap.set(featureId, direction)
      newScore += direction
    } else {
      // Wissel van richting
      newVoteMap.set(featureId, direction)
      newScore += direction - currentVote
    }

    setUserVotes(newVoteMap)
    setFeatures((prev) =>
      prev
        .map((f) =>
          f.id === featureId
            ? { ...f, score: newScore, user_vote: newVoteMap.get(featureId) ?? null }
            : f
        )
        .sort((a, b) => b.score - a.score)
    )

    trackEvent(PostHogEvent.ROADMAP_VOTED, { feature_id: featureId, direction })

    // Server-side sync
    try {
      if (currentVote === direction) {
        // Verwijder vote
        const { error } = await (supabase as any).from('roadmap_votes') // eslint-disable-line @typescript-eslint/no-explicit-any
          .delete()
          .eq('feature_id', featureId)
          .eq('user_id', profile.id)
        if (error) throw error
      } else if (currentVote === null) {
        // Nieuwe vote
        const { error } = await (supabase as any).from('roadmap_votes') // eslint-disable-line @typescript-eslint/no-explicit-any
          .insert({ feature_id: featureId, user_id: profile.id, direction })
        if (error) throw error
      } else {
        // Update richting
        const { error } = await (supabase as any).from('roadmap_votes') // eslint-disable-line @typescript-eslint/no-explicit-any
          .update({ direction })
          .eq('feature_id', featureId)
          .eq('user_id', profile.id)
        if (error) throw error
      }
    } catch (err) {
      // Revert optimistic update bij fout
      toast({ title: 'Stemmen mislukt', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
      setUserVotes(userVotes)
      loadFeatures()
    }
  }

  const filteredFeatures = activeFilter === 'all'
    ? features
    : features.filter((f) => f.status === activeFilter)

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

      {isLoading ? (
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
              userVote={userVotes.get(feature.id) ?? null}
              onVote={handleVote}
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
  userVote,
  onVote,
}: {
  feature: FeatureWithScore
  userVote: number | null
  onVote: (featureId: string, direction: number) => void
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-4">
        <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
          <button
            onClick={() => onVote(feature.id, 1)}
            disabled={!feature}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              userVote === 1
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
            onClick={() => onVote(feature.id, -1)}
            disabled={!feature}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              userVote === -1
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