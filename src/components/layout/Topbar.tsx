import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, Command, Search, Sparkles, X } from 'lucide-react'

type Props = {
  query: string
  onQueryChange: (query: string) => void
  onToggleAgent: () => void
  agentOpen: boolean
}

export function Topbar({ query, onQueryChange, onToggleAgent, agentOpen }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
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
      <a className="brand" href="#workspace" aria-label="STRAVIO workspace">
        <span className="brand-mark"><span /><span /><span /></span>
        <span>STRAVIO</span>
        <span className="brand-divider" />
        <span className="brand-context">Workspace</span>
      </a>
      <label className={`global-search ${query ? 'has-query' : ''}`}>
        <Search size={15} />
        <input ref={searchInput} value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Поиск в проекте..." aria-label="Поиск в проекте" />
        {query ? <button className="search-clear" onClick={() => onQueryChange('')} aria-label="Очистить поиск"><X size={13} /></button> : <kbd><Command size={10} /> K</kbd>}
      </label>
      <div className="topbar-actions">
        <div className="topbar-menu-wrap">
          <button className="project-switcher" onClick={() => { setProjectsOpen(!projectsOpen); setNotificationsOpen(false) }} aria-expanded={projectsOpen}>
            <span className="project-switcher-dot" /> My Projects <ChevronDown size={13} />
          </button>
          {projectsOpen && <div className="topbar-popover project-popover">
            <span className="popover-label">YOUR WORKSPACES</span>
            <button className="popover-project active"><span className="project-switcher-dot" /><span><strong>Tech Education Platform</strong><small>Личный проект</small></span></button>
            <button className="popover-project" onClick={() => setProjectsOpen(false)}><span className="project-add-mark">+</span><span><strong>Создать проект</strong><small>Новый стратегический workspace</small></span></button>
          </div>}
        </div>
        <div className="topbar-menu-wrap">
          <button className="icon-button notification-button" onClick={() => { setNotificationsOpen(!notificationsOpen); setProjectsOpen(false) }} aria-label="Уведомления" aria-expanded={notificationsOpen}>
            <Bell size={16} /><span className="notification-dot" />
          </button>
          {notificationsOpen && <div className="topbar-popover notification-popover">
            <div className="popover-heading"><strong>Уведомления</strong><span className="unread-count">1 новое</span></div>
            <div className="notification-item"><span className="notification-icon"><Sparkles size={14} /></span><span><strong>Обзор проекта готов</strong><small>AI-агент · 12 минут назад</small></span></div>
          </div>}
        </div>
        <div className="topbar-menu-wrap">
          <button className="avatar-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Меню профиля" aria-expanded={menuOpen}>AK</button>
          {menuOpen && <div className="topbar-popover profile-popover"><strong>Alex Kim</strong><small>alex@stravio.app</small><button onClick={() => setMenuOpen(false)}>Настройки профиля</button></div>}
        </div>
        <button className={`agent-toggle ${agentOpen ? 'is-active' : ''}`} onClick={onToggleAgent} aria-label={agentOpen ? 'Скрыть AI-агента' : 'Показать AI-агента'} title={agentOpen ? 'Скрыть AI-агента' : 'Показать AI-агента'}><Sparkles size={15} /></button>
      </div>
    </header>
  )
}