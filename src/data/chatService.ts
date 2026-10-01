import type { AgentContext, AgentMessage, AgentProposal } from '../types'
import { requireSupabase } from './supabaseClient'

type MessageRow = {
  id: string
  user_id: string
  strategy_id: string
  role: AgentMessage['role']
  content: string
  proposal: AgentProposal | null
  created_at: string
}

function fromRow(row: MessageRow): AgentMessage {
  return { id: row.id, userId: row.user_id, strategyId: row.strategy_id, role: row.role, content: row.content, proposal: row.proposal ?? undefined, createdAt: row.created_at }
}

export async function getStrategyMessages(userId: string, strategyId: string) {
  const { data, error } = await requireSupabase().from('ai_messages').select('id,user_id,strategy_id,role,content,proposal,created_at').eq('user_id', userId).eq('strategy_id', strategyId).order('created_at', { ascending: true }).limit(120)
  if (error) throw error
  return (data as MessageRow[]).map(fromRow)
}

export async function getAgentHistory(userId: string) {
  const { data, error } = await requireSupabase().from('ai_messages').select('id,user_id,strategy_id,role,content,proposal,created_at').eq('user_id', userId).order('created_at', { ascending: true }).limit(5000)
  if (error) throw error
  const chats: Record<string, AgentMessage[]> = {}
  for (const row of data as MessageRow[]) (chats[row.strategy_id] ??= []).push(fromRow(row))
  return chats
}

export async function requestAgentResponse(context: AgentContext, prompt: string) {
  const client = requireSupabase()
  const hasOpenedStrategyDocument = context.currentDocument && context.documents.some((document) => document.id === context.currentDocument?.id)
  const { data, error } = await client.functions.invoke('ai', {
    body: {
      action: 'respond',
      strategyId: context.strategy.id,
      prompt,
      currentDocumentId: hasOpenedStrategyDocument ? context.currentDocument?.id : undefined,
      currentDocumentContent: hasOpenedStrategyDocument ? context.currentDocument?.content : undefined,
    },
  })
  if (error) throw error
  if (!data || typeof data !== 'object' || !('message' in data) || !('userMessage' in data)) throw new Error('AI endpoint returned an invalid response.')
  return { userMessage: fromResponse(data.userMessage), message: fromResponse(data.message), connected: data.connected !== false }
}

export async function resolveAgentProposal(strategyId: string, messageId: string, action: 'apply' | 'cancel') {
  const { data, error } = await requireSupabase().functions.invoke('ai', { body: { action, strategyId, messageId } })
  if (error) throw error
  if (data?.status !== (action === 'apply' ? 'applied' : 'cancelled')) throw new Error('AI proposal was not confirmed by the server.')
}

export async function clearStrategyMessages(userId: string, strategyId: string) {
  const { error } = await requireSupabase().from('ai_messages').delete().eq('user_id', userId).eq('strategy_id', strategyId)
  if (error) throw error
}

function fromResponse(value: unknown): AgentMessage {
  if (typeof value !== 'object' || value === null) throw new Error('AI endpoint returned an invalid message.')
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.userId !== 'string' || typeof row.strategyId !== 'string' || (row.role !== 'user' && row.role !== 'agent') || typeof row.content !== 'string' || typeof row.createdAt !== 'string') {
    throw new Error('AI endpoint returned an invalid message.')
  }
  return { id: row.id, userId: row.userId, strategyId: row.strategyId, role: row.role, content: row.content, createdAt: row.createdAt, proposal: row.proposal as AgentProposal | undefined }
}