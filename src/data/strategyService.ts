import type { StrategyData } from '../types'
import { createInitialStrategy } from './strategyAlgorithm'
import { addLocalActivity, readLocalWorkspace, updateLocalWorkspace, writeLocalWorkspace } from './localWorkspace'
import { localStorageDataProvider } from './storage'

const strategyCache = new Map<string, StrategyData[]>()

function orderActiveStrategy(userId: string, strategies: StrategyData[], activeStrategyId?: string) {
  const selectedId = activeStrategyId ?? localStorageDataProvider.get<string>(userId, 'active-strategy')
  const selected = strategies.find((strategy) => strategy.id === selectedId) ?? strategies[0]
  return selected ? [selected, ...strategies.filter((strategy) => strategy.id !== selected.id)] : strategies
}

export async function getStrategies(userId: string) {
  const workspace = readLocalWorkspace(userId)
  const strategies = orderActiveStrategy(userId, workspace.strategies, workspace.activeStrategyId)
  strategyCache.set(userId, strategies)
  return strategies
}

export async function getStrategy(userId: string, strategyId: string) {
  const strategy = readLocalWorkspace(userId).strategies.find((entry) => entry.id === strategyId)
  if (!strategy) return null
  const cached = strategyCache.get(userId) ?? []
  strategyCache.set(userId, [strategy, ...cached.filter((entry) => entry.id !== strategy.id)])
  return strategy
}

export async function createStrategy(strategy: StrategyData) {
  const created = updateLocalWorkspace(strategy.userId, (workspace) => {
    if (workspace.strategies.some((entry) => entry.id === strategy.id)) {
      throw new Error('A strategy with this identifier already exists.')
    }
    workspace.strategies.unshift(strategy)
    workspace.activeStrategyId = strategy.id
    addLocalActivity(workspace, strategy.userId, 'strategy-created', strategy.name, strategy.id)
    return strategy
  })
  const cached = strategyCache.get(strategy.userId) ?? []
  strategyCache.set(strategy.userId, [created, ...cached.filter((entry) => entry.id !== created.id)])
  return created
}

export async function updateStrategy(strategy: StrategyData) {
  const updated = updateLocalWorkspace(strategy.userId, (workspace) => {
    const index = workspace.strategies.findIndex((entry) => entry.id === strategy.id)
    const previousStrategy = workspace.strategies[index]
    if (index === -1) workspace.strategies.unshift(strategy)
    else workspace.strategies[index] = strategy
    for (const document of workspace.documents) {
      if (document.strategy.id === strategy.id && document.status === 'ready') document.strategy = strategy
    }
    addLocalActivity(
      workspace,
      strategy.userId,
      !previousStrategy?.completed && strategy.completed ? 'strategy-completed' : 'strategy-updated',
      strategy.name,
      strategy.id,
    )
    return strategy
  })
  const cached = strategyCache.get(strategy.userId) ?? []
  strategyCache.set(strategy.userId, [updated, ...cached.filter((entry) => entry.id !== updated.id)])
  return updated
}

export async function deleteStrategy(userId: string, strategyId: string) {
  const remaining = updateLocalWorkspace(userId, (workspace) => {
    workspace.strategies = workspace.strategies.filter((strategy) => strategy.id !== strategyId)
    workspace.documents = workspace.documents.filter((document) => document.strategy.id !== strategyId)
    workspace.tasks = workspace.tasks.filter((task) => task.strategyId !== strategyId)
    delete workspace.chats[strategyId]
    workspace.activities = workspace.activities.filter((activity) => activity.strategyId !== strategyId)
    if (workspace.activeStrategyId === strategyId
      || (!workspace.activeStrategyId && localStorageDataProvider.get<string>(userId, 'active-strategy') === strategyId)) {
      workspace.activeStrategyId = workspace.strategies[0]?.id
    }
    return orderActiveStrategy(userId, workspace.strategies, workspace.activeStrategyId)
  })
  strategyCache.set(userId, remaining)
}

export function getCachedActiveStrategy(userId: string) {
  return strategyCache.get(userId)?.[0] ?? createInitialStrategy(userId)
}

export function selectActiveStrategy(userId: string, strategyId: string) {
  const strategies = strategyCache.get(userId) ?? readLocalWorkspace(userId).strategies
  const selected = strategies.find((strategy) => strategy.id === strategyId)
  if (!selected) throw new Error('The selected strategy is not available in this workspace.')
  const workspace = readLocalWorkspace(userId)
  workspace.activeStrategyId = selected.id
  writeLocalWorkspace(userId, workspace)
  strategyCache.set(userId, [selected, ...strategies.filter((entry) => entry.id !== selected.id)])
  return selected
}

export function setCachedStrategies(userId: string, strategies: StrategyData[]) {
  strategyCache.set(userId, strategies)
}
