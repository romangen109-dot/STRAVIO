import type { StrategyData } from '../types'
import { localStorageDataProvider } from './storage'
import type { Json } from './database.types'
import { requireSupabase } from './supabaseClient'
import { getStrategies } from './strategyService'
import { PLANNING_TASKS_CHANGED_EVENT } from './planningTasks'

type JsonRecord = Record<string, unknown>
type ImportPayload = {
  version: '1'
  strategies: JsonRecord[]
  documents: JsonRecord[]
  tasks: JsonRecord[]
  messages: JsonRecord[]
  activity: JsonRecord[]
}

export type LocalImportPreview = { localAccountFound: boolean; counts: Record<keyof Omit<ImportPayload, 'version'>, number> }

const localAuthKey = 'stravio.local-auth.v1'
const legacyOwnerKey = 'stravio.legacy-data-owner.v1'
const legacyKeys = {
  strategy: 'stravio.strategy.v1',
  documents: 'stravio.strategy-documents.v1',
  tasks: 'stravio.planning-tasks.v1',
  'ai-history': 'stravio.ai-chats.v1',
  activity: 'stravio.activity.v1',
} as const

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findLocalAccount(email: string) {
  const raw = window.localStorage.getItem(localAuthKey)
  if (!raw) return null
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  if (!isRecord(parsed) || !Array.isArray(parsed.accounts)) return null
  const account = parsed.accounts.find((entry) => isRecord(entry) && isRecord(entry.user) && typeof entry.user.email === 'string' && entry.user.email.toLowerCase() === email.toLowerCase())
  return isRecord(account) && isRecord(account.user) && typeof account.user.id === 'string' ? account.user.id : null
}

function stableId(userId: string, kind: string, originalId: string) {
  return `local-import:${userId}:${kind}:${encodeURIComponent(originalId)}`
}

function readLocalCollection<T>(localUserId: string, collection: keyof typeof legacyKeys): T | undefined {
  const scoped = localStorageDataProvider.get<T>(localUserId, collection)
  if (scoped !== undefined) return scoped
  if (window.localStorage.getItem(legacyOwnerKey) !== localUserId) return undefined
  const raw = window.localStorage.getItem(legacyKeys[collection])
  if (raw === null) return undefined
  try { return JSON.parse(raw) as T } catch { throw new Error(`Local ${collection} data is invalid and was not imported.`) }
}

