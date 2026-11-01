import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type {
  AIAssistant,
  KnowledgeBase,
  KnowledgeBaseDocument,
  KnowledgeBaseStats,
  KnowledgeItem,
  Conversation,
  Message,
  RoadmapFeature,
  RoadmapVote,
  FeedbackInteraction,
  FeedbackReason,
} from '@/types/database.types'
import {
  blockMember,
  inviteMember,
  listMembers,
  resendInvite,
  revokeInvite,
  setMemberRole,
  unblockMember,
} from '@/lib/team-admin-client'
import type { InviteMemberInput, TeamMember, TeamRole } from '@/lib/team-admin-client'

export interface ConversationWithAssistant extends Conversation {
  ai_assistants: { name: string; icon: string } | null
}

export interface FeatureWithScore extends RoadmapFeature {
  score: number
  user_vote: number | null
}

export interface DashboardCounts {
  assistants: number
  knowledgeBases: number
  teamMembers: number
}

export function useAssistants(orgId: string | undefined) {
  return useQuery<AIAssistant[]>({
    queryKey: ['assistants', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_assistants')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAssistantOptions(orgId: string | undefined) {
  return useQuery<Pick<AIAssistant, 'id' | 'name' | 'icon'>[]>({
    queryKey: ['assistants', orgId, 'options'],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_assistants')
        .select('id, name, icon')
        .eq('organization_id', orgId!)
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useAssistant(assistantId: string | undefined) {
  return useQuery<AIAssistant | null>({
    queryKey: ['assistants', 'detail', assistantId],
    enabled: !!assistantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_assistants')
        .select('*')
        .eq('id', assistantId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export interface ConversationContext extends Conversation {
  ai_assistants: {
    id: string
    name: string
    icon: string
    description: string | null
    example_questions: string[]
    is_active: boolean
    type: AIAssistant['type']
  } | null
}

export function useConversation(conversationId: string | undefined) {
  return useQuery<ConversationContext | null>({
    queryKey: ['conversations', 'detail', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, ai_assistants(id, name, icon, description, example_questions, is_active, type)')
        .eq('id', conversationId!)
        .maybeSingle()
      if (error) throw error
      return data as ConversationContext | null
    },
  })
}

export function useKnowledgeBases(orgId: string | undefined) {
  return useQuery<KnowledgeBase[]>({
    queryKey: ['knowledge-bases', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_bases')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useKnowledgeBaseStats(orgId: string | undefined) {
  return useQuery<KnowledgeBaseStats[]>({
    queryKey: ['kb-stats', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_base_stats')
        .select('*')
        .eq('organization_id', orgId!)
      if (error) throw error
      return data
    },
  })
}

export function useKnowledgeBaseDocuments(kbId: string | undefined) {
  return useQuery<KnowledgeBaseDocument[]>({
    queryKey: ['kb-documents', kbId],
    enabled: !!kbId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_base_documents')
        .select('*')
        .eq('knowledge_base_id', kbId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    refetchInterval: (query) => {
      const documents = query.state.data
      return documents?.some((doc) => doc.status === 'processing') ? 5_000 : false
    },
    refetchIntervalInBackground: false,
  })
}

export function useKnowledgeItems(kbId: string | undefined) {
  return useQuery<KnowledgeItem[]>({
    queryKey: ['kb-items', kbId],
    enabled: !!kbId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_items')
        .select('*')
        .eq('knowledge_base_id', kbId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useLinkedAssistants(kbId: string | undefined) {
  return useQuery<AIAssistant[]>({
    queryKey: ['kb-linked-assistants', kbId],
    enabled: !!kbId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assistant_knowledge_bases')
        .select('ai_assistants(*)')
        .eq('knowledge_base_id', kbId!)
      if (error) throw error
      return (data ?? []).map((row) => row.ai_assistants).filter(Boolean) as AIAssistant[]
    },
  })
}

export function useAssistantKBLinks(assistantId: string | undefined) {
  return useQuery<Set<string>>({
    queryKey: ['assistant-kb-links', assistantId],
    enabled: !!assistantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assistant_knowledge_bases')
        .select('knowledge_base_id')
        .eq('assistant_id', assistantId!)
      if (error) throw error
      return new Set((data ?? []).map((l) => l.knowledge_base_id))
    },
  })
}

export function useAssistantKnowledgeBases(assistantId: string | undefined) {
  return useQuery<KnowledgeBase[]>({
    queryKey: ['assistant-knowledge-bases', assistantId],
    enabled: !!assistantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assistant_knowledge_bases')
        .select('knowledge_bases(*)')
        .eq('assistant_id', assistantId!)
      if (error) throw error
      return (data ?? []).map((row) => row.knowledge_bases).filter(Boolean) as KnowledgeBase[]
    },
  })
}

export function useConversations(userId: string | undefined, assistantId?: string, limit = 50) {
  return useQuery<ConversationWithAssistant[]>({
    queryKey: ['conversations', userId, assistantId ?? 'all', limit],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from('conversations')
        .select('*, ai_assistants(name, icon)')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (assistantId && assistantId !== 'all') {
        query = query.eq('assistant_id', assistantId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as ConversationWithAssistant[]
    },
  })
}

export function useConversationMessages(conversationId: string | undefined) {
  return useQuery<Message[]>({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useRoadmapFeatures(userId: string | undefined) {
  return useQuery<FeatureWithScore[]>({
    queryKey: ['roadmap-features', userId],
    enabled: !!userId,
    queryFn: async () => {
      const [featuresRes, votesRes] = await Promise.all([
        supabase
          .from('roadmap_features_with_score')
          .select('*')
          .order('score', { ascending: false }),
        supabase
          .from('roadmap_votes')
          .select('feature_id, direction')
          .eq('user_id', userId!),
      ])

      if (featuresRes.error) throw featuresRes.error

      const voteMap = new Map<string, number>()
      for (const v of (votesRes.data ?? []) as RoadmapVote[]) {
        voteMap.set(v.feature_id, v.direction)
      }

      const features = (featuresRes.data ?? []) as Array<RoadmapFeature & { score: number }>
      return features.map((f) => ({
        ...f,
        user_vote: voteMap.get(f.id) ?? null,
      }))
    },
  })
}

export function useTeamMembers(orgId: string | undefined) {
  return useQuery<TeamMember[]>({
    queryKey: ['team-members', orgId],
    enabled: !!orgId,
    queryFn: () => listMembers(orgId!),
  })
}

export function useInviteMember(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InviteMemberInput) => inviteMember(orgId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members', orgId] })
      qc.invalidateQueries({ queryKey: ['dashboard-counts', orgId] })
    },
  })
}

export function useResendInvite(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => resendInvite(orgId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members', orgId] })
    },
  })
}

export function useRevokeInvite(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => revokeInvite(orgId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members', orgId] })
      qc.invalidateQueries({ queryKey: ['dashboard-counts', orgId] })
    },
  })
}

export function useSetMemberRole(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TeamRole }) =>
      setMemberRole(orgId, userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members', orgId] })
    },
  })
}

export function useBlockMember(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => blockMember(orgId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members', orgId] })
      qc.invalidateQueries({ queryKey: ['dashboard-counts', orgId] })
    },
  })
}

export function useUnblockMember(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => unblockMember(orgId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members', orgId] })
      qc.invalidateQueries({ queryKey: ['dashboard-counts', orgId] })
    },
  })
}

export function useDashboardCounts(orgId: string | undefined) {
  return useQuery<DashboardCounts>({
    queryKey: ['dashboard-counts', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [assistantsRes, kbRes, membersRes] = await Promise.all([
        supabase.from('ai_assistants').select('id', { count: 'exact', head: true }).eq('organization_id', orgId!),
        supabase.from('knowledge_bases').select('id', { count: 'exact', head: true }).eq('organization_id', orgId!),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!)
          .eq('status', 'active'),
      ])

      return {
        assistants: assistantsRes.count ?? 0,
        knowledgeBases: kbRes.count ?? 0,
        teamMembers: membersRes.count ?? 0,
      }
    },
  })
}

export function useMessageFeedback(conversationId: string | undefined) {
  const { profile } = useAuth()
  return useQuery<FeedbackInteraction[]>({
    queryKey: ['message-feedback', conversationId],
    enabled: !!conversationId && !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback_interactions')
        .select('*')
        .eq('conversation_id', conversationId!)
        .eq('user_id', profile!.id)
        .not('message_id', 'is', null)
      if (error) throw error
      return data
    },
  })
}

export interface MessageFeedbackPayload {
  message_id: string
  assistant_id: string
  thumbs_up: boolean
  reason: FeedbackReason | null
  feedback: string | null
}

// Full-payload upsert on (message_id, user_id): changing a rating overwrites
// the previous one completely — thumbs up sends reason/feedback null so a
// former thumbs-down reason is cleared (FR-005).
export function useUpsertMessageFeedback(conversationId: string) {
  const { profile } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: MessageFeedbackPayload) => {
      const { error } = await supabase
        .from('feedback_interactions')
        .upsert(
          {
            message_id: payload.message_id,
            conversation_id: conversationId,
            assistant_id: payload.assistant_id,
            user_id: profile!.id,
            organization_id: profile!.organization_id,
            thumbs_up: payload.thumbs_up,
            reason: payload.reason,
            feedback: payload.feedback,
          },
          { onConflict: 'message_id,user_id' },
        )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['message-feedback', conversationId] })
    },
  })
}

