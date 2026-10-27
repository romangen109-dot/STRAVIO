import type { AgentContext, AgentMessage, AgentProposal } from '../types'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { addLocalActivity, readLocalWorkspace, updateLocalWorkspace } from './localWorkspace'
import { invalidatePlanningTaskCache } from './taskService'
import { requireSupabase } from './supabaseClient'
import { logClientError } from './errorHandling'

export async function getStrategyMessages(userId: string, strategyId: string) {
  return readLocalWorkspace(userId).chats[strategyId] ?? []
}

export async function getAgentHistory(userId: string) {
  return readLocalWorkspace(userId).chats
}

export async function requestAgentResponse(context: AgentContext, prompt: string) {
  const client = requireSupabase()
  const hasOpenedStrategyDocument = context.currentDocument && context.documents.some((document) => document.id === context.currentDocument?.id)
  const { data, error } = await client.functions.invoke('ai', {
    body: {
      action: 'respond',
      strategyId: context.strategy.id,
      prompt,
      responseLanguage: context.language,
      activeView: context.activeView,
      currentDocumentId: hasOpenedStrategyDocument ? context.currentDocument?.id : undefined,
      currentDocumentContent: hasOpenedStrategyDocument ? context.currentDocument?.content : undefined,
    },
  })
  if (error) {
    logClientError('request AI response', error)
    if (error instanceof FunctionsHttpError) {
      let responseBody: unknown
      try {
        responseBody = await error.context.clone().json()
      } catch (responseError) {
        logClientError('read AI error response', responseError)
        throw new Error('AI service returned an unreadable error response.')
      }
      if (typeof responseBody === 'object' && responseBody !== null && 'error' in responseBody && typeof responseBody.error === 'string') {
        throw new Error(responseBody.error)
      }
    }
    throw new Error('AI request failed. Please try again.')
  }
  if (!data || typeof data !== 'object' || !('message' in data) || !('userMessage' in data)) throw new Error('AI endpoint returned an invalid response.')
  const userMessage = fromResponse(data.userMessage)
  const message = fromResponse(data.message)
  updateLocalWorkspace(context.userId, (workspace) => {
    const history = workspace.chats[context.strategy.id] ?? []
    workspace.chats[context.strategy.id] = [...history, userMessage, message].slice(-120)
  })
  return { userMessage, message, connected: true }
}

export async function resolveAgentProposal(userId: string, strategyId: string, messageId: string, action: 'apply' | 'cancel') {
  updateLocalWorkspace(userId, (workspace) => {
    const message = (workspace.chats[strategyId] ?? []).find((entry) => entry.id === messageId)
    if (!message?.proposal || message.proposal.status !== 'pending') {
      throw new Error('This proposal is no longer available. Review the current strategy and try again.')
    }
    const proposal = message.proposal
    if (action === 'cancel') {
      proposal.status = 'cancelled'
      return
    }
    if (proposal.kind === 'update-desired-state') {
      if (proposal.userId !== userId || proposal.strategyId !== strategyId) throw new Error('This proposal does not belong to the current local profile.')
      const strategy = workspace.strategies.find((entry) => entry.id === strategyId)
      if (!strategy || strategy.desiredState.destination !== proposal.previousValue) {
        throw new Error('The strategy changed; request a new proposal before applying this change.')
      }
      strategy.desiredState.destination = proposal.proposedValue
      strategy.updatedAt = new Date().toISOString()
      addLocalActivity(workspace, userId, 'ai-action-applied', strategy.name, strategyId)
    } else {
      if (!proposal.tasks.length || proposal.tasks.length > 20 || proposal.tasks.some((task) => task.userId !== userId || task.strategyId !== strategyId)) {
        throw new Error('This proposal contains tasks for a different local profile.')
      }
      const sourceStagePlans = new Set<string>()
      for (const task of proposal.tasks) {
        if (task.sourceStagePlanId && (sourceStagePlans.has(task.sourceStagePlanId)
          || workspace.tasks.some((existing) => existing.strategyId === strategyId && existing.sourceStagePlanId === task.sourceStagePlanId))) {
          throw new Error('Tasks already exist for one or more proposed stage plans.')
        }
        if (task.sourceStagePlanId) sourceStagePlans.add(task.sourceStagePlanId)
      }
      const tasks = proposal.tasks.map((task) => ({
        ...task,
        id: globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
      }))
      workspace.tasks.unshift(...tasks)
      for (const task of tasks) addLocalActivity(workspace, userId, 'task-created', task.title, strategyId)
      invalidatePlanningTaskCache(userId)
      addLocalActivity(workspace, userId, 'ai-action-applied', 'AI task proposal applied', strategyId)
    }
    proposal.status = 'applied'
  })
}

export async function clearStrategyMessages(userId: string, strategyId: string) {
  updateLocalWorkspace(userId, (workspace) => {
    workspace.chats[strategyId] = []
  })
}

function fromResponse(value: unknown): AgentMessage {
  if (typeof value !== 'object' || value === null) throw new Error('AI endpoint returned an invalid message.')
  const row = value as Record<string, unknown>
  const userId = row.userId ?? row.user_id
  const strategyId = row.strategyId ?? row.strategy_id
  if (typeof row.id !== 'string' || typeof userId !== 'string' || typeof strategyId !== 'string' || (row.role !== 'user' && row.role !== 'agent') || typeof row.content !== 'string' || typeof row.createdAt !== 'string') {
    throw new Error('AI endpoint returned an invalid message.')
  }
  return { id: row.id, userId, strategyId, role: row.role, content: row.content, createdAt: row.createdAt, proposal: row.proposal as AgentProposal | undefined }
}
