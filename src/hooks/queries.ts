import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  AIAssistant,
  KnowledgeBase,
  KnowledgeBaseDocument,
  KnowledgeItem,
  Conversation,
  Message,
  Profile,
  Invitation,
  RoadmapFeature,
  RoadmapVote,
  FlowConfig,
  FeedbackInteraction,
} from '@/types/database.types'

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
  return useQuery<Profile[]>({
    queryKey: ['team-members', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useInvitations(orgId: string | undefined) {
  return useQuery<Invitation[]>({
    queryKey: ['invitations', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
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
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('organization_id', orgId!),
      ])

      return {
        assistants: assistantsRes.count ?? 0,
        knowledgeBases: kbRes.count ?? 0,
        teamMembers: membersRes.count ?? 0,
      }
    },
  })
}

export function useFlowConfig(orgId: string | undefined, flowType: 'rag_chat' | 'document_processing') {
  return useQuery<FlowConfig | null>({
    queryKey: ['flow-config', orgId, flowType],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_configs')
        .select('*')
        .eq('flow_type', flowType)
        .eq('organization_id', orgId!)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data
    },
  })
}

export function useFeedbackInteraction(conversationId: string | undefined, userId: string | undefined) {
  return useQuery<FeedbackInteraction | null>({
    queryKey: ['feedback', conversationId, userId],
    enabled: !!conversationId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback_interactions')
        .select('*')
        .eq('conversation_id', conversationId!)
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useCreateAssistant(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      organization_id: string
      name: string
      description: string | null
      system_prompt: string
      icon: string
      type: string
      n8n_webhook_url: string | null
      is_active: boolean
      created_by: string
      kbIds: string[]
    }) => {
      const { data: created, error } = await supabase
        .from('ai_assistants')
        .insert({
          organization_id: payload.organization_id,
          name: payload.name,
          description: payload.description,
          system_prompt: payload.system_prompt,
          icon: payload.icon,
          type: payload.type as 'chat' | 'agent' | 'voice',
          n8n_webhook_url: payload.n8n_webhook_url,
          is_active: payload.is_active,
          created_by: payload.created_by,
        })
        .select()
        .single()
      if (error) throw error

      if (payload.kbIds.length > 0) {
        const { error: linkError } = await supabase
          .from('assistant_knowledge_bases')
          .insert(payload.kbIds.map((kbId) => ({ assistant_id: created.id, knowledge_base_id: kbId })))
        if (linkError) throw linkError
      }

      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assistants', orgId] })
    },
  })
}

export function useUpdateAssistant(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      id: string
      name: string
      description: string | null
      type: string
      icon: string
      n8n_webhook_url: string | null
      is_active: boolean
      kbIds: string[]
    }) => {
      const { error } = await supabase
        .from('ai_assistants')
        .update({
          name: payload.name,
          description: payload.description,
          type: payload.type as 'chat' | 'agent' | 'voice',
          icon: payload.icon,
          n8n_webhook_url: payload.n8n_webhook_url,
          is_active: payload.is_active,
        })
        .eq('id', payload.id)
      if (error) throw error

      const { data: existingLinks } = await supabase
        .from('assistant_knowledge_bases')
        .select('knowledge_base_id')
        .eq('assistant_id', payload.id)

      const existingIds = new Set((existingLinks ?? []).map((l) => l.knowledge_base_id))
      const toAdd = payload.kbIds.filter((id) => !existingIds.has(id))
      const toRemove = [...existingIds].filter((id) => !payload.kbIds.includes(id))

      if (toRemove.length > 0) {
        await supabase
          .from('assistant_knowledge_bases')
          .delete()
          .eq('assistant_id', payload.id)
          .in('knowledge_base_id', toRemove)
      }
      if (toAdd.length > 0) {
        await supabase
          .from('assistant_knowledge_bases')
          .insert(toAdd.map((kbId) => ({ assistant_id: payload.id, knowledge_base_id: kbId })))
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assistants', orgId] })
    },
  })
}

export function useDeleteAssistant(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (assistantId: string) => {
      const { error: convError } = await supabase
        .from('conversations')
        .delete()
        .eq('assistant_id', assistantId)
      if (convError) throw convError

      const { error: kbError } = await supabase
        .from('assistant_knowledge_bases')
        .delete()
        .eq('assistant_id', assistantId)
      if (kbError) throw kbError

      const { error } = await supabase
        .from('ai_assistants')
        .delete()
        .eq('id', assistantId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assistants', orgId] })
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

export function useRevokeInvitation(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations', orgId] })
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

export function useSaveFlowConfig(orgId: string, flowType: 'rag_chat' | 'document_processing') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      configId: string | null
      webhook_url: string
      webhook_token: string
      webhook_auth_header: string
      organization_id: string
      flow_type: 'rag_chat' | 'document_processing'
    }) => {
      if (payload.configId) {
        const { error } = await supabase
          .from('flow_configs')
          .update({
            webhook_url: payload.webhook_url,
            webhook_token: payload.webhook_token,
            webhook_auth_header: payload.webhook_auth_header,
          })
          .eq('id', payload.configId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('flow_configs')
          .insert({
            flow_type: payload.flow_type,
            webhook_url: payload.webhook_url,
            webhook_token: payload.webhook_token,
            webhook_auth_header: payload.webhook_auth_header,
            organization_id: payload.organization_id,
          })
          .select()
          .single()
        if (error) throw error
        return data
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flow-config', orgId, flowType] })
    },
  })
}