// Knowledge-source linking only (feature 019): both the platform admin (own
// organization) and office admins use this; assistant rows are never written
// from the client anymore.
export function useUpdateAssistantKnowledgeBases(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { assistantId: string; kbIds: string[] }) => {
      const { data: existingLinks, error: linksError } = await supabase
        .from('assistant_knowledge_bases')
        .select('knowledge_base_id')
        .eq('assistant_id', payload.assistantId)
      if (linksError) throw linksError

      const existingIds = new Set((existingLinks ?? []).map((l) => l.knowledge_base_id))
      const toAdd = payload.kbIds.filter((id) => !existingIds.has(id))
      const toRemove = [...existingIds].filter((id) => !payload.kbIds.includes(id))

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('assistant_knowledge_bases')
          .delete()
          .eq('assistant_id', payload.assistantId)
          .in('knowledge_base_id', toRemove)
        if (error) throw error
      }
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('assistant_knowledge_bases')
          .insert(toAdd.map((kbId) => ({ assistant_id: payload.assistantId, knowledge_base_id: kbId })))
        if (error) throw error
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['assistants', orgId] })
      qc.invalidateQueries({ queryKey: ['assistant-kb-links', variables.assistantId] })
    },
  })
}

export function useCreateKnowledgeBase(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      organization_id: string
      name: string
      description: string | null
      vector_collection_id: string | null
      created_by: string
    }) => {
      const { error } = await supabase
        .from('knowledge_bases')
        .insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge-bases', orgId] })
    },
  })
}

