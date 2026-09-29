import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { Strategy } from './components/strategy/Strategy'
import { WorkspacePage } from './components/pages/WorkspacePage'
import { initialFiles } from './data/mockProject'
import { createStrategyDocument } from './data/strategyDocument'
import type { ProjectFile, StrategyData, WorkspaceSection, WorkspaceTab } from './types'

const initialTabs: WorkspaceTab[] = [
  { id: 'strategy', label: 'Strategy Overview', kind: 'section', section: 'Strategy' },
  { id: 'file:roadmap', label: 'roadmap.md', kind: 'file', fileId: 'roadmap' },
  { id: 'file:options', label: 'options.md', kind: 'file', fileId: 'options' },
  { id: 'file:market-analysis', label: 'research.md', kind: 'file', fileId: 'market-analysis' },
]

const FILES_STORAGE_KEY = 'stravio.project-files.v1'

function loadProjectFiles(): ProjectFile[] {
  try {
    const stored = window.localStorage.getItem(FILES_STORAGE_KEY)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.every((file) => file && typeof file.id === 'string' && typeof file.name === 'string' && typeof file.folder === 'string')) return parsed
    }
  } catch {
    return initialFiles
  }
  return initialFiles
}

export default function App() {
  const [files, setFiles] = useState<ProjectFile[]>(loadProjectFiles)
  const [tabs, setTabs] = useState(initialTabs)
  const [activeTabId, setActiveTabId] = useState('strategy')
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('Strategy')
  const [query, setQuery] = useState('')
  const [agentOpen, setAgentOpen] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    try {
      window.localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files))
    } catch {
      return
    }
  }, [files])

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
    const file: ProjectFile = { id: `${folder}-${Date.now()}`, name, folder, content: '' }
    setFiles((current) => [...current, file])
    openFile(file)
  }

  const generateStrategyDocument = (strategy: StrategyData) => {
    const date = new Date().toISOString().slice(0, 10)
    const file: ProjectFile = {
      id: `strategy-document-${Date.now()}`,
      name: `strategy-${date}.md`,
      folder: 'docs',
      content: createStrategyDocument(strategy),
    }
    setFiles((current) => [...current, file])
    openFile(file)
  }

  const addTab = () => navigate('Documents')

  return <AppLayout activeSection={activeSection} tabs={tabs} activeTabId={activeTabId} files={visibleFiles} activeFile={activeFile?.id} query={query} agentOpen={agentOpen} sidebarOpen={sidebarOpen} onQueryChange={setQuery} onNavigate={navigate} onOpenFile={openFile} onCreateFile={createFile} onSelectTab={openTab} onCloseTab={closeTab} onAddTab={addTab} onToggleAgent={() => setAgentOpen((open) => !open)} onCloseAgent={() => setAgentOpen(false)} onToggleSidebar={() => setSidebarOpen((open) => !open)}>
    {activeTab.kind === 'file' ? <WorkspacePage section="Documents" fileName={activeFile?.name ?? activeTab.label} fileContent={activeFile?.content} /> : activeTab.section === 'Strategy' ? <Strategy onGenerateDocument={generateStrategyDocument} /> : <WorkspacePage section={activeTab.section ?? 'Overview'} />}
  </AppLayout>
}