import { useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { demoAuthProvider, type AuthProvider } from '../../data/supabaseAuth'
import { logClientError } from '../../data/errorHandling'
import type { User } from '../../types'
import { LanguagePicker, useI18n } from '../../i18n'

type AuthMode = 'login' | 'register' | 'reset' | 'recovery'
type Props = { authProvider?: AuthProvider; onAuthenticated: (user: User, notice?: string) => void; onRecoveryComplete?: () => void; initialError?: string; initialMode?: AuthMode }

export function AuthScreen({ authProvider = demoAuthProvider, onAuthenticated, onRecoveryComplete, initialError = '', initialMode = 'login' }: Props) {
  const { t } = useI18n()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState(initialError)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const isRegister = mode === 'register'
  const isRecovery = mode === 'recovery'
  const isReset = mode === 'reset'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (isRecovery) {
        if (password !== passwordConfirm) {
          setError(t('Passwords do not match.'))
          return
        }
        const user = await authProvider.updatePassword(password)
        onAuthenticated(user)
        onRecoveryComplete?.()
        return
      }
      if (isReset) {
        const result = await authProvider.requestPasswordReset(email)
        if ('error' in result) setError(t(result.error))
        else setNotice(t('If an account exists for that email, a password reset link will be sent. Check your inbox.'))
        return
      }
      const result = isRegister
        ? await authProvider.register(name, email, password)
        : await authProvider.login(email, password)
      if ('error' in result) setError(t(result.error))
      else if ('user' in result) onAuthenticated(result.user, result.notice)
      else if ('confirmationRequired' in result) {
        setNotice(t('Account created. Check your email and confirm your address before signing in.'))
        setMode('login')
        setPassword('')
      }
    } catch (submitError) {
      logClientError('submit authentication form', submitError)
      setError(t(submitError instanceof Error ? submitError.message : 'Authentication failed. Check your details and try again.'))
    } finally {
      setBusy(false)
    }
  }

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setPassword('')
    setPasswordConfirm('')
    setError('')
    setNotice('')
  }

  const googleLogin = async () => {
    setBusy(true)
    try {
      const result = await authProvider.continueWithGoogle()
      if ('error' in result) setError(t(result.error))
      else if ('user' in result) onAuthenticated(result.user)
    } catch (loginError) {
      logClientError('Google sign in', loginError)
      setError(t('Google sign in could not be started. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-screen">
    <section className="auth-panel">
      <a className="brand auth-brand" href="#auth" aria-label="STRAVIO">
        <span className="brand-mark"><span /><span /><span /></span><span>STRAVIO</span>
      </a>
      <div className="auth-heading"><span className="eyebrow">{t('STRATEGY WORKSPACE')} <i /> {t('LOCAL PROFILE')}</span><h1>{t(isRecovery ? 'Choose a new password' : isReset ? 'Reset your password' : isRegister ? 'Create your account' : 'Welcome back.')}</h1><p>{t(isRecovery ? 'Password changes are not available in temporary local Demo Mode.' : isReset ? 'Password reset emails are not available in temporary local Demo Mode.' : isRegister ? 'Create a local profile for your strategy workspace.' : 'Sign in to continue to your strategy workspace.')}</p></div>
      <div className="auth-local-notice"><ShieldCheck size={14} /><span>{t('Temporary local Demo Mode: this profile is stored in this browser and is not protected by cloud authentication.')}</span></div>
      {!isReset && !isRecovery && <><button className="auth-google-button" onClick={googleLogin} disabled={busy}><span className="google-mark">G</span> {t('Continue with Google')}</button><div className="auth-divider"><span>{t('OR CONTINUE WITH EMAIL')}</span></div></>}
      <form className="auth-form" onSubmit={submit}>
        {isRegister && <label className="auth-field"><span>{t('Name')}</span><div><UserRound size={15} /><input autoComplete="name" maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} placeholder={t('Your name')} /></div></label>}
        {(isRegister || mode === 'login' || isReset) && <label className="auth-field"><span>{t(mode === 'login' ? 'Login' : 'Email')}</span><div><Mail size={15} /><input type={mode === 'login' ? 'text' : 'email'} autoComplete={mode === 'login' ? 'username' : 'email'} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t(mode === 'login' ? 'Your local profile' : 'you@example.com')} /></div></label>}
        {!isReset && <label className="auth-field"><span>{t(isRecovery ? 'New password' : 'Password')}</span><div><LockKeyhole size={15} /><input type="password" autoComplete={isRegister || isRecovery ? 'new-password' : 'current-password'} minLength={isRegister || isRecovery ? 10 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t(mode === 'login' ? 'Any non-empty password' : 'At least 10 characters')} /></div></label>}
        {isRecovery && <label className="auth-field"><span>{t('Confirm new password')}</span><div><LockKeyhole size={15} /><input type="password" autoComplete="new-password" minLength={10} required value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder={t('Enter the new password again')} /></div></label>}
        {error && <div className="auth-error" role="alert">{t(error)}</div>}
        {notice && <div className="account-migration-notice" role="status">{notice}</div>}
        <button className="auth-submit" disabled={busy}>{t(busy ? 'Please wait…' : isRecovery ? 'Update password' : isReset ? 'Send reset link' : isRegister ? 'Create account' : 'Log in')} <ArrowRight size={15} /></button>
      </form>
      {mode === 'login' && <p className="auth-switch"><button onClick={() => changeMode('reset')}>{t('Forgot password?')}</button></p>}
      {(mode === 'login' || isRegister) && <p className="auth-switch">{t(isRegister ? 'Already have an account?' : "Don't have an account?")} <button onClick={() => changeMode(isRegister ? 'login' : 'register')}>{t(isRegister ? 'Log in' : 'Sign up')}</button></p>}
      {isReset && <p className="auth-switch"><button onClick={() => changeMode('login')}>{t('Back to sign in')}</button></p>}
      {isRecovery && <p className="auth-switch"><button onClick={() => changeMode('reset')}>{t('Request another reset link')}</button></p>}
      <LanguagePicker className="auth-field language-picker" />
      <footer className="auth-footer"><span>STRAVIO</span><span>{t('LOCAL DEMO MODE')}</span></footer>
    </section>
    <aside className="auth-side-note"><span className="auth-side-line" /><span>{t('STRATEGY STARTS WITH CLARITY.').split(' ').map((word, index) => <span key={index}>{word}{index < 3 && <br />}</span>)}</span><small>{t('YOUR WORKSPACE IS YOURS.')}</small></aside>
  </main>
}