function buildImportPayload(email: string, userId: string): ImportPayload {
  const localUserId = findLocalAccount(email)
  if (!localUserId) throw new Error('No matching local account found in this browser.')
  const activeStrategy = readLocalCollection<unknown>(localUserId, 'strategy')
  const localDocuments = readLocalCollection<unknown>(localUserId, 'documents')
  const localTasks = readLocalCollection<unknown>(localUserId, 'tasks')
  const localChats = readLocalCollection<unknown>(localUserId, 'ai-history')
  const localActivity = readLocalCollection<unknown>(localUserId, 'activity')

  const strategySnapshots = new Map<string, StrategyData>()
  if (isRecord(activeStrategy) && typeof activeStrategy.id === 'string') strategySnapshots.set(activeStrategy.id, activeStrategy as unknown as StrategyData)
  if (Array.isArray(localDocuments)) for (const document of localDocuments) {
    if (isRecord(document) && isRecord(document.strategy) && typeof document.strategy.id === 'string') strategySnapshots.set(document.strategy.id, document.strategy as unknown as StrategyData)
  }
  if (strategySnapshots.size > 100) throw new Error('Local data exceeds the supported strategy limit.')

  const strategyIds = new Map([...strategySnapshots.keys()].map((id) => [id, stableId(userId, 'strategy', id)]))
  const documentIds = new Map<string, string>()
  if (Array.isArray(localDocuments)) for (const document of localDocuments) {
    if (isRecord(document) && typeof document.id === 'string') documentIds.set(document.id, stableId(userId, 'document', document.id))
  }

  const strategies = [...strategySnapshots.entries()].map(([id, strategy]) => ({
    id: strategyIds.get(id),
    name: strategy.name,
    description: strategy.description,
    data: { ...strategy, id: strategyIds.get(id), userId },
    workflow_step: strategy.workflowStep,
    completed: strategy.completed,
    created_at: strategy.createdAt,
    updated_at: strategy.updatedAt,
  }))

  const documents = Array.isArray(localDocuments) ? localDocuments.filter(isRecord).map((document) => {
    const oldStrategyId = isRecord(document.strategy) && typeof document.strategy.id === 'string' ? document.strategy.id : ''
    const strategy = strategySnapshots.get(oldStrategyId)
    if (!strategy || !strategyIds.has(oldStrategyId) || typeof document.id !== 'string') throw new Error('A local document has no valid owning strategy.')
    return {
      id: documentIds.get(document.id),
      strategy_id: strategyIds.get(oldStrategyId),
      title: typeof document.title === 'string' ? document.title : 'Untitled Strategy',
      content: typeof document.content === 'string' ? document.content : '',
      status: document.status === 'edited' ? 'edited' : 'ready',
      strategy_snapshot: { ...strategy, id: strategyIds.get(oldStrategyId), userId },
      created_at: document.createdAt,
      updated_at: document.updatedAt,
    }
  }) : []

  const tasks = Array.isArray(localTasks) ? localTasks.filter(isRecord).map((task) => {
    if (typeof task.id !== 'string' || typeof task.strategyId !== 'string' || !strategyIds.has(task.strategyId)) throw new Error('A local task has no valid owning strategy.')
    return {
      id: stableId(userId, 'task', task.id),
      strategy_id: strategyIds.get(task.strategyId),
      stage_id: typeof task.stageId === 'string' ? task.stageId : 'stage-plans',
      title: typeof task.title === 'string' ? task.title : 'Untitled task',
      description: typeof task.description === 'string' ? task.description : '',
      status: task.status === 'completed' || task.status === 'in-progress' ? task.status : 'todo',
      priority: task.priority === 'high' || task.priority === 'low' ? task.priority : 'medium',
      deadline: typeof task.deadline === 'string' ? task.deadline : '',
      source_stage_plan_id: typeof task.sourceStagePlanId === 'string' ? task.sourceStagePlanId : null,
      created_at: task.createdAt,
    }
  }) : []

  const messages: JsonRecord[] = []
  if (isRecord(localChats)) for (const [oldStrategyId, entries] of Object.entries(localChats)) {
    const mappedStrategyId = strategyIds.get(oldStrategyId)
    if (!mappedStrategyId || !Array.isArray(entries)) continue
    for (const message of entries) {
      if (!isRecord(message) || typeof message.id !== 'string' || typeof message.content !== 'string' || (message.role !== 'user' && message.role !== 'agent')) continue
      let proposal = message.proposal
      if (isRecord(proposal) && proposal.kind === 'update-desired-state') proposal = { ...proposal, userId, strategyId: mappedStrategyId }
      if (isRecord(proposal) && proposal.kind === 'create-tasks' && Array.isArray(proposal.tasks)) proposal = { ...proposal, tasks: proposal.tasks.map((task) => isRecord(task) ? { ...task, userId, strategyId: mappedStrategyId } : task) }
      messages.push({ id: stableId(userId, 'message', message.id), strategy_id: mappedStrategyId, role: message.role, content: message.content, proposal, created_at: message.createdAt })
    }
  }

  const activity = Array.isArray(localActivity) ? localActivity.filter(isRecord).flatMap((entry) => {
    if (typeof entry.id !== 'string' || typeof entry.type !== 'string') return []
    const strategyId = typeof entry.strategyId === 'string' ? strategyIds.get(entry.strategyId) : undefined
    if (typeof entry.strategyId === 'string' && !strategyId) return []
    const documentId = typeof entry.documentId === 'string' ? documentIds.get(entry.documentId) : undefined
    return [{ id: stableId(userId, 'activity', entry.id), strategy_id: strategyId, document_id: documentId, type: entry.type, title: typeof entry.title === 'string' ? entry.title : entry.type, created_at: entry.createdAt }]
  }) : []

  return { version: '1', strategies, documents, tasks, messages, activity }
}

export function getLocalImportPreview(email: string, userId: string): LocalImportPreview {
  try {
    const payload = buildImportPayload(email, userId)
    return { localAccountFound: true, counts: { strategies: payload.strategies.length, documents: payload.documents.length, tasks: payload.tasks.length, messages: payload.messages.length, activity: payload.activity.length } }
  } catch {
    return { localAccountFound: false, counts: { strategies: 0, documents: 0, tasks: 0, messages: 0, activity: 0 } }
  }
}

export async function importLocalWorkspace(email: string, userId: string) {
  const payload = buildImportPayload(email, userId)
  const normalizedPayload = JSON.parse(JSON.stringify(payload)) as Json
  const { data, error } = await requireSupabase().rpc('import_local_workspace', { payload: normalizedPayload })
  if (error) throw error
  const strategies = await getStrategies(userId)
  if (strategies[0]) window.dispatchEvent(new CustomEvent('stravio:strategy-data', { detail: strategies[0] }))
  window.dispatchEvent(new Event(PLANNING_TASKS_CHANGED_EVENT))
  window.dispatchEvent(new Event('stravio:workspace-refresh'))
  return data as LocalImportPreview['counts']
}