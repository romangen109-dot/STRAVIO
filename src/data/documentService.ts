import type { StrategyDocument } from '../types'
import { localStorageDataProvider } from './storage'

function isStrategyDocument(value: unknown, userId: string): value is StrategyDocument {
  if (typeof value !== 'object' || value === null) return false
  const document = value as Record<string, unknown>
  if (document.userId !== userId || typeof document.id !== 'string' || typeof document.title !== 'string' || typeof document.content !== 'string') return false
  if (typeof document.strategy !== 'object' || document.strategy === null) return false
  return (document.strategy as Record<string, unknown>).userId === userId
    && typeof document.createdAt === 'string'
    && typeof document.updatedAt === 'string'
    && (document.status === 'ready' || document.status === 'edited')
}

export function loadStrategyDocuments(userId: string): StrategyDocument[] {
  const value = localStorageDataProvider.get<unknown>(userId, 'documents')
  return Array.isArray(value) ? value.filter((document) => isStrategyDocument(document, userId)) : []
}

export function saveStrategyDocuments(userId: string, documents: StrategyDocument[]) {
  return localStorageDataProvider.set(userId, 'documents', documents.filter((document) => document.userId === userId && document.strategy.userId === userId))
}
