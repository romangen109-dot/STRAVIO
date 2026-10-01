import type { StrategyActivity, StrategyActivityType } from '../types'
import { requireSupabase } from './supabaseClient'

type ActivityRow = {
  id: string
  user_id: string
  strategy_id: string | null
  document_id: string | null
  type: StrategyActivityType
  title: string
  created_at: string
}

function fromRow(row: ActivityRow): StrategyActivity {
  return { id: row.id, userId: row.user_id, strategyId: row.strategy_id ?? undefined, documentId: row.document_id ?? undefined, type: row.type, title: row.title, createdAt: row.created_at }
}

export async function getRecentActivity(userId: string, limit = 20) {
  const { data, error } = await requireSupabase().from('activity').select('id,user_id,strategy_id,document_id,type,title,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data as ActivityRow[]).map(fromRow)
}

export async function createActivity(userId: string, type: StrategyActivityType, title: string, strategyId?: string, documentId?: string) {
  const { data, error } = await requireSupabase().from('activity').insert({
    id: globalThis.crypto.randomUUID(),
    user_id: userId,
    type,
    title,
    strategy_id: strategyId ?? null,
    document_id: documentId ?? null,
  }).select('id,user_id,strategy_id,document_id,type,title,created_at').single()
  if (error) throw error
  return fromRow(data as ActivityRow)
}