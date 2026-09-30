import type { PlanningTask } from '../types'
import { localStorageDataProvider } from './storage'

export const PLANNING_TASKS_CHANGED_EVENT = 'stravio:planning-tasks'

function isPlanningTask(value: unknown): value is PlanningTask {
  if (typeof value !== 'object' || value === null) return false
  const task = value as Record<string, unknown>
  return typeof task.id === 'string'
    && typeof task.strategyId === 'string'
    && typeof task.stageId === 'string'
    && typeof task.title === 'string'
    && typeof task.description === 'string'
    && (task.status === 'todo' || task.status === 'in-progress' || task.status === 'completed')
    && (task.priority === 'low' || task.priority === 'medium' || task.priority === 'high')
    && typeof task.deadline === 'string'
    && typeof task.createdAt === 'string'
    && (task.sourceStagePlanId === undefined || typeof task.sourceStagePlanId === 'string')
}

export function loadPlanningTasks(userId: string): PlanningTask[] {
  if (typeof window === 'undefined') return []
  const parsed = localStorageDataProvider.get<unknown>(userId, 'tasks')
  return Array.isArray(parsed) ? parsed.filter((task) => isPlanningTask(task) && task.userId === userId) : []
}

export function savePlanningTasks(userId: string, tasks: PlanningTask[]) {
  if (typeof window === 'undefined') return
  if (!localStorageDataProvider.set(userId, 'tasks', tasks.filter((task) => task.userId === userId))) return
  window.dispatchEvent(new Event(PLANNING_TASKS_CHANGED_EVENT))
}

export function createPlanningTasks(userId: string, drafts: Omit<PlanningTask, 'id' | 'createdAt'>[]) {
  const createdAt = new Date().toISOString()
  const additions = drafts.filter((draft) => draft.userId === userId).map((draft): PlanningTask => ({
    ...draft,
    id: globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt,
  }))
  savePlanningTasks(userId, [...loadPlanningTasks(userId), ...additions])
  return additions
}