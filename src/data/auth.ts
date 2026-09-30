import type { User } from '../types'

const AUTH_STORAGE_KEY = 'stravio.local-auth.v1'
const SESSION_STORAGE_KEY = 'stravio.local-session.v1'
export const AUTH_STATE_CHANGED_EVENT = 'stravio:auth-state'
const PBKDF2_ITERATIONS = 210_000

type LocalAccount = {
  user: User
  passwordSalt: string
  passwordHash: string
}

type AuthStore = { accounts: LocalAccount[] }
type AuthResult = { user: User } | { error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface AuthProvider {
  readonly mode: 'local-development'
  getCurrentUser(): User | null
  register(name: string, email: string, password: string): Promise<AuthResult>
  login(email: string, password: string): Promise<AuthResult>
  updateProfile(userId: string, name: string): User | null
  continueWithGoogle(): Promise<AuthResult>
  logout(): void
}

function readStore(): AuthStore {
  try {
    const value = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!value) return { accounts: [] }
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed) || !Array.isArray(parsed.accounts)) return { accounts: [] }
    return { accounts: parsed.accounts.filter(isLocalAccount) }
  } catch {
    return { accounts: [] }
  }
}

function isLocalAccount(value: unknown): value is LocalAccount {
  if (typeof value !== 'object' || value === null) return false
  const account = value as Record<string, unknown>
  if (typeof account.user !== 'object' || account.user === null) return false
  const user = account.user as Record<string, unknown>
  return typeof user.id === 'string'
    && typeof user.name === 'string'
    && typeof user.email === 'string'
    && typeof account.passwordSalt === 'string'
    && typeof account.passwordHash === 'string'
}

function writeStore(store: AuthStore) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(store))
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `local-user-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function derivePasswordHash(password: string, salt: Uint8Array) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure password hashing is unavailable in this browser context.')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256)
  return toHex(new Uint8Array(bits))
}

function sessionUserId() {
  try {
    const session = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!session) return null
    const parsed: unknown = JSON.parse(session)
    return typeof parsed === 'object' && parsed !== null && 'userId' in parsed && typeof parsed.userId === 'string' ? parsed.userId : null
  } catch {
    return null
  }
}

function setSession(userId: string) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ userId }))
  window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT))
}

export const localAuthProvider: AuthProvider = {
  mode: 'local-development',

  getCurrentUser() {
    const userId = sessionUserId()
    if (!userId) return null
    return readStore().accounts.find((account) => account.user.id === userId)?.user ?? null
  },

  async register(name, email, password) {
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedName = name.trim()
    if (!normalizedName) return { error: 'Enter your name.' }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return { error: 'Enter a valid email address.' }
    if (password.length < 10) return { error: 'Use a password with at least 10 characters.' }
    const store = readStore()
    if (store.accounts.some((account) => account.user.email.toLowerCase() === normalizedEmail)) return { error: 'An account with this email already exists on this device.' }
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const user: User = { id: createId(), name: normalizedName, email: normalizedEmail }
      store.accounts.push({ user, passwordSalt: toHex(salt), passwordHash: await derivePasswordHash(password, salt) })
      writeStore(store)
      setSession(user.id)
      return { user }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Local account could not be created.' }
    }
  },

  async login(email, password) {
    const normalizedEmail = email.trim().toLowerCase()
    const account = readStore().accounts.find((entry) => entry.user.email.toLowerCase() === normalizedEmail)
    if (!account) return { error: 'Invalid email or password.' }
    try {
      const hash = await derivePasswordHash(password, Uint8Array.from(account.passwordSalt.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []))
      if (hash !== account.passwordHash) return { error: 'Invalid email or password.' }
      setSession(account.user.id)
      return { user: account.user }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Local sign in failed.' }
    }
  },

  updateProfile(userId, name) {
    const normalizedName = name.trim()
    if (!normalizedName) return null
    const store = readStore()
    const account = store.accounts.find((entry) => entry.user.id === userId)
    if (!account) return null
    account.user = { ...account.user, name: normalizedName }
    try {
      writeStore(store)
      window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT))
      return account.user
    } catch {
      return null
    }
  },

  async continueWithGoogle() {
    return { error: 'Google OAuth is not connected yet. No sign-in was attempted.' }
  },

  logout() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT))
  },
}

export function getLocalAccountCount() {
  return readStore().accounts.length
}
