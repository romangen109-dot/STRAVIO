import { useEffect, useState, type ReactNode } from 'react'
import { AIAgent } from './AIAgent'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ProjectTabs } from '../project/ProjectTabs'
import type { AgentContext, AgentProposal, ProjectFile, WorkspaceSection, WorkspaceTab } from '../../types'

type Props = {
  children: ReactNode
  activeSection: WorkspaceSection
  tabs: WorkspaceTab[]
  activeTabId: string
  files: ProjectFile[]
  activeFile?: string
  query: string
  agentOpen: boolean
  agentContext: () => AgentContext
  agentPrompt?: { id: string; prompt: string; currentDocument?: AgentContext['currentDocument'] }
  sidebarOpen: boolean
  onQueryChange: (query: string) => void
  onNavigate: (section: WorkspaceSection) => void
  onOpenFile: (file: ProjectFile) => void
  onCreateFile: (folder: string, name: string) => void
  onSelectTab: (tab: WorkspaceTab) => void
  onCloseTab: (tab: WorkspaceTab) => void
  onAddTab: () => void
  onToggleAgent: () => void
  onCloseAgent: () => void
  onAgentPromptHandled: (id: string) => void
  onApplyAgentProposal: (messageId: string, proposal: AgentProposal) => Promise<boolean>
  onToggleSidebar: () => void
}

export function AppLayout({ children, activeSection, tabs, activeTabId, files, activeFile, query, agentOpen, agentContext, agentPrompt, sidebarOpen, onQueryChange, onNavigate, onOpenFile, onCreateFile, onSelectTab, onCloseTab, onAddTab, onToggleAgent, onCloseAgent, onAgentPromptHandled, onApplyAgentProposal, onToggleSidebar }: Props) {
  const [backendError, setBackendError] = useState('')
  const [workspaceLoadState, setWorkspaceLoadState] = useState({ loading: true, error: '' })
  useEffect(() => {
    const showError = (event: Event) => setBackendError(event instanceof CustomEvent && typeof event.detail === 'string' ? event.detail : '')
    const showWorkspaceState = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === 'object' && event.detail !== null) {
        setWorkspaceLoadState({ loading: event.detail.loading === true, error: typeof event.detail.error === 'string' ? event.detail.error : '' })
      }
    }
    window.addEventListener('stravio:backend-error', showError)
    window.addEventListener('stravio:workspace-load-state', showWorkspaceState)
    return () => {
      window.removeEventListener('stravio:backend-error', showError)
      window.removeEventListener('stravio:workspace-load-state', showWorkspaceState)
    }
  }, [])

  return <div className={`app-shell ${agentOpen ? '' : 'agent-hidden'} ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
    <Topbar query={query} onQueryChange={onQueryChange} onToggleAgent={onToggleAgent} agentOpen={agentOpen} onNavigate={onNavigate} />
    {sidebarOpen && <Sidebar activeSection={activeSection} onNavigate={onNavigate} files={files} activeFile={activeFile} onOpenFile={onOpenFile} onCreateFile={onCreateFile} onCollapse={onToggleSidebar} />}
    {!sidebarOpen && <button className="sidebar-reopen icon-button" aria-label="Открыть навигацию" title="Показать workspace" onClick={onToggleSidebar}><span>W</span></button>}
    <main className="main-workspace" id="workspace">{backendError && <div className="auth-error" role="alert">{backendError}<button className="icon-button" onClick={() => setBackendError('')} aria-label="Dismiss error">×</button></div>}{workspaceLoadState.loading ? <div className="main-scroll-area secondary-page" aria-live="polite">Loading workspace data…</div> : workspaceLoadState.error ? <div className="main-scroll-area secondary-page" role="alert"><section className="workspace-panel"><h2>Workspace data could not be loaded.</h2><p>{workspaceLoadState.error}</p><button className="outline-button" onClick={() => window.location.reload()}>Reload workspace</button></section></div> : <><ProjectTabs tabs={tabs} activeId={activeTabId} onSelect={onSelectTab} onClose={onCloseTab} onAdd={onAddTab} /><div className="main-scroll-area">{children}</div></>}</main>
    {agentOpen && <AIAgent onClose={onCloseAgent} getContext={agentContext} initialPrompt={agentPrompt} onPromptHandled={onAgentPromptHandled} onApplyProposal={onApplyAgentProposal} />}
  </div>
}