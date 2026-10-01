import type { StrategyDocument } from '../types'
import { createStrategyDocumentContent } from './strategyDocument'
import { requireSupabase } from './supabaseClient'

type DocumentRow = {
  id: string
  user_id: string
  strategy_id: string
  title: string
  content: string
  status: 'ready' | 'edited'
  strategy_snapshot: StrategyDocument['strategy']
  created_at: string
  updated_at: string
}

const documentColumns = 'id,user_id,strategy_id,title,content,status,strategy_snapshot,created_at,updated_at'

function fromDocumentRow(row: DocumentRow): StrategyDocument {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    status: row.status,
    strategy: { ...row.strategy_snapshot, id: row.strategy_id, userId: row.user_id },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toDocumentRow(document: StrategyDocument) {
  return {
    id: document.id,
    user_id: document.userId,
    strategy_id: document.strategy.id,
    title: document.title,
    content: document.content,
    status: document.status,
    strategy_snapshot: document.strategy,
    created_at: document.createdAt,
    updated_at: document.updatedAt,
  }
}

export async function getStrategyDocuments(userId: string) {
  const { data, error } = await requireSupabase().from('documents').select(documentColumns).eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return (data as DocumentRow[]).map(fromDocumentRow)
}

export async function createStrategyDocumentRecord(document: StrategyDocument) {
  const { data, error } = await requireSupabase().from('documents').insert(toDocumentRow(document)).select(documentColumns).single()
  if (error) throw error
  return fromDocumentRow(data as DocumentRow)
}

export async function updateStrategyDocumentRecord(userId: string, id: string, content: string) {
  const { data, error } = await requireSupabase().from('documents').update({ content, status: 'edited', updated_at: new Date().toISOString() }).eq('user_id', userId).eq('id', id).select(documentColumns).single()
  if (error) throw error
  return fromDocumentRow(data as DocumentRow)
}

export async function syncStrategyDocumentRecord(userId: string, document: StrategyDocument, strategy: StrategyDocument['strategy']) {
  const updatedAt = new Date().toISOString()
  const values = document.status === 'ready'
    ? { strategy_snapshot: strategy, content: createStrategyDocumentContent(strategy), updated_at: updatedAt }
    : { strategy_snapshot: strategy }
  const { data, error } = await requireSupabase().from('documents').update(values).eq('user_id', userId).eq('id', document.id).select(documentColumns).single()
  if (error) throw error
  return fromDocumentRow(data as DocumentRow)
}

export async function deleteStrategyDocumentRecord(userId: string, id: string) {
  const { error } = await requireSupabase().from('documents').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}


