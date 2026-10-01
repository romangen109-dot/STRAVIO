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

function fromTaskRow(row: TaskRow): PlanningTask {
  return { id: row.id, userId: row.user_id, strategyId: row.strategy_id, stageId: row.stage_id, title: row.title, description: row.description, status: row.status, priority: row.priority, deadline: row.deadline ?? '', sourceStagePlanId: row.source_stage_plan_id ?? undefined, createdAt: row.created_at }
}

export async function getPlanningTasks(userId: string, strategyId?: string) {
  let request = requireSupabase().from('tasks').select(taskColumns).eq('user_id', userId).order('created_at', { ascending: false })
  if (strategyId) request = request.eq('strategy_id', strategyId)
  const { data, error } = await request
  if (error) throw error
  return (data as TaskRow[]).map(fromTaskRow)
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
  return fromTaskRow(data as TaskRow)
}

export async function deletePlanningTask(userId: string, id: string) {
  const { error } = await requireSupabase().from('tasks').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}