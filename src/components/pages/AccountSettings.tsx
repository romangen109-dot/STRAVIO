import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, HardDrive, LogOut, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import type { User } from '../../types'
import type { getUserDataStatus } from '../../data/storage'

type LocalDataStatus = ReturnType<typeof getUserDataStatus>
type Props = {
  user: User
  storageStatus: LocalDataStatus
  migrationNotice?: string
  onSaveName: (name: string) => boolean
  onLogout: () => void
  onDeleteLocalData: () => void
}

export function AccountSettings({ user, storageStatus, migrationNotice, onSaveName, onLogout, onDeleteLocalData }: Props) {
  const [name, setName] = useState(user.name)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { setName(user.name) }, [user.id, user.name])

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const success = onSaveName(name)
    setSaved(success)
    setError(success ? '' : 'Could not save the profile name.')
  }

  return <div className="secondary-page account-settings-page">
    <div className="page-crumb"><span>ACCOUNT</span><span>›</span><span>SETTINGS</span></div>
    <div className="secondary-heading"><div><span className="eyebrow">LOCAL ACCOUNT <i /> PRIVATE TO THIS BROWSER</span><h1>Settings</h1><p>Manage your local Stravio profile and stored workspace data.</p></div></div>
    <div className="account-settings-grid">
      <section className="workspace-panel account-settings-panel">
        <div className="account-section-heading"><span className="account-section-icon"><UserRound size={15} /></span><div><span className="eyebrow">PROFILE</span><h2>Your profile</h2></div></div>
        <form className="account-profile-form" onSubmit={save}>
          <label className="account-field">Name<input required value={name} onChange={(event) => { setName(event.target.value); setSaved(false) }} /></label>
          <label className="account-field">Email<input value={user.email} readOnly aria-readonly="true" /></label>
          <div className="account-form-footer">{error && <span className="account-error">{error}</span>}{saved && <span className="account-success">Profile saved</span>}<button className="outline-button algorithm-primary" disabled={!name.trim() || name.trim() === user.name}><Save size={13} /> Save profile</button></div>
        </form>
      </section>

      <section className="workspace-panel account-settings-panel">
        <div className="account-section-heading"><span className="account-section-icon account-storage-icon"><HardDrive size={15} /></span><div><span className="eyebrow">STORAGE</span><h2>Local data</h2></div></div>
        <div className="account-storage-status"><span className={`account-storage-dot ${storageStatus.available ? '' : 'unavailable'}`} /><div><strong>{storageStatus.available ? 'Available on this device' : 'Storage unavailable'}</strong><small>{storageStatus.populatedCollections} data collections · {formatBytes(storageStatus.bytes)}</small></div><span className="account-local-badge">LOCAL</span></div>
        <p className="account-storage-description">Strategy, documents, Planning, AI history, activity and project files are stored in this browser and scoped to your account ID. This is a development mode, not a remote backup.</p>
        {migrationNotice && <div className="account-migration-notice"><ShieldCheck size={14} />{migrationNotice}</div>}
      </section>

      <section className="workspace-panel account-settings-panel account-security-panel">
        <div className="account-section-heading"><span className="account-section-icon"><ShieldCheck size={15} /></span><div><span className="eyebrow">ACCOUNT</span><h2>Session</h2></div></div>
        <p className="account-storage-description">You are signed in as <strong>{user.name}</strong>. Signing out removes the local session; your scoped data stays on this device.</p>
        <button className="outline-button account-logout-button" onClick={onLogout}><LogOut size={14} /> Log out</button>
      </section>

      <section className="workspace-panel account-settings-panel account-danger-panel">
        <div className="account-section-heading"><span className="account-section-icon account-danger-icon"><AlertTriangle size={15} /></span><div><span className="eyebrow">LOCAL STORAGE</span><h2>Delete local data</h2></div></div>
        <p className="account-storage-description">Remove this account's strategy, documents, tasks, AI history, activity and project files from this browser. Your local account remains available.</p>
        <button className="outline-button account-delete-button" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete local data</button>
      </section>
    </div>

    {confirmDelete && <div className="account-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmDelete(false) }}>
      <section className="account-confirm-dialog workspace-panel" role="alertdialog" aria-modal="true" aria-labelledby="delete-data-title">
        <span className="account-confirm-icon"><AlertTriangle size={17} /></span><h2 id="delete-data-title">Delete this account's local data?</h2><p>This removes workspace data for <strong>{user.email}</strong> from this browser. This cannot be undone. Other local accounts are not affected.</p>
        <footer><button className="outline-button" onClick={() => setConfirmDelete(false)}>Cancel</button><button className="outline-button account-delete-button" onClick={onDeleteLocalData}><Trash2 size={13} /> Delete data</button></footer>
      </section>
    </div>}
  </div>
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}
