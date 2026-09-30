import type { User } from '../types'

export type UserDataCollection = 'strategy' | 'documents' | 'tasks' | 'ai-history' | 'activity' | 'files' | 'migration'
export const USER_DATA_CLEARED_EVENT = 'stravio:user-data-cleared'

export interface DataProvider {
  get<T>(userId: string, collection: UserDataCollection): T | undefined
  set<T>(userId: string, collection: UserDataCollection, value: T): boolean
  removeUserData(userId: string): void
}

export function userDataStorageKey(userId: string, collection: UserDataCollection) {
  return `stravio:user:${encodeURIComponent(userId)}:${collection}.v1`
}

export const localStorageDataProvider: DataProvider = {
  get<T>(userId: string, collection: UserDataCollection) {
    try {
      const stored = window.localStorage.getItem(userDataStorageKey(userId, collection))
      return stored === null ? undefined : JSON.parse(stored) as T
    } catch {
      return undefined
    }
  },
  set<T>(userId: string, collection: UserDataCollection, value: T) {
    try {
      window.localStorage.setItem(userDataStorageKey(userId, collection), JSON.stringify(value))
      return true
    } catch {
      return false
    }
  },
  removeUserData(userId: string) {
    const prefix = `stravio:user:${encodeURIComponent(userId)}:`
    const keys: string[] = []
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (key?.startsWith(prefix) && !key.endsWith(':migration.v1')) keys.push(key)
    }
    keys.forEach((key) => window.localStorage.removeItem(key))
    localStorageDataProvider.set(userId, 'migration', { complete: true, foundLegacyData: true, clearedAt: new Date().toISOString() })
    window.dispatchEvent(new Event(USER_DATA_CLEARED_EVENT))
  },
}

export type UserDataMigration = { complete: boolean; notice?: string }

const LEGACY_OWNER_KEY = 'stravio.legacy-data-owner.v1'
const LEGACY_KEYS = {
  strategy: 'stravio.strategy.v1',
  documents: 'stravio.strategy-documents.v1',
  tasks: 'stravio.planning-tasks.v1',
  chats: 'stravio.ai-chats.v1',
  activity: 'stravio.activity.v1',
  files: 'stravio.project-files.v1',
} as const

function attachUserToStrategy(value: unknown, userId: string) {
  if (typeof value !== 'object' || value === null) return undefined
  return { ...value, userId } as Record<string, unknown>
}

function hasStringFields(value: unknown, fields: string[]) {
  return typeof value === 'object' && value !== null && fields.every((field) => typeof (value as Record<string, unknown>)[field] === 'string')
}

function migrateStrategy(value: unknown, user: User) {
  const strategy = attachUserToStrategy(value, user.id)
  if (!strategy) return undefined
  const planFields = ['objective', 'approach', 'keyActions', 'risks', 'resources']
  const currentFields = ['situation', 'resources', 'skills', 'constraints', 'problems', 'opportunities']
  const desiredFields = ['destination', 'successPicture', 'indicators', 'timeframe', 'changes']
  const plansValid = typeof strategy.plans === 'object' && strategy.plans !== null
    && hasStringFields((strategy.plans as Record<string, unknown>).A, planFields)
    && hasStringFields((strategy.plans as Record<string, unknown>).B, planFields)
  const optionsValid = Array.isArray(strategy.strategicOptions) && strategy.strategicOptions.every((option) => typeof option === 'object' && option !== null
    && typeof option.id === 'string' && typeof option.title === 'string' && typeof option.description === 'string'
    && Array.isArray(option.advantages) && Array.isArray(option.risks) && Array.isArray(option.requiredResources))
  const stagesValid = Array.isArray(strategy.stages) && strategy.stages.every((stage) => hasStringFields(stage, ['id', 'title', 'objective', 'actions', 'expectedResult', 'dependencies']))
  const control = strategy.control as Record<string, unknown> | undefined
  const controlValid = control !== undefined && Array.isArray(control.metrics)
    && control.metrics.every((metric) => hasStringFields(metric, ['id', 'name', 'target', 'currentValue', 'reviewDate']))
    && hasStringFields(control, ['risks', 'warningSigns', 'reviewConditions'])
  const valid = typeof strategy.id === 'string'
    && typeof strategy.name === 'string'
    && typeof strategy.description === 'string'
    && typeof strategy.createdAt === 'string'
    && typeof strategy.updatedAt === 'string'
    && Number.isInteger(strategy.workflowStep)
    && Number(strategy.workflowStep) >= 0 && Number(strategy.workflowStep) <= 5
    && typeof strategy.completed === 'boolean'
    && Array.isArray(strategy.selectedOptionIds) && strategy.selectedOptionIds.every((id) => typeof id === 'string')
    && hasStringFields(strategy.currentState, currentFields)
    && hasStringFields(strategy.desiredState, desiredFields)
    && plansValid && optionsValid && stagesValid && controlValid
  if (!valid) return undefined
  return strategy
}

function migrateDocuments(value: unknown, user: User) {
  if (!Array.isArray(value)) return undefined
  const result: Record<string, unknown>[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null || typeof entry.id !== 'string' || typeof entry.content !== 'string' || typeof entry.strategy !== 'object' || entry.strategy === null) return undefined
    const strategy = migrateStrategy(entry.strategy, user)
    if (!strategy) return undefined
    result.push({ ...entry, userId: user.id, strategy })
  }
  return result
}

