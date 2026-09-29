import { useEffect, useState } from 'react'
import type { StrategyData } from '../../types'
import { createInitialStrategy } from '../../data/strategyAlgorithm'

const STORAGE_KEY = 'stravio.strategy.v1'

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
  return typeof strategy.id === 'string'
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

function loadStrategy(): StrategyData {
  if (typeof window === 'undefined') return createInitialStrategy()
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (isStrategyData(parsed)) return parsed
    }
  } catch {
    return createInitialStrategy()
  }
  return createInitialStrategy()
}

export function useStrategy() {
  const [strategy, setStrategy] = useState<StrategyData>(loadStrategy)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(strategy))
    } catch {}
  }, [strategy])

  const updateStrategy = (update: (current: StrategyData) => StrategyData) => {
    setStrategy((current) => ({ ...update(current), updatedAt: new Date().toISOString() }))
  }

  return { strategy, updateStrategy }
}