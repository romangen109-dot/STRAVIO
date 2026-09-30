import { useEffect, useState } from 'react'
import { loadPlanningTasks, PLANNING_TASKS_CHANGED_EVENT, savePlanningTasks } from '../../data/planningTasks'
import type { PlanningTask, PlanningTaskStatus, StrategyStagePlan } from '../../types'
import { useCurrentUser } from '../auth/UserContext'

export type NewPlanningTask = Omit<PlanningTask, 'id' | 'createdAt' | 'userId'>

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function usePlanningTasks() {
  const user = useCurrentUser()
  const [tasks, setTasks] = useState<PlanningTask[]>(() => loadPlanningTasks(user.id))

  useEffect(() => {
    savePlanningTasks(user.id, tasks)
  }, [tasks, user.id])

  useEffect(() => {
    const syncTasks = () => {
      const stored = loadPlanningTasks(user.id)
      setTasks((current) => JSON.stringify(current) === JSON.stringify(stored) ? current : stored)
    }
    window.addEventListener(PLANNING_TASKS_CHANGED_EVENT, syncTasks)
    return () => window.removeEventListener(PLANNING_TASKS_CHANGED_EVENT, syncTasks)
  }, [user.id])

  const createTask = (task: NewPlanningTask) => setTasks((current) => [...current, {
    ...task,
    userId: user.id,
    id: createId(),
    createdAt: new Date().toISOString(),
  }])

  const updateTask = (id: string, changes: Partial<PlanningTask>) => setTasks((current) => current.map((task) => task.id === id ? { ...task, ...changes } : task))

  const deleteTask = (id: string) => setTasks((current) => current.filter((task) => task.id !== id))

  const createFromStagePlans = (strategyId: string, stages: StrategyStagePlan[]) => setTasks((current) => {
    const existingPlans = new Set(current.filter((task) => task.strategyId === strategyId).map((task) => task.sourceStagePlanId).filter(Boolean))
    const createdAt = new Date().toISOString()
    const additions = stages.filter((stage) => stage.title.trim() && !existingPlans.has(stage.id)).map((stage): PlanningTask => ({
      id: createId(),
      userId: user.id,
      strategyId,
      stageId: 'stage-plans',
      title: stage.title.trim(),
      description: stage.actions.trim() || stage.objective.trim() || stage.expectedResult.trim(),
      status: 'todo' satisfies PlanningTaskStatus,
      priority: 'medium',
      deadline: '',
      createdAt,
      sourceStagePlanId: stage.id,
    }))
    return additions.length ? [...current, ...additions] : current
  })

  return { tasks, createTask, updateTask, deleteTask, createFromStagePlans }
}