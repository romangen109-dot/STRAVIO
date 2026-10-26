import type { StrategyActivity, StrategyActivityType } from '../types'
import { readLocalWorkspace, updateLocalWorkspace } from './localWorkspace'

export async function getRecentActivity(userId: string, limit = 20) {
  return readLocalWorkspace(userId).activities
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
}

export async function createActivity(userId: string, type: StrategyActivityType, title: string, strategyId?: string, documentId?: string) {
  return updateLocalWorkspace(userId, (workspace) => {
    const activity: StrategyActivity = {
      id: globalThis.crypto?.randomUUID?.() ?? `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId,
      type,
      title,
      createdAt: new Date().toISOString(),
      strategyId,
      documentId,
    }
    workspace.activities.unshift(activity)
    return activity
  })
}
