import type { AgentProposal } from '../types'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Table<Row, Insert, Update> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] }

type ProfileRow = { id: string; display_name: string; created_at: string; updated_at: string }
type StrategyRow = { id: string; user_id: string; name: string; description: string; data: Json; workflow_step: number; completed: boolean; created_at: string; updated_at: string }
type DocumentRow = { id: string; user_id: string; strategy_id: string; title: string; content: string; status: 'ready' | 'edited'; strategy_snapshot: Json; created_at: string; updated_at: string }
type TaskRow = { id: string; user_id: string; strategy_id: string; stage_id: string; title: string; description: string; status: 'todo' | 'in-progress' | 'completed'; priority: 'low' | 'medium' | 'high'; deadline: string | null; source_stage_plan_id: string | null; created_at: string; updated_at: string }
type MessageRow = { id: string; user_id: string; strategy_id: string; role: 'user' | 'agent'; content: string; proposal: AgentProposal | null; created_at: string }
type ActivityRow = { id: string; user_id: string; strategy_id: string | null; document_id: string | null; type: string; title: string; created_at: string }

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Pick<ProfileRow, 'id'> & Partial<ProfileRow>, Partial<ProfileRow>>
      strategies: Table<StrategyRow, Omit<StrategyRow, 'created_at' | 'updated_at'> & Partial<Pick<StrategyRow, 'created_at' | 'updated_at'>>, Partial<StrategyRow>>
      documents: Table<DocumentRow, Omit<DocumentRow, 'created_at' | 'updated_at'> & Partial<Pick<DocumentRow, 'created_at' | 'updated_at'>>, Partial<DocumentRow>>
      tasks: Table<TaskRow, Omit<TaskRow, 'created_at' | 'updated_at'> & Partial<Pick<TaskRow, 'created_at' | 'updated_at'>>, Partial<TaskRow>>
      ai_messages: Table<MessageRow, Omit<MessageRow, 'created_at'> & Partial<Pick<MessageRow, 'created_at'>>, Partial<MessageRow>>
      activity: Table<ActivityRow, Omit<ActivityRow, 'created_at'> & Partial<Pick<ActivityRow, 'created_at'>>, Partial<ActivityRow>>
    }
    Views: Record<string, never>
    Functions: {
      import_local_workspace: { Args: { payload: Json }; Returns: Json }
      resolve_ai_proposal: { Args: { p_message_id: string; p_strategy_id: string; p_action: string }; Returns: Json }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}