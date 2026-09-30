import type { StrategyActivity, StrategyActivityType } from '../types'
import { localStorageDataProvider } from './storage'

export const STRATEGY_ACTIVITY_EVENT = 'stravio:activity'

export function loadStrategyActivity(userId: string): StrategyActivity[] {
  if (typeof window === 'undefined') return []
  const stored = localStorageDataProvider.get<unknown>(userId, 'activity')
  if (!Array.isArray(stored)) return []
  return stored.filter((entry): entry is StrategyActivity => entry !== null
      && typeof entry === 'object'
      && 'userId' in entry && entry.userId === userId
      && typeof entry.id === 'string'
      && typeof entry.type === 'string'
      && typeof entry.title === 'string'
      && typeof entry.createdAt === 'string').slice(0, 10)
}

export function recordStrategyActivity(type: StrategyActivityType, title: string, strategyId: string | undefined, documentId: string | undefined, userId: string) {
  if (typeof window === 'undefined') return
  const now = new Date().toISOString()
  const activity = loadStrategyActivity(userId)
  const latest = activity[0]
  const shouldCoalesce = type === 'strategy-updated'
    && latest?.type === type
    && latest.strategyId === strategyId
    && Date.now() - new Date(latest.createdAt).getTime() < 60_000

  const next = shouldCoalesce
    ? [{ ...latest, title, createdAt: now }, ...activity.slice(1)]
    : [{ userId, id: globalThis.crypto?.randomUUID?.() ?? `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`, type, title, createdAt: now, strategyId, documentId }, ...activity].slice(0, 10)

  if (!localStorageDataProvider.set(userId, 'activity', next)) return
  window.dispatchEvent(new Event(STRATEGY_ACTIVITY_EVENT))
}