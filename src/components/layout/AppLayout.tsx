import type { ReactNode } from 'react'
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
  onApplyAgentProposal: (proposal: AgentProposal) => boolean
  onToggleSidebar: () => void
}

export function AppLayout({ children, activeSection, tabs, activeTabId, files, activeFile, query, agentOpen, agentContext, agentPrompt, sidebarOpen, onQueryChange, onNavigate, onOpenFile, onCreateFile, onSelectTab, onCloseTab, onAddTab, onToggleAgent, onCloseAgent, onAgentPromptHandled, onApplyAgentProposal, onToggleSidebar }: Props) {
  return <div className={`app-shell ${agentOpen ? '' : 'agent-hidden'} ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
    <Topbar query={query} onQueryChange={onQueryChange} onToggleAgent={onToggleAgent} agentOpen={agentOpen} />
    {sidebarOpen && <Sidebar activeSection={activeSection} onNavigate={onNavigate} files={files} activeFile={activeFile} onOpenFile={onOpenFile} onCreateFile={onCreateFile} onCollapse={onToggleSidebar} />}
    {!sidebarOpen && <button className="sidebar-reopen icon-button" aria-label="Открыть навигацию" title="Показать workspace" onClick={onToggleSidebar}><span>W</span></button>}
    <main className="main-workspace" id="workspace"><ProjectTabs tabs={tabs} activeId={activeTabId} onSelect={onSelectTab} onClose={onCloseTab} onAdd={onAddTab} /><div className="main-scroll-area">{children}</div></main>
    {agentOpen && <AIAgent onClose={onCloseAgent} getContext={agentContext} initialPrompt={agentPrompt} onPromptHandled={onAgentPromptHandled} onApplyProposal={onApplyAgentProposal} />}
  </div>
}