export function useUpdateKnowledgeBase(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      id: string
      name: string
      description: string | null
      vector_collection_id: string | null
    }) => {
      const { error } = await supabase
        .from('knowledge_bases')
        .update({
          name: payload.name,
          description: payload.description,
          vector_collection_id: payload.vector_collection_id,
        })
        .eq('id', payload.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge-bases', orgId] })
    },
  })
}

export function useAddKnowledgeItem(kbId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      knowledge_base_id: string
      title: string
      content: string
      source_url: string | null
      embedding_status: 'pending' | 'processing' | 'done' | 'failed'
      created_by: string
    }) => {
      const { data, error } = await supabase
        .from('knowledge_items')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (newItem) => {
      qc.setQueryData<KnowledgeItem[]>(['kb-items', kbId], (prev) => [newItem, ...(prev ?? [])])
    },
  })
}

export function useDeleteKnowledgeItem(kbId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('knowledge_items')
        .delete()
        .eq('id', itemId)
      if (error) throw error
    },
    onMutate: async (itemId: string) => {
      qc.setQueryData<KnowledgeItem[]>(['kb-items', kbId], (prev) =>
        (prev ?? []).filter((i) => i.id !== itemId),
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-items', kbId] })
    },
  })
}

export function useVote(featureId: string, userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (direction: number) => {
      const { data: existing } = await supabase
        .from('roadmap_votes')
        .select('id, direction')
        .eq('feature_id', featureId)
        .eq('user_id', userId)
        .maybeSingle()

      if (existing) {
        if (existing.direction === direction) {
          const { error } = await supabase
            .from('roadmap_votes')
            .delete()
            .eq('feature_id', featureId)
            .eq('user_id', userId)
          if (error) throw error
          return { action: 'removed' as const, direction }
        } else {
          const { error } = await supabase
            .from('roadmap_votes')
            .update({ direction })
            .eq('feature_id', featureId)
            .eq('user_id', userId)
          if (error) throw error
          return { action: 'updated' as const, direction, prevDirection: existing.direction }
        }
      } else {
        const { error } = await supabase
          .from('roadmap_votes')
          .insert({ feature_id: featureId, user_id: userId, direction })
        if (error) throw error
        return { action: 'added' as const, direction }
      }
    },
    onMutate: (direction: number) => {
      qc.setQueryData<FeatureWithScore[]>(['roadmap-features', userId], (prev) => {
        if (!prev) return prev
        return prev
          .map((f) => {
            if (f.id !== featureId) return f
            let newScore = f.score
            if (f.user_vote === direction) {
              newScore -= direction
            } else if (f.user_vote === null) {
              newScore += direction
            } else {
              newScore += direction - f.user_vote
            }
            return {
              ...f,
              score: newScore,
              user_vote: f.user_vote === direction ? null : direction,
            }
          })
          .sort((a, b) => b.score - a.score)
      })
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ['roadmap-features', userId] })
    },
  })
}