function migrateTasks(value: unknown, userId: string) {
  if (!Array.isArray(value)) return undefined
  const result: Record<string, unknown>[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null || typeof entry.id !== 'string' || typeof entry.strategyId !== 'string' || typeof entry.stageId !== 'string' || typeof entry.title !== 'string') return undefined
    result.push({ ...entry, userId })
  }
  return result
}

function migrateChats(value: unknown, userId: string) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const result: Record<string, Record<string, unknown>[]> = {}
  for (const [strategyId, entries] of Object.entries(value)) {
    if (!Array.isArray(entries)) return undefined
    const messages: Record<string, unknown>[] = []
    for (const entry of entries) {
      if (typeof entry !== 'object' || entry === null || typeof entry.id !== 'string' || typeof entry.content !== 'string') return undefined
      let proposal = entry.proposal
      if (typeof proposal === 'object' && proposal !== null) {
        const storedProposal = proposal as Record<string, unknown>
        proposal = storedProposal.kind === 'create-tasks' && Array.isArray(storedProposal.tasks)
          ? { ...storedProposal, tasks: storedProposal.tasks.map((task) => typeof task === 'object' && task !== null ? { ...task, userId } : task) }
          : storedProposal.kind === 'update-desired-state' ? { ...storedProposal, userId } : proposal
      }
      messages.push({ ...entry, userId, strategyId, proposal })
    }
    result[strategyId] = messages
  }
  return result
}

function migrateActivity(value: unknown, userId: string) {
  if (!Array.isArray(value)) return undefined
  if (value.some((entry) => typeof entry !== 'object' || entry === null || typeof entry.id !== 'string' || typeof entry.type !== 'string')) return undefined
  return value.map((entry) => ({ ...entry, userId }))
}

function migrateFiles(value: unknown, userId: string) {
  if (!Array.isArray(value)) return undefined
  if (value.some((entry) => typeof entry !== 'object' || entry === null || typeof entry.id !== 'string' || typeof entry.name !== 'string')) return undefined
  return value.map((entry) => ({ ...entry, userId }))
}

export function migrateLegacyUserData(user: User): UserDataMigration {
  try {
    const owner = window.localStorage.getItem(LEGACY_OWNER_KEY)
    const marker = localStorageDataProvider.get<{ complete: boolean }>(user.id, 'migration')
    if (marker?.complete) return { complete: true }
    if (owner && owner !== user.id) return { complete: false, notice: 'Existing anonymous local data belongs to a different local account and was left untouched.' }

    const migrations: [UserDataCollection, string, (value: unknown, user: User) => unknown][] = [
      ['strategy', LEGACY_KEYS.strategy, (value, currentUser) => migrateStrategy(value, currentUser)],
      ['documents', LEGACY_KEYS.documents, (value, currentUser) => migrateDocuments(value, currentUser)],
      ['tasks', LEGACY_KEYS.tasks, (value, currentUser) => migrateTasks(value, currentUser.id)],
      ['ai-history', LEGACY_KEYS.chats, (value, currentUser) => migrateChats(value, currentUser.id)],
      ['activity', LEGACY_KEYS.activity, (value, currentUser) => migrateActivity(value, currentUser.id)],
      ['files', LEGACY_KEYS.files, (value, currentUser) => migrateFiles(value, currentUser.id)],
    ]
    const warnings: string[] = []
    let foundLegacyData = false

    for (const [collection, legacyKey, transform] of migrations) {
      const raw = window.localStorage.getItem(legacyKey)
      if (raw === null) continue
      foundLegacyData = true
      let parsed: unknown
      try { parsed = JSON.parse(raw) } catch {
        warnings.push(legacyKey)
        continue
      }
      const migrated = transform(parsed, user)
      if (migrated === undefined) {
        warnings.push(legacyKey)
        continue
      }
      const scopedKey = userDataStorageKey(user.id, collection)
      if (window.localStorage.getItem(scopedKey) !== null) {
        warnings.push(legacyKey)
        continue
      }
      if (!localStorageDataProvider.set(user.id, collection, migrated)) return { complete: false, notice: 'Local data migration could not be completed. Existing data was left untouched.' }
    }

    localStorageDataProvider.set(user.id, 'migration', { complete: true, foundLegacyData, completedAt: new Date().toISOString() })
    if (!owner) window.localStorage.setItem(LEGACY_OWNER_KEY, user.id)
    if (warnings.length) return { complete: true, notice: 'Some older local data could not be safely migrated and remains untouched in this browser.' }
    return { complete: true, notice: foundLegacyData ? 'Existing local data has been linked to this local account.' : undefined }
  } catch {
    return { complete: false, notice: 'Local data migration could not be completed. Existing data was left untouched.' }
  }
}

export function getUserDataStatus(userId: string) {
  const collections: UserDataCollection[] = ['strategy', 'documents', 'tasks', 'ai-history', 'activity', 'files']
  let bytes = 0
  let populatedCollections = 0
  for (const collection of collections) {
    const key = userDataStorageKey(userId, collection)
    try {
      const value = window.localStorage.getItem(key)
      if (value !== null) {
        bytes += value.length * 2
        populatedCollections += 1
      }
    } catch {
      return { mode: 'local-development' as const, available: false, bytes, populatedCollections }
    }
  }
  return { mode: 'local-development' as const, available: true, bytes, populatedCollections }
}
