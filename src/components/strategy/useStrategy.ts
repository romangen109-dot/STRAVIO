import { useEffect, useRef, useState } from 'react'
import type { StrategyData } from '../../types'
import { createInitialStrategy } from '../../data/strategyAlgorithm'
import { logClientError, userFacingError } from '../../data/errorHandling'
import { createStrategy as persistNewStrategy, deleteStrategy as removeStrategy, getCachedActiveStrategy, getStrategies, selectActiveStrategy, updateStrategy as persistStrategy } from '../../data/strategyService'
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
  return getCachedActiveStrategy(userId)
}

export async function saveStrategyData(strategy: StrategyData) {
  const saved = await persistStrategy(strategy)
  window.dispatchEvent(new CustomEvent<StrategyData>(STRATEGY_DATA_EVENT, { detail: saved }))
  return saved
}

export function hasStrategyProgress(strategy: StrategyData) {
  return (strategy.name.trim() !== '' && strategy.name !== 'Untitled Strategy')
    || Boolean(strategy.description.trim())
    || strategy.workflowStep > 0
    || strategy.completed
    || Object.values(strategy.currentState).some((value) => value.trim())
    || Object.values(strategy.desiredState).some((value) => value.trim())
    || strategy.strategicOptions.some((option) => Object.values(option).some((value) => Array.isArray(value) ? value.some((item) => item.trim()) : typeof value === 'string' && value.trim()))
    || strategy.selectedOptionIds.length > 0
    || (['A', 'B'] as const).some((plan) => Object.values(strategy.plans[plan]).some((value) => value.trim()))
    || strategy.stages.some((stage) => Object.values(stage).some((value) => typeof value === 'string' && value.trim()))
    || strategy.control.metrics.some((metric) => Object.values(metric).some((value) => typeof value === 'string' && value.trim()))
    || Boolean(strategy.control.risks.trim() || strategy.control.warningSigns.trim() || strategy.control.reviewConditions.trim())
}

export function useStrategy() {
  const user = useCurrentUser()
  const [strategy, setStrategy] = useState<StrategyData>(() => loadStrategyData(user.id))
  const [strategies, setStrategies] = useState<StrategyData[]>([])
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const lastSaved = useRef('')

  useEffect(() => {
    let active = true
    setLoading(true)
    getStrategies(user.id).then((strategies) => {
      if (!active) return
      const loaded = strategies[0] ?? createInitialStrategy(user.id)
      setStrategies(strategies)
      lastSaved.current = JSON.stringify(loaded)
      setStrategy(loaded)
      setLoadError('')
      setError('')
      window.dispatchEvent(new CustomEvent(STRATEGY_DATA_EVENT, { detail: loaded }))
    }).catch((loadError: unknown) => {
      logClientError('load strategy', loadError)
      if (active) setLoadError(userFacingError(loadError, 'Could not load your strategy. Please try again.'))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [user.id])

  useEffect(() => {
    if (loading || (!hasStrategyProgress(strategy) && !strategies.some((entry) => entry.id === strategy.id))) return
    const serialized = JSON.stringify(strategy)
    if (serialized === lastSaved.current) return
    let active = true
    setSaveState('idle')
    const timer = window.setTimeout(() => {
      setSaveState('saving')
      void saveStrategyData(strategy).then((saved) => {
        if (!active) return
        lastSaved.current = JSON.stringify(saved)
        setStrategies((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)])
        setSaveState('saved')
        setError('')
      }).catch((saveError: unknown) => {
        if (!active) return
        logClientError('save strategy', saveError)
        setSaveState('error')
        setError(userFacingError(saveError, 'Strategy was not saved. Please try again.'))
      })
    }, 500)
    return () => { active = false; window.clearTimeout(timer) }
  }, [loading, strategy, strategies])

  useEffect(() => {
    const syncStrategy = (event: Event) => {
      const stored = event instanceof CustomEvent && isStrategyData(event.detail) ? event.detail : loadStrategyData(user.id)
      setStrategy((current) => JSON.stringify(current) === JSON.stringify(stored) ? current : stored)
      lastSaved.current = JSON.stringify(stored)
      setSaveState('saved')
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

  const chooseStrategy = (strategyId: string) => {
    const selected = selectActiveStrategy(user.id, strategyId)
    setStrategy(selected)
    lastSaved.current = JSON.stringify(selected)
    setSaveState('saved')
    setError('')
    window.dispatchEvent(new CustomEvent<StrategyData>(STRATEGY_DATA_EVENT, { detail: selected }))
  }

  const createNewStrategy = async () => {
    setError('')
    try {
      const created = await persistNewStrategy(createInitialStrategy(user.id))
      setStrategies((current) => [created, ...current.filter((entry) => entry.id !== created.id)])
      setStrategy(created)
      lastSaved.current = JSON.stringify(created)
      setSaveState('saved')
      window.dispatchEvent(new CustomEvent<StrategyData>(STRATEGY_DATA_EVENT, { detail: created }))
      return true
    } catch (createError) {
      logClientError('create strategy', createError)
      setError(userFacingError(createError, 'Strategy was not created. Please try again.'))
      return false
    }
  }

  const deleteCurrentStrategy = async () => {
    setError('')
    try {
      await removeStrategy(user.id, strategy.id)
      const remaining = strategies.filter((entry) => entry.id !== strategy.id)
      setStrategies(remaining)
      const next = remaining[0] ?? createInitialStrategy(user.id)
      setStrategy(next)
      lastSaved.current = JSON.stringify(next)
      setSaveState(remaining.length ? 'saved' : 'idle')
      window.dispatchEvent(new CustomEvent<StrategyData>(STRATEGY_DATA_EVENT, { detail: next }))
      return true
    } catch (deleteError) {
      logClientError('delete strategy', deleteError)
      setError(userFacingError(deleteError, 'Strategy was not deleted. Please try again.'))
      return false
    }
  }

  return { strategy, strategies, updateStrategy, chooseStrategy, createNewStrategy, deleteCurrentStrategy, loading, loadError, saveState, error }
}