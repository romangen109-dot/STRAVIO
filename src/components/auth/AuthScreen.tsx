import { useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { localAuthProvider, type AuthProvider } from '../../data/auth'
import type { User } from '../../types'

type Props = { authProvider?: AuthProvider; onAuthenticated: (user: User) => void }

export function AuthScreen({ authProvider = localAuthProvider, onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isRegister = mode === 'register'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const result = isRegister
      ? await authProvider.register(name, email, password)
      : await authProvider.login(email, password)
    setBusy(false)
    if ('error' in result) setError(result.error)
    else onAuthenticated(result.user)
  }

  const changeMode = () => {
    setMode((current) => current === 'login' ? 'register' : 'login')
    setPassword('')
    setError('')
  }

  const googleLogin = async () => {
    const result = await authProvider.continueWithGoogle()
    if ('error' in result) setError(result.error)
    else onAuthenticated(result.user)
  }

  return <main className="auth-screen">
    <section className="auth-panel">
      <a className="brand auth-brand" href="#auth" aria-label="STRAVIO">
        <span className="brand-mark"><span /><span /><span /></span><span>STRAVIO</span>
      </a>
      <div className="auth-heading"><span className="eyebrow">STRATEGY WORKSPACE <i /> LOCAL MODE</span><h1>{isRegister ? 'Create your account' : 'Welcome back.'}</h1><p>{isRegister ? 'Set up a local account to continue to your workspace.' : 'Sign in to continue to your strategy workspace.'}</p></div>
      <div className="auth-local-notice"><ShieldCheck size={14} /><span>Local development account. Credentials stay in this browser; this is not production authentication.</span></div>
      <button className="auth-google-button" onClick={googleLogin}><span className="google-mark">G</span> Continue with Google</button>
      <div className="auth-divider"><span>OR CONTINUE WITH EMAIL</span></div>
      <form className="auth-form" onSubmit={submit}>
        {isRegister && <label className="auth-field"><span>Name</span><div><UserRound size={15} /><input autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></div></label>}
        <label className="auth-field"><span>Email</span><div><Mail size={15} /><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div></label>
        <label className="auth-field"><span>Password</span><div><LockKeyhole size={15} /><input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={isRegister ? 10 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? 'At least 10 characters' : 'Enter your password'} /></div></label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="auth-submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'} <ArrowRight size={15} /></button>
      </form>
      <p className="auth-switch">{isRegister ? 'Already have an account?' : "Don't have an account?"} <button onClick={changeMode}>{isRegister ? 'Log in' : 'Sign up'}</button></p>
      <footer className="auth-footer"><span>STRAVIO</span><span>LOCAL DEVELOPMENT MODE</span></footer>
    </section>
    <aside className="auth-side-note"><span className="auth-side-line" /><span>STRATEGY<br />STARTS WITH<br />CLARITY.</span><small>YOUR WORKSPACE<br />IS YOURS.</small></aside>
  </main>
}
