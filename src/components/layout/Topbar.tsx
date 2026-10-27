import { useEffect, useRef, useState } from 'react'
import { Command, Search, Sparkles, X } from 'lucide-react'
import { useCurrentUser } from '../auth/UserContext'
import type { WorkspaceSection } from '../../types'
import { useI18n } from '../../i18n'

type Props = {
  query: string
  onQueryChange: (query: string) => void
  onToggleAgent: () => void
  agentOpen: boolean
  onNavigate: (section: WorkspaceSection) => void
}

export function Topbar({ query, onQueryChange, onToggleAgent, agentOpen, onNavigate }: Props) {
  const user = useCurrentUser()
  const { t } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const searchInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInput.current?.focus()
      }
      if (event.key === 'Escape' && document.activeElement === searchInput.current) {
        onQueryChange('')
        searchInput.current?.blur()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [onQueryChange])

  return (
    <header className="topbar">
      <a className="brand" href="#workspace" aria-label={t('STRAVIO workspace')}>
        <span className="brand-mark"><span /><span /><span /></span>
        <span>STRAVIO</span>
        <span className="brand-divider" />
        <span className="brand-context">{t('Workspace')}</span>
      </a>
      <label className={`global-search ${query ? 'has-query' : ''}`}>
        <Search size={15} />
        <input ref={searchInput} value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t('Search project…')} aria-label={t('Search project')} />
        {query ? <button className="search-clear" onClick={() => onQueryChange('')} aria-label={t('Clear search')}><X size={13} /></button> : <kbd><Command size={10} /> K</kbd>}
      </label>
      <div className="topbar-actions">
        <div className="topbar-menu-wrap">
          <span className="project-switcher"><span className="project-switcher-dot" /> Stravio {t('Workspace').toLowerCase()}</span>
        </div>
        <div className="topbar-menu-wrap">
          <button className="avatar-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={t('Profile menu')} aria-expanded={menuOpen}>{user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</button>
          {menuOpen && <div className="topbar-popover profile-popover"><strong>{user.name}</strong><small>{user.email}</small><button onClick={() => { setMenuOpen(false); onNavigate('Settings') }}>{t('Profile settings')}</button></div>}
        </div>
        <button className={`agent-toggle ${agentOpen ? 'is-active' : ''}`} onClick={onToggleAgent} aria-label={t(agentOpen ? 'Hide AI agent' : 'Show AI agent')} title={t(agentOpen ? 'Hide AI agent' : 'Show AI agent')}><Sparkles size={15} /></button>
      </div>
    </header>
  )
}