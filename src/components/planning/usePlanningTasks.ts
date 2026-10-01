import { useCallback, useEffect, useState } from 'react'
import type { PlanningTask, StrategyStagePlan } from '../../types'
import { createPlanningTask, createPlanningTaskRecords, deletePlanningTask, getPlanningTasks, updatePlanningTask } from '../../data/taskService'
import { useCurrentUser } from '../auth/UserContext'
import { PLANNING_TASKS_CHANGED_EVENT } from '../../data/planningTasks'

export type NewPlanningTask = Omit<PlanningTask, 'id' | 'createdAt' | 'userId'>

export function usePlanningTasks() {
  const user = useCurrentUser()
  const [tasks, setTasks] = useState<PlanningTask[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const stored = await getPlanningTasks(user.id)
      setTasks(stored)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load Planning tasks.')
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    void refresh()
    window.addEventListener(PLANNING_TASKS_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(PLANNING_TASKS_CHANGED_EVENT, refresh)
  }, [refresh])

  const createTask = async (task: NewPlanningTask) => {
    setSaving(true)
    setError('')
    try {
      const created = await createPlanningTask({ ...task, userId: user.id })
      setTasks((current) => [created, ...current])
      window.dispatchEvent(new Event(PLANNING_TASKS_CHANGED_EVENT))
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not create the task.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const updateTask = async (id: string, changes: Partial<PlanningTask>) => {
    setSaving(true)
    setError('')
    try {
      const updated = await updatePlanningTask(user.id, id, changes)
      setTasks((current) => current.map((task) => task.id === id ? updated : task))
      window.dispatchEvent(new Event(PLANNING_TASKS_CHANGED_EVENT))
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update the task.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const deleteTask = async (id: string) => {
    setSaving(true)
    setError('')
    try {
      await deletePlanningTask(user.id, id)
      setTasks((current) => current.filter((task) => task.id !== id))
      window.dispatchEvent(new Event(PLANNING_TASKS_CHANGED_EVENT))
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not delete the task.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const createFromStagePlans = async (strategyId: string, stages: StrategyStagePlan[]) => {
    const existingPlans = new Set(tasks.filter((task) => task.strategyId === strategyId).map((task) => task.sourceStagePlanId).filter(Boolean))
    const additions = stages.filter((stage) => stage.title.trim() && !existingPlans.has(stage.id)).map((stage) => ({
      userId: user.id,
      strategyId,
      stageId: 'stage-plans',
      title: stage.title.trim(),
      description: stage.actions.trim() || stage.objective.trim() || stage.expectedResult.trim(),
      status: 'todo' as const,
      priority: 'medium' as const,
      deadline: '',
      sourceStagePlanId: stage.id,
    }))
    if (!additions.length) return 0
    setSaving(true)
    setError('')
    try {
      const created = await createPlanningTaskRecords(additions)
      setTasks((current) => [...created, ...current])
      window.dispatchEvent(new Event(PLANNING_TASKS_CHANGED_EVENT))
      return created.length
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not create tasks from Stage Plans.')
      return 0
    } finally {
      setSaving(false)
    }
  }

  return { tasks, createTask, updateTask, deleteTask, createFromStagePlans, loading, saving, error }
}