import type { StrategyData } from '../types'
import { createInitialStrategy } from './strategyAlgorithm'
import { requireSupabase } from './supabaseClient'

type StrategyRow = {
  id: string
  user_id: string
  name: string
  description: string
  data: StrategyData
  workflow_step: number
  completed: boolean
  created_at: string
  updated_at: string
}

const strategyCache = new Map<string, StrategyData[]>()

function fromRow(row: StrategyRow): StrategyData {
  return { ...row.data, id: row.id, userId: row.user_id, name: row.name, description: row.description, workflowStep: row.workflow_step, completed: row.completed, createdAt: row.created_at, updatedAt: row.updated_at }
}

function toRow(strategy: StrategyData) {
  return {
    id: strategy.id,
    user_id: strategy.userId,
    name: strategy.name,
    description: strategy.description,
    data: strategy,
    workflow_step: strategy.workflowStep,
    completed: strategy.completed,
    created_at: strategy.createdAt,
    updated_at: strategy.updatedAt,
  }
}

export async function getStrategies(userId: string) {
  const { data, error } = await requireSupabase().from('strategies').select('id,user_id,name,description,data,workflow_step,completed,created_at,updated_at').eq('user_id', userId).order('updated_at', { ascending: false })
  if (error) throw error
  const strategies = (data as StrategyRow[]).map(fromRow)
  strategyCache.set(userId, strategies)
  return strategies
}

export async function getStrategy(userId: string, strategyId: string) {
  const { data, error } = await requireSupabase().from('strategies').select('id,user_id,name,description,data,workflow_step,completed,created_at,updated_at').eq('user_id', userId).eq('id', strategyId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const strategy = fromRow(data as StrategyRow)
  const cached = strategyCache.get(userId) ?? []
  strategyCache.set(userId, [strategy, ...cached.filter((entry) => entry.id !== strategy.id)])
  return strategy
}

export async function createStrategy(strategy: StrategyData) {
  const { data, error } = await requireSupabase().from('strategies').insert(toRow(strategy)).select('id,user_id,name,description,data,workflow_step,completed,created_at,updated_at').single()
  if (error) throw error
  const created = fromRow(data as StrategyRow)
  const cached = strategyCache.get(strategy.userId) ?? []
  strategyCache.set(strategy.userId, [created, ...cached])
  return created
}

export async function updateStrategy(strategy: StrategyData) {
  const { data, error } = await requireSupabase().from('strategies').upsert(toRow(strategy), { onConflict: 'id,user_id' }).select('id,user_id,name,description,data,workflow_step,completed,created_at,updated_at').single()
  if (error) throw error
  const updated = fromRow(data as StrategyRow)
  const cached = strategyCache.get(strategy.userId) ?? []
  strategyCache.set(strategy.userId, [updated, ...cached.filter((entry) => entry.id !== updated.id)])
  return updated
}

export async function deleteStrategy(userId: string, strategyId: string) {
  const { error } = await requireSupabase().from('strategies').delete().eq('user_id', userId).eq('id', strategyId)
  if (error) throw error
  strategyCache.set(userId, (strategyCache.get(userId) ?? []).filter((strategy) => strategy.id !== strategyId))
}

export function getCachedActiveStrategy(userId: string) {
  return strategyCache.get(userId)?.[0] ?? createInitialStrategy(userId)
}

export function setCachedStrategies(userId: string, strategies: StrategyData[]) {
  strategyCache.set(userId, strategies)
}