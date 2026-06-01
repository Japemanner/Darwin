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
      }
      profiles: {
        Row: {
          id: string
          organization_id: string
          full_name: string
          avatar_url: string | null
          role: 'admin' | 'member'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          organization_id: string
          full_name: string
          avatar_url?: string | null
          role?: 'admin' | 'member'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          full_name?: string
          avatar_url?: string | null
          role?: 'admin' | 'member'
          created_at?: string
          updated_at?: string
        }
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
      }
      ai_assistants: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          system_prompt: string
          icon: string
          type: 'chat' | 'agent' | 'voice'
          n8n_webhook_url: string | null
          is_active: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          system_prompt: string
          icon: string
          type?: 'chat' | 'agent' | 'voice'
          n8n_webhook_url?: string | null
          is_active?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          system_prompt?: string
          icon?: string
          type?: 'chat' | 'agent' | 'voice'
          n8n_webhook_url?: string | null
          is_active?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      knowledge_bases: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          vector_collection_id: string | null
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
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      knowledge_base_documents: {
        Row: {
          id: string
          knowledge_base_id: string
          name: string
          file_path: string
          file_type: string
          file_size: number
          status: 'processing' | 'ready' | 'error'
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          knowledge_base_id: string
          name: string
          file_path: string
          file_type: string
          file_size: number
          status?: 'processing' | 'ready' | 'error'
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          knowledge_base_id?: string
          name?: string
          file_path?: string
          file_type?: string
          file_size?: number
          status?: 'processing' | 'ready' | 'error'
          created_by?: string
          created_at?: string
          updated_at?: string
        }
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
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          sources: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          sources?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant'
          content?: string
          sources?: Record<string, unknown> | null
          created_at?: string
        }
      }
      flow_configs: {
        Row: {
          id: string
          flow_type: 'rag_chat'
          webhook_url: string
          webhook_token: string
          organization_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          flow_type: 'rag_chat'
          webhook_url: string
          webhook_token: string
          organization_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          flow_type?: 'rag_chat'
          webhook_url?: string
          webhook_token?: string
          organization_id?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Organization = Database['public']['Tables']['organizations']['Row']
export type AIAssistant = Database['public']['Tables']['ai_assistants']['Row']
export type KnowledgeBase = Database['public']['Tables']['knowledge_bases']['Row']
export type KnowledgeBaseDocument = Database['public']['Tables']['knowledge_base_documents']['Row']
export type KnowledgeItem = Database['public']['Tables']['knowledge_items']['Row']
export type FlowConfig = Database['public']['Tables']['flow_configs']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type Invitation = Database['public']['Tables']['invitations']['Row']
