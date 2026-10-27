import { useState } from 'react'
import { CalendarDays, ChevronDown, Compass, FileText, LayoutDashboard, PanelLeftClose, Settings2 } from 'lucide-react'
import { navigation } from '../../data/navigation'
import type { WorkspaceSection } from '../../types'
import { useCurrentUser } from '../auth/UserContext'
import { useI18n } from '../../i18n'

const icons = { layout: LayoutDashboard, compass: Compass, strategyDocuments: FileText, calendar: CalendarDays, settings: Settings2 }

type Props = {
  activeSection: WorkspaceSection
  onNavigate: (section: WorkspaceSection) => void
  onCollapse: () => void
}

export function Sidebar({ activeSection, onNavigate, onCollapse }: Props) {
  const user = useCurrentUser()
  const { t } = useI18n()
  const [workspaceOpen, setWorkspaceOpen] = useState(true)
  return (
    <aside className="sidebar">
      <div className="sidebar-heading"><span>{t('Workspace').toUpperCase()}</span><button className="icon-button sidebar-collapse" onClick={onCollapse} title={t('Collapse sidebar')} aria-label={t('Collapse sidebar')}><PanelLeftClose size={15} /></button></div>
      <button className="workspace-project" onClick={() => setWorkspaceOpen(!workspaceOpen)} aria-expanded={workspaceOpen}>
        <span className="project-avatar">{user.name.trim().charAt(0).toUpperCase() || 'S'}</span>
        <span className="workspace-project-copy"><strong>{user.name || t('Your workspace')}</strong><small>{t('Personal workspace')}</small></span>
        <ChevronDown className={workspaceOpen ? '' : 'rotate-chevron'} size={14} />
      </button>
      {workspaceOpen && <>
        <div className="project-summary">
          <p>{user.email}</p>
          <span className="status-pill"><i /> {t('Local profile')}</span>
        </div>
        <div className="sidebar-nav-label">{t('Workspace').toUpperCase()}</div>
        <nav className="workspace-nav" aria-label={t('Workspace navigation')}>
          {navigation.map((item) => {
            const Icon = icons[item.icon as keyof typeof icons]
            return <button className={`nav-item ${activeSection === item.label ? 'is-active' : ''}`} key={item.label} onClick={() => onNavigate(item.label)}>
              <Icon size={16} strokeWidth={1.8} /><span>{t(item.title ?? item.label)}</span>
            </button>
          })}
        </nav>
      </>}
      <div className="sidebar-bottom"><span className="storage-caption">{t('Private workspace')}</span></div>
    </aside>
  )
}