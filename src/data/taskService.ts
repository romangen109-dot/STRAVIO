import type { PlanningTask } from '../types'
import { addLocalActivity, readLocalWorkspace, updateLocalWorkspace } from './localWorkspace'

const taskCache = new Map<string, PlanningTask[]>()

export function invalidatePlanningTaskCache(userId: string) {
  taskCache.delete(userId)
}

export async function getPlanningTasks(userId: string, strategyId?: string) {
  const tasks = taskCache.get(userId) ?? readLocalWorkspace(userId).tasks
  taskCache.set(userId, tasks)
  return strategyId ? tasks.filter((task) => task.strategyId === strategyId) : tasks
}

export type NewTaskRecord = Omit<PlanningTask, 'id' | 'createdAt'>

function createTaskRecord(task: NewTaskRecord): PlanningTask {
  return {
    ...task,
    id: globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
  }
}

export async function createPlanningTask(task: NewTaskRecord) {
  const created = createTaskRecord(task)
  updateLocalWorkspace(task.userId, (workspace) => {
    workspace.tasks.unshift(created)
    addLocalActivity(workspace, task.userId, 'task-created', created.title, created.strategyId)
  })
  invalidatePlanningTaskCache(task.userId)
  return created
}

export async function createPlanningTaskRecords(tasks: NewTaskRecord[]) {
  if (!tasks.length) return []
  const userId = tasks[0].userId
  if (tasks.some((task) => task.userId !== userId)) throw new Error('Tasks from different local profiles cannot be saved together.')
  const created = tasks.map(createTaskRecord)
  updateLocalWorkspace(userId, (workspace) => {
    workspace.tasks.unshift(...created)
    for (const task of created) addLocalActivity(workspace, userId, 'task-created', task.title, task.strategyId)
  })
  invalidatePlanningTaskCache(userId)
  return created
}

export async function updatePlanningTask(userId: string, id: string, changes: Partial<Pick<PlanningTask, 'title' | 'description' | 'stageId' | 'status' | 'priority' | 'deadline'>>) {
  const updated = updateLocalWorkspace(userId, (workspace) => {
    const task = workspace.tasks.find((entry) => entry.id === id)
    if (!task) throw new Error('The task no longer exists in this local profile.')
    const previousStatus = task.status
    Object.assign(task, changes)
    if (previousStatus !== 'completed' && task.status === 'completed') {
      addLocalActivity(workspace, userId, 'task-completed', task.title, task.strategyId)
    }
    return task
  })
  invalidatePlanningTaskCache(userId)
  return updated
}

export async function deletePlanningTask(userId: string, id: string) {
  updateLocalWorkspace(userId, (workspace) => {
    workspace.tasks = workspace.tasks.filter((task) => task.id !== id)
  })
  invalidatePlanningTaskCache(userId)
}
