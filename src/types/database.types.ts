export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          organization_id: string
          full_name: string
          email: string
          avatar_url: string | null
          role: 'admin' | 'member'
          status: 'invited' | 'active' | 'blocked'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          organization_id: string
          full_name: string
          email?: string
          avatar_url?: string | null
          role?: 'admin' | 'member'
          status?: 'invited' | 'active' | 'blocked'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          full_name?: string
          email?: string
          avatar_url?: string | null
          role?: 'admin' | 'member'
          status?: 'invited' | 'active' | 'blocked'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'profiles_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
        ]
      }
      invitations: {
        Row: {
          id: string
          email: string
          organization_id: string
          role: 'admin' | 'member'
          invited_by: string
          status: 'pending' | 'accepted' | 'revoked'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          organization_id: string
          role?: 'admin' | 'member'
          invited_by: string
          status?: 'pending' | 'accepted' | 'revoked'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          organization_id?: string
          role?: 'admin' | 'member'
          invited_by?: string
          status?: 'pending' | 'accepted' | 'revoked'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'invitations_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
        ]
      }
      ai_assistants: {
        Row: {
          id: string
          organization_id: string
          catalog_id: string
          name: string
          description: string | null
          system_prompt: string
          icon: string
          type: 'chat' | 'agent' | 'voice' | 'risico_analyse'
          n8n_webhook_url: string | null
          example_questions: string[]
          is_active: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          catalog_id?: string
          name: string
          description?: string | null
          system_prompt: string
          icon: string
          type?: 'chat' | 'agent' | 'voice' | 'risico_analyse'
          n8n_webhook_url?: string | null
          example_questions?: string[]
          is_active?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          catalog_id?: string
          name?: string
          description?: string | null
          system_prompt?: string
          icon?: string
          type?: 'chat' | 'agent' | 'voice' | 'risico_analyse'
          n8n_webhook_url?: string | null
          example_questions?: string[]
          is_active?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'ai_assistants_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
        ]
      }
      knowledge_bases: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          vector_collection_id: string | null
          processing_mode: 'vectorized' | 'plain_text'
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          vector_collection_id?: string | null
          processing_mode?: 'vectorized' | 'plain_text'
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          vector_collection_id?: string | null
          processing_mode?: 'vectorized' | 'plain_text'
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'knowledge_bases_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
        ]
      }
      knowledge_base_documents: {
        Row: {
          id: string
          knowledge_base_id: string
          organization_id: string
          name: string
          file_path: string | null
          file_type: string
          file_size: number
          status: 'processing' | 'ready' | 'error'
          error_message: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          knowledge_base_id: string
          organization_id: string
          name: string
          file_path: string
          file_type: string
          file_size: number
          status?: 'processing' | 'ready' | 'error'
          error_message?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          knowledge_base_id?: string
          organization_id?: string
          name?: string
          file_path?: string | null
          file_type?: string
          file_size?: number
          status?: 'processing' | 'ready' | 'error'
          error_message?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'knowledge_base_documents_knowledge_base_id_fkey'; columns: ['knowledge_base_id']; referencedRelation: 'knowledge_bases'; referencedColumns: ['id'] },
          { foreignKeyName: 'knowledge_base_documents_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
        ]
      }
      knowledge_items: {
        Row: {
          id: string
          knowledge_base_id: string
          title: string
          content: string
          source_url: string | null
          embedding_status: 'pending' | 'processing' | 'done' | 'failed'
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          knowledge_base_id: string
          title: string
          content: string
          source_url?: string | null
          embedding_status?: 'pending' | 'processing' | 'done' | 'failed'
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          knowledge_base_id?: string
          title?: string
          content?: string
          source_url?: string | null
          embedding_status?: 'pending' | 'processing' | 'done' | 'failed'
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'knowledge_items_knowledge_base_id_fkey'; columns: ['knowledge_base_id']; referencedRelation: 'knowledge_bases'; referencedColumns: ['id'] },
        ]
      }
      assistant_knowledge_bases: {
        Row: {
          assistant_id: string
          knowledge_base_id: string
          created_at: string
        }
        Insert: {
          assistant_id: string
          knowledge_base_id: string
          created_at?: string
        }
        Update: {
          assistant_id?: string
          knowledge_base_id?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'assistant_knowledge_bases_assistant_id_fkey'; columns: ['assistant_id']; referencedRelation: 'ai_assistants'; referencedColumns: ['id'] },
          { foreignKeyName: 'assistant_knowledge_bases_knowledge_base_id_fkey'; columns: ['knowledge_base_id']; referencedRelation: 'knowledge_bases'; referencedColumns: ['id'] },
        ]
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          assistant_id: string
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          assistant_id: string
          title: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          assistant_id?: string
          title?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'conversations_assistant_id_fkey'; columns: ['assistant_id']; referencedRelation: 'ai_assistants'; referencedColumns: ['id'] },
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          sources: Record<string, unknown> | null
          rewritten_query: string | null
          verification: Record<string, unknown> | null
          latency_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          sources?: Record<string, unknown> | null
          rewritten_query?: string | null
          verification?: Record<string, unknown> | null
          latency_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant'
          content?: string
          sources?: Record<string, unknown> | null
          rewritten_query?: string | null
          verification?: Record<string, unknown> | null
          latency_ms?: number | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'messages_conversation_id_fkey'; columns: ['conversation_id']; referencedRelation: 'conversations'; referencedColumns: ['id'] },
        ]
      }
      flow_configs: {
        Row: {
          id: string
          flow_type: 'rag_chat' | 'document_processing'
          webhook_url: string
          webhook_token: string
          webhook_auth_header: string
          organization_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          flow_type: 'rag_chat' | 'document_processing'
          webhook_url: string
          webhook_token?: string
          webhook_auth_header?: string
          organization_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          flow_type?: 'rag_chat' | 'document_processing'
          webhook_url?: string
          webhook_token?: string
          webhook_auth_header?: string
          organization_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'flow_configs_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
        ]
      }
      feedback_interactions: {
        Row: {
          id: string
          conversation_id: string
          assistant_id: string
          message_id: string | null
          user_id: string
          organization_id: string
          thumbs_up: boolean
          reason: FeedbackReason | null
          feedback: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          assistant_id: string
          message_id?: string | null
          user_id: string
          organization_id: string
          thumbs_up: boolean
          reason?: FeedbackReason | null
          feedback?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          assistant_id?: string
          message_id?: string | null
          user_id?: string
          organization_id?: string
          thumbs_up?: boolean
          reason?: FeedbackReason | null
          feedback?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'feedback_interactions_conversation_id_fkey'; columns: ['conversation_id']; referencedRelation: 'conversations'; referencedColumns: ['id'] },
          { foreignKeyName: 'feedback_interactions_assistant_id_fkey'; columns: ['assistant_id']; referencedRelation: 'ai_assistants'; referencedColumns: ['id'] },
          { foreignKeyName: 'feedback_interactions_message_id_fkey'; columns: ['message_id']; referencedRelation: 'messages'; referencedColumns: ['id'] },
          { foreignKeyName: 'feedback_interactions_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
        ]
      }
      roadmap_features: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'in_overweging' | 'gepland' | 'in_ontwikkeling' | 'verzonden'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: 'in_overweging' | 'gepland' | 'in_ontwikkeling' | 'verzonden'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: 'in_overweging' | 'gepland' | 'in_ontwikkeling' | 'verzonden'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      roadmap_votes: {
        Row: {
          id: string
          feature_id: string
          user_id: string
          direction: number
          created_at: string
        }
        Insert: {
          id?: string
          feature_id: string
          user_id: string
          direction: number
          created_at?: string
        }
        Update: {
          id?: string
          feature_id?: string
          user_id?: string
          direction?: number
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'roadmap_votes_feature_id_fkey'; columns: ['feature_id']; referencedRelation: 'roadmap_features'; referencedColumns: ['id'] },
        ]
      }
      feature_requests: {
        Row: {
          id: string
          title: string
          description: string
          motivation: string | null
          submitted_by: string | null
          status: 'nieuw' | 'beoordeeld' | 'gepromoot' | 'afgewezen'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          motivation?: string | null
          submitted_by?: string | null
          status?: 'nieuw' | 'beoordeeld' | 'gepromoot' | 'afgewezen'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          motivation?: string | null
          submitted_by?: string | null
          status?: 'nieuw' | 'beoordeeld' | 'gepromoot' | 'afgewezen'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      knowledge_base_stats: {
        Row: {
          knowledge_base_id: string
          organization_id: string
          document_count: number
          error_count: number
          last_updated_at: string
        }
        Relationships: []
      }
      roadmap_features_with_score: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'in_overweging' | 'gepland' | 'in_ontwikkeling' | 'verzonden'
          created_by: string | null
          created_at: string
          updated_at: string
          score: number
        }
        Relationships: []
      }
    }
    Functions: {
      is_platform_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      activate_own_profile: {
        Args: Record<string, never>
        Returns: undefined
      }
      get_feedback_review: {
        Args: Record<string, never>
        Returns: {
          feedback_id: string
          message_id: string | null
          conversation_id: string
          assistant_id: string
          assistant_name: string
          reason: string | null
          feedback: string | null
          question: string | null
          answer: string
          verification: Record<string, unknown> | null
          rewritten_query: string | null
          latency_ms: number | null
          created_at: string
          updated_at: string
        }[]
      }
    }
    Enums: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Organization = Database['public']['Tables']['organizations']['Row']
export type AIAssistant = Database['public']['Tables']['ai_assistants']['Row']
export type KnowledgeBase = Database['public']['Tables']['knowledge_bases']['Row']
export type KnowledgeBaseDocument = Database['public']['Tables']['knowledge_base_documents']['Row']
export type KnowledgeBaseStats = Database['public']['Views']['knowledge_base_stats']['Row']
export type KnowledgeItem = Database['public']['Tables']['knowledge_items']['Row']
export type FlowConfig = Database['public']['Tables']['flow_configs']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type Invitation = Database['public']['Tables']['invitations']['Row']
export type FeedbackReason = 'incorrect' | 'incomplete' | 'wrong_source' | 'misunderstood' | 'other'

export type FeedbackInteraction = Database['public']['Tables']['feedback_interactions']['Row']
export type RoadmapFeature = Database['public']['Tables']['roadmap_features']['Row']
export type RoadmapVote = Database['public']['Tables']['roadmap_votes']['Row']
export type FeatureRequest = Database['public']['Tables']['feature_requests']['Row']
