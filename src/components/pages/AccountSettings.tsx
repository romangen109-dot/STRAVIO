import { useEffect, useState, type FormEvent } from 'react'
import { HardDrive, LogOut, Save, ShieldCheck, UserRound } from 'lucide-react'
import type { User } from '../../types'
import { getLocalImportPreview, importLocalWorkspace } from '../../data/migrationService'
import { logClientError } from '../../data/errorHandling'

type Props = {
  user: User
  storageStatus?: unknown
  migrationNotice?: string
  onSaveName: (name: string) => Promise<boolean>
  onDeleteLocalData?: () => void
  onLogout: () => void | Promise<void>
}

export function AccountSettings({ user, migrationNotice, onSaveName, onLogout }: Props) {
  const [name, setName] = useState(user.name)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [importState, setImportState] = useState<'idle' | 'importing' | 'complete'>('idle')
  const [importNotice, setImportNotice] = useState('')
  const importPreview = getLocalImportPreview(user.email, user.id)

  useEffect(() => { setName(user.name) }, [user.id, user.name])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      const success = await onSaveName(name)
      setSaved(success)
      setError(success ? '' : 'Could not save the profile name.')
    } catch {
      setSaved(false)
      setError('Could not save the profile name.')
    } finally {
      setSaving(false)
    }
  }

  const importLocalData = async () => {
    setImportState('importing')
    setImportNotice('')
    try {
      const counts = await importLocalWorkspace(user.email, user.id)
      setImportNotice(`Imported ${counts.strategies} strategies, ${counts.documents} documents, ${counts.tasks} tasks, ${counts.messages} AI messages and ${counts.activity} activity entries. Original browser data was kept.`)
      setImportState('complete')
    } catch (importError) {
      setImportNotice(importError instanceof Error ? importError.message : 'Local data import failed. Original browser data was kept.')
      setImportState('idle')
    }
  }

  const logout = async () => {
    setLoggingOut(true)
    setError('')
    try {
      await onLogout()
    } catch (logoutError) {
      logClientError('end cloud session', logoutError)
      setError('Could not end the secure session. Please try again.')
      setLoggingOut(false)
    }
  }

  return <div className="secondary-page account-settings-page">
    <div className="page-crumb"><span>ACCOUNT</span><span>›</span><span>SETTINGS</span></div>
    <div className="secondary-heading"><div><span className="eyebrow">CLOUD ACCOUNT <i /> USER-SCOPED DATA</span><h1>Settings</h1><p>Manage your Stravio profile and cloud workspace data.</p></div></div>
    <div className="account-settings-grid">
      <section className="workspace-panel account-settings-panel">
        <div className="account-section-heading"><span className="account-section-icon"><UserRound size={15} /></span><div><span className="eyebrow">PROFILE</span><h2>Your profile</h2></div></div>
        <form className="account-profile-form" onSubmit={save}>
          <label className="account-field">Name<input required value={name} onChange={(event) => { setName(event.target.value); setSaved(false) }} /></label>
          <label className="account-field">Email<input value={user.email} readOnly aria-readonly="true" /></label>
          <div className="account-form-footer">{error && <span className="account-error">{error}</span>}{saved && <span className="account-success">Profile saved</span>}<button className="outline-button algorithm-primary" disabled={saving || !name.trim() || name.trim() === user.name}><Save size={13} /> {saving ? 'Saving…' : 'Save profile'}</button></div>
        </form>
      </section>

      <section className="workspace-panel account-settings-panel">
        <div className="account-section-heading"><span className="account-section-icon account-storage-icon"><HardDrive size={15} /></span><div><span className="eyebrow">DATABASE</span><h2>Cloud workspace</h2></div></div>
        <div className="account-storage-status"><span className="account-storage-dot" /><div><strong>Authenticated cloud session</strong><small>Strategies, documents, Planning, AI history and activity use the connected database.</small></div><span className="account-local-badge">CLOUD</span></div>
        <p className="account-storage-description">Import existing browser data only after signing into the matching cloud account. The import is user-scoped, repeatable and never removes its local source.</p>
        {importPreview.localAccountFound ? <div className="account-migration-notice"><ShieldCheck size={14} /><span>Found {importPreview.counts.strategies} strategies, {importPreview.counts.documents} documents, {importPreview.counts.tasks} tasks, {importPreview.counts.messages} AI messages and {importPreview.counts.activity} activity entries.</span></div> : <p className="account-storage-description">No local account with this email was found in this browser.</p>}
        {importNotice && <div className="account-migration-notice" role="status">{importNotice}</div>}
        {importPreview.localAccountFound && <button className="outline-button algorithm-primary" onClick={() => void importLocalData()} disabled={importState === 'importing' || importState === 'complete'}><ShieldCheck size={13} /> {importState === 'importing' ? 'Importing…' : importState === 'complete' ? 'Import complete' : 'Import local data'}</button>}
        {migrationNotice && <div className="account-migration-notice"><ShieldCheck size={14} />{migrationNotice}</div>}
      </section>

      <section className="workspace-panel account-settings-panel account-security-panel">
        <div className="account-section-heading"><span className="account-section-icon"><ShieldCheck size={15} /></span><div><span className="eyebrow">ACCOUNT</span><h2>Session</h2></div></div>
        <p className="account-storage-description">You are signed in as <strong>{user.name}</strong>. Signing out ends the Supabase session; cloud data remains in the database.</p>
        <button className="outline-button account-logout-button" onClick={() => void logout()} disabled={loggingOut}><LogOut size={14} /> {loggingOut ? 'Signing out…' : 'Log out'}</button>
      </section>

    </div>
  </div>
}
