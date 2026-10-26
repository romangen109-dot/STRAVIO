import type { AgentMessage, PlanningTask, StrategyActivity, StrategyData, StrategyDocument, User } from '../types'
import { localStorageDataProvider } from './storage'

export type LocalWorkspace = {
  profile?: Pick<User, 'name' | 'email'>
  strategies: StrategyData[]
  documents: StrategyDocument[]
  tasks: PlanningTask[]
  chats: Record<string, AgentMessage[]>
  activities: StrategyActivity[]
  activeStrategyId?: string
}

const emptyWorkspace = (): LocalWorkspace => ({
  strategies: [],
  documents: [],
  tasks: [],
  chats: {},
  activities: [],
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readLegacyWorkspace(userId: string): LocalWorkspace {
  const workspace = emptyWorkspace()
  const previousStrategy = localStorageDataProvider.get<StrategyData>(userId, 'strategy')
  if (previousStrategy) workspace.strategies.push({ ...previousStrategy, userId })

  workspace.documents = (localStorageDataProvider.get<StrategyDocument[]>(userId, 'documents') ?? [])
    .map((document) => ({ ...document, userId, strategy: { ...document.strategy, userId } }))
  for (const document of workspace.documents) {
    if (!workspace.strategies.some((strategy) => strategy.id === document.strategy.id)) workspace.strategies.push(document.strategy)
  }
  workspace.tasks = (localStorageDataProvider.get<PlanningTask[]>(userId, 'tasks') ?? []).map((task) => ({ ...task, userId }))
  workspace.chats = localStorageDataProvider.get<Record<string, AgentMessage[]>>(userId, 'ai-history') ?? {}
  workspace.activities = (localStorageDataProvider.get<StrategyActivity[]>(userId, 'activity') ?? []).map((activity) => ({ ...activity, userId }))
  workspace.activeStrategyId = localStorageDataProvider.get<string>(userId, 'active-strategy')
  return workspace
}

function validateWorkspace(value: unknown): LocalWorkspace {
  if (!isRecord(value)
    || !Array.isArray(value.strategies)
    || !Array.isArray(value.documents)
    || !Array.isArray(value.tasks)
    || !isRecord(value.chats)
    || !Array.isArray(value.activities)) {
    throw new Error('Saved workspace data has an unsupported format and was left untouched.')
  }
  return value as unknown as LocalWorkspace
}

export function readLocalWorkspace(userId: string): LocalWorkspace {
  const stored = localStorageDataProvider.get<unknown>(userId, 'workspace')
  return stored === undefined ? readLegacyWorkspace(userId) : validateWorkspace(stored)
}

export function writeLocalWorkspace(userId: string, workspace: LocalWorkspace) {
  localStorageDataProvider.set(userId, 'workspace', workspace)
  return workspace
}

export function updateLocalWorkspace<T>(userId: string, update: (workspace: LocalWorkspace) => T) {
  const workspace = readLocalWorkspace(userId)
  const result = update(workspace)
  writeLocalWorkspace(userId, workspace)
  return result
}

export function addLocalActivity(
  workspace: LocalWorkspace,
  userId: string,
  type: StrategyActivity['type'],
  title: string,
  strategyId?: string,
  documentId?: string,
) {
  if (type === 'strategy-updated' && strategyId) {
    const recentUpdate = workspace.activities.find((activity) =>
      activity.type === type
      && activity.strategyId === strategyId
      && Date.now() - Date.parse(activity.createdAt) < 60_000)
    if (recentUpdate) {
      recentUpdate.title = title
      recentUpdate.createdAt = new Date().toISOString()
      return
    }
  }
  workspace.activities.unshift({
    id: globalThis.crypto?.randomUUID?.() ?? `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId,
    type,
    title,
    strategyId,
    documentId,
    createdAt: new Date().toISOString(),
  })
}
