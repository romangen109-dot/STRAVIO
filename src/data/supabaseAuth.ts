import type { AuthChangeEvent, AuthError, User as SupabaseUser } from '@supabase/supabase-js'
import type { User } from '../types'
import { isSupabaseConfigured, requireSupabase } from './supabaseClient'
import { logClientError } from './errorHandling'

export type AuthResult = { user: User } | { error: string } | { redirecting: true }

export interface AuthProvider {
  getCurrentUser(): Promise<User | null>
  subscribe(listener: (user: User | null, event: AuthChangeEvent) => void): () => void
  register(name: string, email: string, password: string): Promise<AuthResult>
  login(email: string, password: string): Promise<AuthResult>
  updateProfile(userId: string, name: string): Promise<User | null>
  continueWithGoogle(): Promise<AuthResult>
  logout(): Promise<void>
}

function toAppUser(user: SupabaseUser): User {
  return {
    id: user.id,
    name: typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : user.email ?? '',
    email: user.email ?? '',
  }
}

function authErrorMessage(error: AuthError) {
  if (error.code === 'invalid_credentials') return 'Email or password is incorrect.'
  if (error.code === 'email_not_confirmed') return 'Confirm your email, then sign in.'
  if (error.code === 'weak_password') return 'Choose a stronger password and try again.'
  if (error.code === 'over_request_rate_limit' || error.code === 'over_email_send_rate_limit') return 'Too many attempts. Wait a moment and try again.'
  if (error.code === 'user_already_exists') return 'An account may already exist. Try signing in.'
  logClientError('Supabase authentication', error)
  return 'Authentication failed. Check your details and try again.'
}

export const supabaseAuthProvider: AuthProvider = {
  async getCurrentUser() {
    if (!isSupabaseConfigured) return null
    const { data, error } = await requireSupabase().auth.getUser()
    if (error && error.name !== 'AuthSessionMissingError') throw error
    return data.user ? toAppUser(data.user) : null
  },

  subscribe(listener) {
    if (!isSupabaseConfigured) return () => undefined
    const { data } = requireSupabase().auth.onAuthStateChange((event, session) => {
      listener(session?.user ? toAppUser(session.user) : null, event)
    })
    return () => data.subscription.unsubscribe()
  },

  async register(name, email, password) {
    if (!isSupabaseConfigured) return { error: 'Backend is not configured. Add the Supabase URL and public key to .env.' }
    try {
      const { data, error } = await requireSupabase().auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { name: name.trim() } },
      })
      if (error) return { error: authErrorMessage(error) }
      if (!data.user) return { error: 'Account creation did not return a user.' }
      if (!data.session) return { error: 'Check your email to confirm the account, then sign in.' }
      return { user: toAppUser(data.user) }
    } catch (error) {
      logClientError('create account', error)
      return { error: 'Could not create the account. Please try again.' }
    }
  },

  async login(email, password) {
    if (!isSupabaseConfigured) return { error: 'Backend is not configured. Add the Supabase URL and public key to .env.' }
    try {
      const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (error) return { error: authErrorMessage(error) }
      if (!data.user) return { error: 'Sign in did not return a user.' }
      return { user: toAppUser(data.user) }
    } catch (error) {
      logClientError('sign in', error)
      return { error: 'Could not sign in. Please check the connection and try again.' }
    }
  },

  async updateProfile(userId, name) {
    const normalizedName = name.trim()
    if (!normalizedName) return null
    try {
      const client = requireSupabase()
      const { data: authData, error: authError } = await client.auth.updateUser({ data: { name: normalizedName } })
      if (authError || !authData.user || authData.user.id !== userId) return null
      const { error: profileError } = await client.from('profiles').update({ display_name: normalizedName }).eq('id', userId)
      if (profileError) return null
      return toAppUser(authData.user)
    } catch {
      return null
    }
  },

  async continueWithGoogle() {
    if (!isSupabaseConfigured) return { error: 'Backend is not configured. Add the Supabase URL and public key to .env.' }
    try {
      const { error } = await requireSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) {
        logClientError('start Google OAuth', error)
        return { error: 'Google sign in could not be started. Please try again.' }
      }
      return { redirecting: true }
    } catch (error) {
      logClientError('start Google OAuth', error)
      return { error: 'Google sign in could not be started. Please try again.' }
    }
  },

  async logout() {
    const { error } = await requireSupabase().auth.signOut()
    if (error) {
      logClientError('sign out', error)
      throw new Error('Could not end the secure session. Please try again.')
    }
  },
}