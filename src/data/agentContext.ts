import type { AgentContext, PlanningTask, StrategyData, StrategyDocument } from '../types'

type AgentContextInput = {
  userId: string
  language: 'ru' | 'en' | 'kk'
  strategy: StrategyData
  hasActiveStrategy: boolean
  tasks: PlanningTask[]
  documents: StrategyDocument[]
  activeView: string
  currentDocument?: AgentContext['currentDocument']
}

export function createAgentContext(input: AgentContextInput): AgentContext {
  return {
    ...input,
    tasks: input.hasActiveStrategy ? input.tasks.filter((task) => task.strategyId === input.strategy.id) : [],
    documents: input.documents.filter((document) => document.strategy.id === input.strategy.id),
  }
}
