import { useEffect, useState, type FormEvent } from 'react'
import { HardDrive, LogOut, Save, ShieldCheck, UserRound } from 'lucide-react'
import type { User } from '../../types'
import { getLocalImportPreview, importLocalWorkspace } from '../../data/migrationService'
import { logClientError, userFacingError } from '../../data/errorHandling'
import { LanguagePicker, useI18n } from '../../i18n'

type Props = {
  user: User
  migrationNotice?: string
  onSaveName: (name: string) => Promise<boolean>
  onLogout: () => void | Promise<void>
}

export function AccountSettings({ user, migrationNotice, onSaveName, onLogout }: Props) {
  const { t } = useI18n()
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
      setError(success ? '' : t('Could not save the profile name.'))
    } catch (saveError) {
      setSaved(false)
      setError(t(userFacingError(saveError, 'Could not save the profile name.')))
    } finally {
      setSaving(false)
    }
  }

  const importLocalData = async () => {
    setImportState('importing')
    setImportNotice('')
    try {
      const counts = await importLocalWorkspace(user.email, user.id)
      setImportNotice(t('Imported {strategies} strategies, {documents} documents, {tasks} tasks, {messages} AI messages and {activity} activity entries. Original browser data was kept.', counts))
      setImportState('complete')
    } catch (importError) {
      setImportNotice(t(importError instanceof Error ? importError.message : 'Local data import failed. Original browser data was kept.'))
      setImportState('idle')
    }
  }

  const logout = async () => {
    setLoggingOut(true)
    setError('')
    try {
      await onLogout()
    } catch (logoutError) {
      logClientError('end local profile session', logoutError)
      setError(t(logoutError instanceof Error ? logoutError.message : 'Could not end the local profile session. Please try again.'))
      setLoggingOut(false)
    }
  }

  return <div className="secondary-page account-settings-page">
    <div className="page-crumb"><span>{t('ACCOUNT')}</span><span>›</span><span>{t('SETTINGS').toUpperCase()}</span></div>
    <div className="secondary-heading"><div><span className="eyebrow">{t('LOCAL PROFILE')} <i /> {t('BROWSER-STORED DATA')}</span><h1>{t('Settings')}</h1><p>{t('Manage your Stravio profile and local workspace data.')}</p></div></div>
    <div className="account-settings-grid">
      <section className="workspace-panel account-settings-panel">
        <div className="account-section-heading"><span className="account-section-icon"><UserRound size={15} /></span><div><span className="eyebrow">{t('PROFILE')}</span><h2>{t('Your profile')}</h2></div></div>
        <LanguagePicker className="account-field language-picker" />
        <form className="account-profile-form" onSubmit={save}>
          <label className="account-field">{t('Name')}<input required value={name} onChange={(event) => { setName(event.target.value); setSaved(false) }} /></label>
          <label className="account-field">{t('Email')}<input value={user.email} readOnly aria-readonly="true" /></label>
          <div className="account-form-footer">{error && <span className="account-error">{error}</span>}{saved && <span className="account-success">{t('Profile saved')}</span>}<button className="outline-button algorithm-primary" disabled={saving || !name.trim() || name.trim() === user.name}><Save size={13} /> {saving ? t('Saving…') : t('Save profile')}</button></div>
        </form>
      </section>

      <section className="workspace-panel account-settings-panel">
        <div className="account-section-heading"><span className="account-section-icon account-storage-icon"><HardDrive size={15} /></span><div><span className="eyebrow">{t('BROWSER STORAGE')}</span><h2>{t('Local workspace')}</h2></div></div>
        <div className="account-storage-status"><span className="account-storage-dot" /><div><strong>{t('Local profile session')}</strong><small>{t('Strategies, documents, Planning, AI history and activity are stored in this browser.')}</small></div><span className="account-local-badge">{t('LOCAL')}</span></div>
        <p className="account-storage-description">{t('Import existing browser records into this local profile. The import is profile-scoped, repeatable and never removes its local source.')}</p>
        {importPreview.localAccountFound ? <div className="account-migration-notice"><ShieldCheck size={14} /><span>{t('Found {strategies} strategies, {documents} documents, {tasks} tasks, {messages} AI messages and {activity} activity entries.', importPreview.counts)}</span></div> : <p className="account-storage-description">{t('No local account with this email was found in this browser.')}</p>}
        {importNotice && <div className="account-migration-notice" role="status">{importNotice}</div>}
        {importPreview.localAccountFound && <button className="outline-button algorithm-primary" onClick={() => void importLocalData()} disabled={importState === 'importing' || importState === 'complete'}><ShieldCheck size={13} /> {t(importState === 'importing' ? 'Importing…' : importState === 'complete' ? 'Import complete' : 'Import local data')}</button>}
        {migrationNotice && <div className="account-migration-notice"><ShieldCheck size={14} />{t(migrationNotice)}</div>}
      </section>

      <section className="workspace-panel account-settings-panel account-security-panel">
        <div className="account-section-heading"><span className="account-section-icon"><ShieldCheck size={15} /></span><div><span className="eyebrow">{t('ACCOUNT')}</span><h2>{t('Session')}</h2></div></div>
        <p className="account-storage-description">{t('You are using the local profile {name}. Signing out ends this browser session; saved workspace data remains in this browser.', { name: user.name })}</p>
        <button className="outline-button account-logout-button" onClick={() => void logout()} disabled={loggingOut}><LogOut size={14} /> {loggingOut ? t('Signing out…') : t('Log out')}</button>
      </section>

    </div>
  </div>
}
