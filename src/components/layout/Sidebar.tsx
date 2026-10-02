import { useState } from 'react'
import { Activity, BookOpen, CalendarDays, ChevronDown, Compass, FileText, FolderTree, LayoutDashboard, PanelLeftClose, Settings2 } from 'lucide-react'
import { navigation, project as mockProject } from '../../data/mockProject'
import type { ProjectFile, WorkspaceSection } from '../../types'
import { ProjectTree } from '../project/ProjectTree'

const icons = { layout: LayoutDashboard, compass: Compass, strategyDocuments: FileText, calendar: CalendarDays, settings: Settings2 }

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
              <Icon size={16} strokeWidth={1.8} /><span>{item.title ?? item.label}</span>
            </button>
          })}
        </nav>
      </>}
      <div className="files-heading"><span>PROJECT FILES</span><FolderTree size={14} /></div>
      <ProjectTree files={files} activeFile={activeFile} onOpenFile={onOpenFile} onCreateFile={onCreateFile} />
      <div className="sidebar-bottom">
        <div className="storage-row"><BookOpen size={13} /><span>Project files</span><strong>{files.length}</strong></div>
        <span className="storage-caption">Stored in this browser</span>
      </div>
    </aside>
  )
}