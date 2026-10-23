import { AuthError, type AuthChangeEvent, type User as SupabaseUser } from '@supabase/supabase-js'
import type { User } from '../types'
import { isSupabaseConfigured, requireSupabase } from './supabaseClient'
import { logClientError } from './errorHandling'

export type AuthResult = { user: User } | { error: string } | { redirecting: true } | { confirmationRequired: true }
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

function toAppUser(user: SupabaseUser): User {
  return {
    id: user.id,
    name: typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : user.email ?? '',
    email: user.email ?? '',
  }
}

function authErrorMessage(error: AuthError) {
  const code = error.code ?? ''
  if (code === 'invalid_credentials') return 'Email or password is incorrect. If you have not confirmed your email, check your inbox first.'
  if (code === 'email_not_confirmed') return 'Confirm your email using the link we sent, then sign in.'
  if (code === 'weak_password' || code === 'password_too_short') return 'Choose a stronger password and try again.'
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || code === 'too_many_requests') return 'Too many attempts. Wait a moment and try again.'
  if (code === 'user_already_exists' || code === 'email_exists') return 'An account with this email may already exist. Try signing in or reset its password.'
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'Enter a valid email address and check the required fields.'
  if (code === 'same_password') return 'Choose a password different from your current password.'
  if (code === 'otp_expired') return 'This recovery link has expired. Request a new password reset email.'
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
        options: {
          data: { name: name.trim() },
          emailRedirectTo: new URL('/', window.location.origin).toString(),
        },
      })
      if (error) return { error: authErrorMessage(error) }
      if (!data.user) return { error: 'Account creation did not return a user.' }
      if (!data.session) {
        if (data.user.identities?.length === 0) return { error: 'An account with this email may already exist. Try signing in or reset its password.' }
        return { confirmationRequired: true }
      }
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

  async requestPasswordReset(email) {
    if (!isSupabaseConfigured) return { error: 'Backend is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment.' }
    try {
      const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: new URL('/?flow=recovery', window.location.origin).toString(),
      })
      if (error) return { error: authErrorMessage(error) }
      return { sent: true }
    } catch (error) {
      logClientError('request password reset', error)
      return { error: 'Could not send a password reset email. Please try again.' }
    }
  },

  async updatePassword(password) {
    if (!isSupabaseConfigured) throw new Error('Backend is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment.')
    try {
      const { data, error } = await requireSupabase().auth.updateUser({ password })
      if (error) throw error
      if (!data.user) throw new Error('Password update did not return an authenticated user.')
      return toAppUser(data.user)
    } catch (error) {
      if (error instanceof AuthError) {
        logClientError('update password', error)
        throw new Error(authErrorMessage(error))
      }
      logClientError('update password', error)
      throw new Error('Could not update your password. Request a new recovery email and try again.')
    }
  },

  async updateProfile(userId, name) {
    const normalizedName = name.trim()
    if (!normalizedName) throw new Error('A profile name is required.')
    const client = requireSupabase()
    const { data: authData, error: authError } = await client.auth.updateUser({ data: { name: normalizedName } })
    if (authError) throw authError
    if (!authData.user || authData.user.id !== userId) throw new Error('The authenticated profile could not be updated.')
    const { error: profileError } = await client.from('profiles').upsert({ id: userId, display_name: normalizedName }, { onConflict: 'id' })
    if (profileError) throw profileError
    return toAppUser(authData.user)
  },

  async continueWithGoogle() {
    if (!isSupabaseConfigured) return { error: 'Backend is not configured. Add the Supabase URL and public key to .env.' }
    try {
      const { error } = await requireSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: new URL('/', window.location.origin).toString() },
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