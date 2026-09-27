import { useMemo, useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { Strategy } from './components/strategy/Strategy'
import { WorkspacePage } from './components/pages/WorkspacePage'
import { initialFiles } from './data/mockProject'
import type { ProjectFile, WorkspaceSection, WorkspaceTab } from './types'

const initialTabs: WorkspaceTab[] = [
  { id: 'strategy', label: 'Strategy Overview', kind: 'section', section: 'Strategy' },
  { id: 'file:roadmap', label: 'roadmap.md', kind: 'file', fileId: 'roadmap' },
  { id: 'file:options', label: 'options.md', kind: 'file', fileId: 'options' },
  { id: 'file:market-analysis', label: 'research.md', kind: 'file', fileId: 'market-analysis' },
]

export default function App() {
  const [files, setFiles] = useState(initialFiles)
  const [tabs, setTabs] = useState(initialTabs)
  const [activeTabId, setActiveTabId] = useState('strategy')
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('Strategy')
  const [query, setQuery] = useState('')
  const [agentOpen, setAgentOpen] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? initialTabs[0]
  const activeFile = files.find((file) => file.id === activeTab.fileId)
  const visibleFiles = useMemo(() => query.trim() ? files.filter((file) => file.name.toLowerCase().includes(query.trim().toLowerCase()) || file.folder.includes(query.trim().toLowerCase())) : files, [files, query])

  const openTab = (tab: WorkspaceTab) => {
    setTabs((current) => current.some((item) => item.id === tab.id) ? current : [...current, tab])
    setActiveTabId(tab.id)
    if (tab.kind === 'section' && tab.section) setActiveSection(tab.section)
    if (tab.kind === 'file') setActiveSection('Documents')
  }

  const navigate = (section: WorkspaceSection) => openTab({ id: section.toLowerCase(), label: section === 'Strategy' ? 'Strategy Overview' : section, kind: 'section', section })

  const openFile = (file: ProjectFile) => openTab({ id: `file:${file.id}`, label: file.name, kind: 'file', fileId: file.id })

  const closeTab = (tab: WorkspaceTab) => {
    const nextTabs = tabs.filter((item) => item.id !== tab.id)
    setTabs(nextTabs)
    if (activeTabId === tab.id) {
      const nextTab = nextTabs[Math.max(0, tabs.findIndex((item) => item.id === tab.id) - 1)] ?? initialTabs[0]
      setActiveTabId(nextTab.id)
      if (nextTab.section) setActiveSection(nextTab.section)
      else setActiveSection('Documents')
    }
  }

  const createFile = (folder: string, name: string) => {
    const file: ProjectFile = { id: `${folder}-${Date.now()}`, name, folder }
    setFiles((current) => [...current, file])
    openFile(file)
  }

  const addTab = () => navigate('Documents')

  return <AppLayout activeSection={activeSection} tabs={tabs} activeTabId={activeTabId} files={visibleFiles} activeFile={activeFile?.id} query={query} agentOpen={agentOpen} sidebarOpen={sidebarOpen} onQueryChange={setQuery} onNavigate={navigate} onOpenFile={openFile} onCreateFile={createFile} onSelectTab={openTab} onCloseTab={closeTab} onAddTab={addTab} onToggleAgent={() => setAgentOpen((open) => !open)} onCloseAgent={() => setAgentOpen(false)} onToggleSidebar={() => setSidebarOpen((open) => !open)}>
    {activeTab.kind === 'file' ? <WorkspacePage section="Documents" fileName={activeFile?.name ?? activeTab.label} /> : activeTab.section === 'Strategy' ? <Strategy /> : <WorkspacePage section={activeTab.section ?? 'Overview'} />}
  </AppLayout>
}