import { useEffect, useRef, useState } from 'react'
import type { StrategyData } from '../../types'
import { createInitialStrategy } from '../../data/strategyAlgorithm'
import { recordStrategyActivity } from '../../data/strategyActivity'
import { localStorageDataProvider } from '../../data/storage'
import { useCurrentUser } from '../auth/UserContext'

export const STRATEGY_DATA_EVENT = 'stravio:strategy-data'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasStringFields(value: unknown, fields: string[]) {
  return isRecord(value) && fields.every((field) => typeof value[field] === 'string')
}

function isStrategyData(value: unknown): value is StrategyData {
  if (!isRecord(value)) return false
  const strategy = value
  const planFields = ['objective', 'approach', 'keyActions', 'risks', 'resources']
  const currentFields = ['situation', 'resources', 'skills', 'constraints', 'problems', 'opportunities']
  const desiredFields = ['destination', 'successPicture', 'indicators', 'timeframe', 'changes']
  const optionFieldsValid = Array.isArray(strategy.strategicOptions) && strategy.strategicOptions.every((option) => isRecord(option)
    && typeof option.id === 'string' && typeof option.title === 'string' && typeof option.description === 'string'
    && Array.isArray(option.advantages) && Array.isArray(option.risks) && Array.isArray(option.requiredResources))
  const plansValid = isRecord(strategy.plans) && hasStringFields(strategy.plans.A, planFields) && hasStringFields(strategy.plans.B, planFields)
  const stagesValid = Array.isArray(strategy.stages) && strategy.stages.every((stage) => hasStringFields(stage, ['id', 'title', 'objective', 'actions', 'expectedResult', 'dependencies']))
  const controlValid = isRecord(strategy.control)
    && Array.isArray(strategy.control.metrics)
    && strategy.control.metrics.every((metric) => hasStringFields(metric, ['id', 'name', 'target', 'currentValue', 'reviewDate']))
    && hasStringFields(strategy.control, ['risks', 'warningSigns', 'reviewConditions'])
  return typeof strategy.userId === 'string'
    && typeof strategy.id === 'string'
    && typeof strategy.name === 'string'
    && typeof strategy.description === 'string'
    && typeof strategy.createdAt === 'string'
    && typeof strategy.updatedAt === 'string'
    && Number.isInteger(strategy.workflowStep)
    && Number(strategy.workflowStep) >= 0 && Number(strategy.workflowStep) <= 5
    && typeof strategy.completed === 'boolean'
    && Array.isArray(strategy.selectedOptionIds)
    && strategy.selectedOptionIds.every((id) => typeof id === 'string')
    && optionFieldsValid
    && hasStringFields(strategy.currentState, currentFields)
    && hasStringFields(strategy.desiredState, desiredFields)
    && plansValid
    && stagesValid
    && controlValid
}

export function loadStrategyData(userId: string): StrategyData {
  const stored = localStorageDataProvider.get<unknown>(userId, 'strategy')
  return isStrategyData(stored) && stored.userId === userId ? stored : createInitialStrategy(userId)
}

export function saveStrategyData(strategy: StrategyData) {
  if (typeof window === 'undefined') return
  localStorageDataProvider.set(strategy.userId, 'strategy', strategy)
  window.dispatchEvent(new Event(STRATEGY_DATA_EVENT))
}

export function hasStrategyProgress(strategy: StrategyData) {
  return strategy.workflowStep > 0
    || strategy.completed
    || Object.values(strategy.currentState).some((value) => value.trim())
    || Object.values(strategy.desiredState).some((value) => value.trim())
    || strategy.selectedOptionIds.length > 0
    || (['A', 'B'] as const).some((plan) => Object.values(strategy.plans[plan]).some((value) => value.trim()))
    || strategy.stages.some((stage) => Object.values(stage).some((value) => typeof value === 'string' && value.trim()))
    || strategy.control.metrics.some((metric) => Object.values(metric).some((value) => typeof value === 'string' && value.trim()))
    || Boolean(strategy.control.risks.trim() || strategy.control.warningSigns.trim() || strategy.control.reviewConditions.trim())
}

export function useStrategy() {
  const user = useCurrentUser()
  const [strategy, setStrategy] = useState<StrategyData>(() => loadStrategyData(user.id))
  const previousStrategy = useRef(strategy)

  useEffect(() => {
    const hasStoredStrategy = localStorageDataProvider.get<StrategyData>(user.id, 'strategy') !== undefined
    if (hasStoredStrategy || hasStrategyProgress(strategy)) saveStrategyData(strategy)
    const previous = previousStrategy.current
    if (previous !== strategy) {
      const wasStarted = hasStrategyProgress(previous)
      const isStarted = hasStrategyProgress(strategy)
      const previousData = { ...previous, workflowStep: 0, updatedAt: '' }
      const currentData = { ...strategy, workflowStep: 0, updatedAt: '' }
      if (!wasStarted && isStarted) recordStrategyActivity('strategy-created', 'Strategy created', strategy.id, undefined, user.id)
      else if (!previous.completed && strategy.completed) recordStrategyActivity('strategy-completed', 'Strategy completed', strategy.id, undefined, user.id)
      else if (isStarted && JSON.stringify(previousData) !== JSON.stringify(currentData)) recordStrategyActivity('strategy-updated', 'Strategy updated', strategy.id, undefined, user.id)
    }
    previousStrategy.current = strategy
  }, [strategy, user.id])

  useEffect(() => {
    const syncStrategy = () => {
      const stored = loadStrategyData(user.id)
      setStrategy((current) => JSON.stringify(current) === JSON.stringify(stored) ? current : stored)
    }
    window.addEventListener(STRATEGY_DATA_EVENT, syncStrategy)
    return () => window.removeEventListener(STRATEGY_DATA_EVENT, syncStrategy)
  }, [user.id])

  const updateStrategy = (update: (current: StrategyData) => StrategyData) => {
    setStrategy((current) => {
      const next = update(current)
      const now = new Date().toISOString()
      return {
        ...next,
        createdAt: !hasStrategyProgress(current) && hasStrategyProgress(next) ? now : next.createdAt,
        updatedAt: now,
      }
    })
  }

  return { strategy, updateStrategy }
}