import type { StrategyDocument } from '../types'
import { createStrategyDocumentContent } from './strategyDocument'
import { addLocalActivity, readLocalWorkspace, updateLocalWorkspace } from './localWorkspace'

export async function getStrategyDocuments(userId: string) {
  return readLocalWorkspace(userId).documents
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export async function createStrategyDocumentRecord(document: StrategyDocument) {
  return updateLocalWorkspace(document.userId, (workspace) => {
    if (workspace.documents.some((entry) => entry.id === document.id)) {
      throw new Error('A document with this identifier already exists.')
    }
    workspace.documents.unshift(document)
    addLocalActivity(workspace, document.userId, 'document-generated', document.title, document.strategy.id, document.id)
    return document
  })
}

export async function updateStrategyDocumentRecord(userId: string, id: string, content: string) {
  return updateLocalWorkspace(userId, (workspace) => {
    const document = workspace.documents.find((entry) => entry.id === id)
    if (!document) throw new Error('The document no longer exists in this local profile.')
    document.content = content
    delete document.draftContent
    document.status = 'edited'
    document.updatedAt = new Date().toISOString()
    addLocalActivity(workspace, userId, 'document-edited', document.title, document.strategy.id, id)
    return document
  })
}

export async function saveStrategyDocumentDraft(userId: string, id: string, content: string) {
  return updateLocalWorkspace(userId, (workspace) => {
    const document = workspace.documents.find((entry) => entry.id === id)
    if (!document) throw new Error('The document no longer exists in this local profile.')
    document.draftContent = content
    return document
  })
}

export async function discardStrategyDocumentDraft(userId: string, id: string) {
  return updateLocalWorkspace(userId, (workspace) => {
    const document = workspace.documents.find((entry) => entry.id === id)
    if (!document) throw new Error('The document no longer exists in this local profile.')
    delete document.draftContent
    return document
  })
}

export async function renameStrategyDocumentRecord(userId: string, id: string, title: string) {
  return updateLocalWorkspace(userId, (workspace) => {
    const document = workspace.documents.find((entry) => entry.id === id)
    if (!document) throw new Error('The document no longer exists in this local profile.')
    document.title = title.trim()
    document.updatedAt = new Date().toISOString()
    return document
  })
}

export async function syncStrategyDocumentRecord(userId: string, document: StrategyDocument, strategy: StrategyDocument['strategy']) {
  return updateLocalWorkspace(userId, (workspace) => {
    const current = workspace.documents.find((entry) => entry.id === document.id)
    if (!current) throw new Error('The document no longer exists in this local profile.')
    current.strategy = strategy
    current.updatedAt = new Date().toISOString()
    if (current.status === 'ready') {
      current.content = createStrategyDocumentContent(strategy)
    }
    return current
  })
}

export async function deleteStrategyDocumentRecord(userId: string, id: string) {
  updateLocalWorkspace(userId, (workspace) => {
    const index = workspace.documents.findIndex((entry) => entry.id === id)
    if (index === -1) return
    const [document] = workspace.documents.splice(index, 1)
    addLocalActivity(workspace, userId, 'document-deleted', document.title, document.strategy.id, id)
  })
}
