import type { PlanningTask } from '../types'
import { requireSupabase } from './supabaseClient'

type TaskRow = {
  id: string
  user_id: string
  strategy_id: string
  stage_id: string
  title: string
  description: string
  status: PlanningTask['status']
  priority: PlanningTask['priority']
  deadline: string | null
  source_stage_plan_id: string | null
  created_at: string
}

const taskColumns = 'id,user_id,strategy_id,stage_id,title,description,status,priority,deadline,source_stage_plan_id,created_at'
const taskCache = new Map<string, PlanningTask[]>()
const pendingTaskRequests = new Map<string, Promise<PlanningTask[]>>()
const taskCacheVersions = new Map<string, number>()

function fromTaskRow(row: TaskRow): PlanningTask {
  return { id: row.id, userId: row.user_id, strategyId: row.strategy_id, stageId: row.stage_id, title: row.title, description: row.description, status: row.status, priority: row.priority, deadline: row.deadline ?? '', sourceStagePlanId: row.source_stage_plan_id ?? undefined, createdAt: row.created_at }
}

export function invalidatePlanningTaskCache(userId: string) {
  taskCacheVersions.set(userId, (taskCacheVersions.get(userId) ?? 0) + 1)
  taskCache.delete(userId)
  pendingTaskRequests.delete(userId)
}

export async function getPlanningTasks(userId: string, strategyId?: string) {
  const cached = taskCache.get(userId)
  let request = cached ? Promise.resolve(cached) : pendingTaskRequests.get(userId)
  if (!request) {
    const version = taskCacheVersions.get(userId) ?? 0
    const query = requireSupabase().from('tasks').select(taskColumns).eq('user_id', userId).order('created_at', { ascending: false })
    const pending = (async () => {
      const { data, error } = await query
      if (error) throw error
      const tasks = (data as TaskRow[]).map(fromTaskRow)
      if ((taskCacheVersions.get(userId) ?? 0) === version) taskCache.set(userId, tasks)
      return tasks
    })()
    pendingTaskRequests.set(userId, pending)
    request = pending
  }
  try {
    const tasks = await request
    return strategyId ? tasks.filter((task) => task.strategyId === strategyId) : tasks
  } finally {
    if (pendingTaskRequests.get(userId) === request) pendingTaskRequests.delete(userId)
  }
}

export type NewTaskRecord = Omit<PlanningTask, 'id' | 'createdAt'>

export async function createPlanningTask(task: NewTaskRecord) {
  const { data, error } = await requireSupabase().from('tasks').insert({
    id: globalThis.crypto.randomUUID(),
    user_id: task.userId,
    strategy_id: task.strategyId,
    stage_id: task.stageId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    deadline: task.deadline || null,
    source_stage_plan_id: task.sourceStagePlanId ?? null,
  }).select(taskColumns).single()
  if (error) throw error
  invalidatePlanningTaskCache(task.userId)
  return fromTaskRow(data as TaskRow)
}

export async function createPlanningTaskRecords(tasks: NewTaskRecord[]) {
  if (!tasks.length) return []
  const rows = tasks.map((task) => ({
    id: globalThis.crypto.randomUUID(),
    user_id: task.userId,
    strategy_id: task.strategyId,
    stage_id: task.stageId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    deadline: task.deadline || null,
    source_stage_plan_id: task.sourceStagePlanId ?? null,
  }))
  const { data, error } = await requireSupabase().from('tasks').insert(rows).select(taskColumns)
  if (error) throw error
  invalidatePlanningTaskCache(tasks[0].userId)
  return (data as TaskRow[]).map(fromTaskRow)
}

export async function updatePlanningTask(userId: string, id: string, changes: Partial<Pick<PlanningTask, 'title' | 'description' | 'stageId' | 'status' | 'priority' | 'deadline'>>) {
  const values = {
    ...(changes.title !== undefined ? { title: changes.title } : {}),
    ...(changes.description !== undefined ? { description: changes.description } : {}),
    ...(changes.stageId !== undefined ? { stage_id: changes.stageId } : {}),
    ...(changes.status !== undefined ? { status: changes.status } : {}),
    ...(changes.priority !== undefined ? { priority: changes.priority } : {}),
    ...(changes.deadline !== undefined ? { deadline: changes.deadline || null } : {}),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await requireSupabase().from('tasks').update(values).eq('user_id', userId).eq('id', id).select(taskColumns).single()
  if (error) throw error
  invalidatePlanningTaskCache(userId)
  return fromTaskRow(data as TaskRow)
}

export async function deletePlanningTask(userId: string, id: string) {
  const { error } = await requireSupabase().from('tasks').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
  invalidatePlanningTaskCache(userId)
}