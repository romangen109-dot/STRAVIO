import type { AuthChangeEvent } from '@supabase/supabase-js'
import type { User } from '../types'
import { migrateLegacyUserData } from './storage'
import { readLocalWorkspace, updateLocalWorkspace } from './localWorkspace'

export type AuthResult = { user: User; notice?: string } | { error: string } | { redirecting: true } | { confirmationRequired: true }
export type PasswordResetResult = { sent: true } | { error: string }

export interface AuthProvider {
  getCurrentUser(): Promise<User | null>
  subscribe(listener: (user: User | null, event: AuthChangeEvent) => void): () => void
  register(name: string, email: string, password: string): Promise<AuthResult>
  login(email: string, password: string): Promise<AuthResult>
  requestPasswordReset(email: string): Promise<PasswordResetResult>
  updatePassword(password: string): Promise<User>
  updateProfile(userId: string, name: string): Promise<User>
  continueWithGoogle(): Promise<AuthResult>
  logout(): Promise<void>
}

const demoSessionKey = 'stravio.demo-session.v1'
const listeners = new Set<(user: User | null, event: AuthChangeEvent) => void>()

function readSession() {
  let serialized: string | null
  try {
    serialized = window.localStorage.getItem(demoSessionKey)
  } catch (error) {
    throw new Error(`Could not read the local profile session. Check browser storage permissions. ${error instanceof Error ? error.message : ''}`.trim())
  }
  if (serialized === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    throw new Error('The local profile session is unreadable and was left untouched.')
  }
  if (typeof parsed !== 'object' || parsed === null || !('userId' in parsed) || typeof parsed.userId !== 'string') {
    throw new Error('The local profile session has an unsupported format and was left untouched.')
  }
  return parsed.userId
}

function saveSession(userId: string) {
  try {
    window.localStorage.setItem(demoSessionKey, JSON.stringify({ userId }))
  } catch (error) {
    const full = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    throw new Error(full
      ? 'Browser storage is full. Free some space and try again.'
      : `Could not save the local profile session. Check browser storage permissions. ${error instanceof Error ? error.message : ''}`.trim())
  }
}

function toUser(userId: string) {
  const workspace = readLocalWorkspace(userId)
  if (!workspace.profile || typeof workspace.profile.name !== 'string' || typeof workspace.profile.email !== 'string') {
    throw new Error('The local profile could not be loaded. Its workspace data was left untouched.')
  }
  return { id: userId, ...workspace.profile }
}

function emit(user: User | null, event: AuthChangeEvent) {
  for (const listener of listeners) listener(user, event)
}

function normalizeIdentity(identity: string) {
  return identity.trim().toLowerCase()
}

async function enterProfile(identity: string, password: string, requestedName?: string): Promise<AuthResult> {
  const normalizedIdentity = normalizeIdentity(identity)
  if (!normalizedIdentity || !password) return { error: 'Enter a login and password to continue.' }
  const userId = `demo:${encodeURIComponent(normalizedIdentity)}`
  const displayName = requestedName?.trim() || normalizedIdentity.split('@')[0]
  const user: User = { id: userId, name: displayName, email: normalizedIdentity }
  const migration = migrateLegacyUserData(user)
  if (!migration.complete && !migration.notice?.includes('belongs to a different local account')) {
    throw new Error(migration.notice ?? 'Existing browser data could not be safely prepared for this local profile.')
  }
  updateLocalWorkspace(userId, (workspace) => {
    workspace.profile = {
      name: requestedName?.trim() || workspace.profile?.name || displayName,
      email: normalizedIdentity,
    }
  })
  saveSession(userId)
  const currentUser = toUser(userId)
  emit(currentUser, 'SIGNED_IN')
  return { user: currentUser, notice: migration.notice }
}

export const demoAuthProvider: AuthProvider = {
  async getCurrentUser() {
    const userId = readSession()
    return userId ? toUser(userId) : null
  },

  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  async register(name, email, password) {
    return enterProfile(email, password, name)
  },

  async login(email, password) {
    return enterProfile(email, password)
  },

  async requestPasswordReset() {
    return { error: 'Password reset emails are unavailable in local Demo Mode. No password is stored; enter the same profile name and any non-empty password to continue.' }
  },

  async updatePassword() {
    throw new Error('Password changes are unavailable in local Demo Mode because passwords are not stored.')
  },

  async updateProfile(userId, name) {
    const normalizedName = name.trim()
    if (!normalizedName) throw new Error('A profile name is required.')
    if (readSession() !== userId) throw new Error('The local profile session has changed. Sign in again before editing this profile.')
    updateLocalWorkspace(userId, (workspace) => {
      if (!workspace.profile) throw new Error('The local profile could not be loaded.')
      workspace.profile = { ...workspace.profile, name: normalizedName }
    })
    const user = toUser(userId)
    emit(user, 'USER_UPDATED')
    return user
  },

  async continueWithGoogle() {
    return { error: 'Google OAuth is unavailable in temporary local Demo Mode. Use the login field and any non-empty password to open a local profile.' }
  },

  async logout() {
    try {
      window.localStorage.removeItem(demoSessionKey)
    } catch (error) {
      throw new Error(`Could not end the local profile session. Check browser storage permissions. ${error instanceof Error ? error.message : ''}`.trim())
    }
    emit(null, 'SIGNED_OUT')
  },
}
