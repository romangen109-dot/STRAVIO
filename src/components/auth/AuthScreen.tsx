import { useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { supabaseAuthProvider, type AuthProvider } from '../../data/supabaseAuth'
import { isSupabaseConfigured } from '../../data/supabaseClient'
import { logClientError } from '../../data/errorHandling'
import type { User } from '../../types'

type Props = { authProvider?: AuthProvider; onAuthenticated: (user: User) => void; initialError?: string }

export function AuthScreen({ authProvider = supabaseAuthProvider, onAuthenticated, initialError = '' }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState(false)
  const isRegister = mode === 'register'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = isRegister
        ? await authProvider.register(name, email, password)
        : await authProvider.login(email, password)
      if ('error' in result) setError(result.error)
      else if ('user' in result) onAuthenticated(result.user)
    } catch (submitError) {
      logClientError('submit authentication form', submitError)
      setError('Authentication failed. Check your details and try again.')
    } finally {
      setBusy(false)
    }
  }

  const changeMode = () => {
    setMode((current) => current === 'login' ? 'register' : 'login')
    setPassword('')
    setError('')
  }

  const googleLogin = async () => {
    setBusy(true)
    try {
      const result = await authProvider.continueWithGoogle()
      if ('error' in result) setError(result.error)
      else if ('user' in result) onAuthenticated(result.user)
    } catch (loginError) {
      logClientError('Google sign in', loginError)
      setError('Google sign in could not be started. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-screen">
    <section className="auth-panel">
      <a className="brand auth-brand" href="#auth" aria-label="STRAVIO">
        <span className="brand-mark"><span /><span /><span /></span><span>STRAVIO</span>
      </a>
      <div className="auth-heading"><span className="eyebrow">STRATEGY WORKSPACE <i /> CLOUD AUTH</span><h1>{isRegister ? 'Create your account' : 'Welcome back.'}</h1><p>{isRegister ? 'Create a secure account for your strategy workspace.' : 'Sign in to continue to your strategy workspace.'}</p></div>
      {!isSupabaseConfigured && <div className="auth-error" role="alert">Backend is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.</div>}
      <div className="auth-local-notice"><ShieldCheck size={14} /><span>Authentication and data are handled by the configured Supabase project.</span></div>
      <button className="auth-google-button" onClick={googleLogin} disabled={busy || !isSupabaseConfigured}><span className="google-mark">G</span> Continue with Google</button>
      <div className="auth-divider"><span>OR CONTINUE WITH EMAIL</span></div>
      <form className="auth-form" onSubmit={submit}>
        {isRegister && <label className="auth-field"><span>Name</span><div><UserRound size={15} /><input autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></div></label>}
        <label className="auth-field"><span>Email</span><div><Mail size={15} /><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div></label>
        <label className="auth-field"><span>Password</span><div><LockKeyhole size={15} /><input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={isRegister ? 10 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? 'At least 10 characters' : 'Enter your password'} /></div></label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="auth-submit" disabled={busy || !isSupabaseConfigured}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'} <ArrowRight size={15} /></button>
      </form>
      <p className="auth-switch">{isRegister ? 'Already have an account?' : "Don't have an account?"} <button onClick={changeMode}>{isRegister ? 'Log in' : 'Sign up'}</button></p>
      <footer className="auth-footer"><span>STRAVIO</span><span>SECURE CLOUD AUTH</span></footer>
    </section>
    <aside className="auth-side-note"><span className="auth-side-line" /><span>STRATEGY<br />STARTS WITH<br />CLARITY.</span><small>YOUR WORKSPACE<br />IS YOURS.</small></aside>
  </main>
}
