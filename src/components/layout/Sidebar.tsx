import { useState } from 'react'
import { Activity, BookOpen, CalendarDays, CheckSquare2, ChevronDown, Compass, FileStack, FolderTree, LayoutDashboard, PanelLeftClose, Search, Settings2, Sparkles, TrendingUp } from 'lucide-react'
import { navigation, project as mockProject } from '../../data/mockProject'
import type { ProjectFile, WorkspaceSection } from '../../types'
import { ProjectTree } from '../project/ProjectTree'

const icons = { layout: LayoutDashboard, compass: Compass, search: Search, files: FileStack, calendar: CalendarDays, check: CheckSquare2, chart: TrendingUp, settings: Settings2 }

type Props = {
  activeSection: WorkspaceSection
  onNavigate: (section: WorkspaceSection) => void
  files: ProjectFile[]
  activeFile?: string
  onOpenFile: (file: ProjectFile) => void
  onCreateFile: (folder: string, name: string) => void
  onCollapse: () => void
}

export function Sidebar({ activeSection, onNavigate, files, activeFile, onOpenFile, onCreateFile, onCollapse }: Props) {
  const [workspaceOpen, setWorkspaceOpen] = useState(true)
  return (
    <aside className="sidebar">
      <div className="sidebar-heading"><span>WORKSPACE</span><button className="icon-button sidebar-collapse" onClick={onCollapse} title="Свернуть панель" aria-label="Свернуть панель"><PanelLeftClose size={15} /></button></div>
      <button className="workspace-project" onClick={() => setWorkspaceOpen(!workspaceOpen)} aria-expanded={workspaceOpen}>
        <span className="project-avatar"><Activity size={17} /></span>
        <span className="workspace-project-copy"><strong>{mockProject.name}</strong><small>Личный workspace</small></span>
        <ChevronDown className={workspaceOpen ? '' : 'rotate-chevron'} size={14} />
      </button>
      {workspaceOpen && <>
        <div className="project-summary">
          <p>{mockProject.description}</p>
          <span className="status-pill"><i /> {mockProject.status}</span>
        </div>
        <div className="sidebar-nav-label">PROJECT</div>
        <nav className="workspace-nav" aria-label="Навигация по проекту">
          {navigation.map((item) => {
            const Icon = icons[item.icon as keyof typeof icons]
            return <button className={`nav-item ${activeSection === item.label ? 'is-active' : ''}`} key={item.label} onClick={() => onNavigate(item.label)}>
              <Icon size={16} strokeWidth={1.8} /><span>{item.label}</span>{item.label === 'Tasks' && <span className="nav-count">4</span>}
            </button>
          })}
        </nav>
      </>}
      <div className="files-heading"><span>PROJECT FILES</span><FolderTree size={14} /></div>
      <ProjectTree files={files} activeFile={activeFile} onOpenFile={onOpenFile} onCreateFile={onCreateFile} />
      <div className="sidebar-bottom">
        <div className="workspace-health"><span className="health-icon"><Sparkles size={14} /></span><span><strong>Project health</strong><small><i /> All systems on track</small></span><TrendingUp size={15} className="health-trend" /></div>
        <div className="storage-row"><BookOpen size={13} /><span>Workspace storage</span><strong>24%</strong></div>
        <div className="storage-track"><span /></div>
        <span className="storage-caption">1.2 GB of 5 GB used</span>
      </div>
    </aside>
  )
}