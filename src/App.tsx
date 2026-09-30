import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { AuthScreen } from './components/auth/AuthScreen'
import { CurrentUserProvider } from './components/auth/UserContext'
import { AccountSettings } from './components/pages/AccountSettings'
import { Dashboard } from './components/pages/Dashboard'
import { Planning } from './components/pages/Planning'
import { Strategy } from './components/strategy/Strategy'
import { WorkspacePage } from './components/pages/WorkspacePage'
import { StrategyDocuments } from './components/pages/StrategyDocuments'
import { initialFiles } from './data/mockProject'
import { createStrategyDocument } from './data/strategyDocument'
import { loadStrategyDocuments, saveStrategyDocuments } from './data/documentService'
import { createPlanningTasks, loadPlanningTasks } from './data/planningTasks'
import { loadStrategyActivity, recordStrategyActivity, STRATEGY_ACTIVITY_EVENT } from './data/strategyActivity'
import { AUTH_STATE_CHANGED_EVENT, localAuthProvider } from './data/auth'
import { getUserDataStatus, localStorageDataProvider, migrateLegacyUserData } from './data/storage'
import { hasStrategyProgress, loadStrategyData, saveStrategyData } from './components/strategy/useStrategy'
import type { AgentContext, AgentProposal, ProjectFile, StrategyData, StrategyDocument, StrategyActivity, User, WorkspaceSection, WorkspaceTab } from './types'

const initialTabs: WorkspaceTab[] = [
  { id: 'overview', label: 'Dashboard', kind: 'section', section: 'Overview' },
  { id: 'strategy', label: 'Strategy Algorithm', kind: 'section', section: 'Strategy' },
  { id: 'file:roadmap', label: 'roadmap.md', kind: 'file', fileId: 'roadmap' },
  { id: 'file:options', label: 'options.md', kind: 'file', fileId: 'options' },
  { id: 'file:market-analysis', label: 'research.md', kind: 'file', fileId: 'market-analysis' },
]

function createDocumentId() {
  return globalThis.crypto?.randomUUID?.() ?? `strategy-document-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadProjectFiles(userId: string): ProjectFile[] {
  const stored = localStorageDataProvider.get<unknown>(userId, 'files')
  if (Array.isArray(stored) && stored.every((file) => file && typeof file === 'object' && 'userId' in file && file.userId === userId && 'id' in file && typeof file.id === 'string' && 'name' in file && typeof file.name === 'string' && 'folder' in file && typeof file.folder === 'string')) return stored as ProjectFile[]
  return initialFiles.map((file) => ({ ...file, userId }))
}

export default function App() {
  const [bootstrap] = useState(() => {
    const user = localAuthProvider.getCurrentUser()
    return { user, notice: user ? migrateLegacyUserData(user).notice : undefined }
  })
  const [currentUser, setCurrentUser] = useState(bootstrap.user)
  const [migrationNotice, setMigrationNotice] = useState(bootstrap.notice)

  useEffect(() => {
    const syncLogout = () => {
      if (!localAuthProvider.getCurrentUser()) setCurrentUser(null)
    }
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, syncLogout)
    return () => window.removeEventListener(AUTH_STATE_CHANGED_EVENT, syncLogout)
  }, [])

  const onAuthenticated = (user: User) => {
    const result = migrateLegacyUserData(user)
    setMigrationNotice(result.notice)
    setCurrentUser(user)
  }

  if (!currentUser) return <AuthScreen onAuthenticated={onAuthenticated} />

  return <CurrentUserProvider user={currentUser}><AuthenticatedWorkspace key={currentUser.id} user={currentUser} migrationNotice={migrationNotice} onLogout={() => localAuthProvider.logout()} onUserUpdated={setCurrentUser} /></CurrentUserProvider>
}

type WorkspaceProps = { user: User; migrationNotice?: string; onLogout: () => void; onUserUpdated: (user: User) => void }

function AuthenticatedWorkspace({ user, migrationNotice, onLogout, onUserUpdated }: WorkspaceProps) {
  const [files, setFiles] = useState<ProjectFile[]>(() => loadProjectFiles(user.id))
  const [strategyDocuments, setStrategyDocuments] = useState<StrategyDocument[]>(() => loadStrategyDocuments(user.id))
  const [activity, setActivity] = useState<StrategyActivity[]>(() => loadStrategyActivity(user.id))
  const [planningStrategyOverride, setPlanningStrategyOverride] = useState<StrategyData | null>(null)
  const [agentPrompt, setAgentPrompt] = useState<{ id: string; prompt: string; currentDocument?: AgentContext['currentDocument'] }>()
  const [tabs, setTabs] = useState(initialTabs)
  const [activeTabId, setActiveTabId] = useState('overview')
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('Overview')
  const [query, setQuery] = useState('')
  const [agentOpen, setAgentOpen] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    localStorageDataProvider.set(user.id, 'files', files)
  }, [files, user.id])

  useEffect(() => {
    saveStrategyDocuments(user.id, strategyDocuments)
  }, [strategyDocuments, user.id])

  useEffect(() => {
    const syncActivity = () => setActivity(loadStrategyActivity(user.id))
    window.addEventListener(STRATEGY_ACTIVITY_EVENT, syncActivity)
    return () => window.removeEventListener(STRATEGY_ACTIVITY_EVENT, syncActivity)
  }, [user.id])

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? initialTabs[0]
  const activeFile = files.find((file) => file.id === activeTab.fileId)
  const visibleFiles = useMemo(() => query.trim() ? files.filter((file) => file.name.toLowerCase().includes(query.trim().toLowerCase()) || file.folder.includes(query.trim().toLowerCase())) : files, [files, query])

  const getAgentContext = (): AgentContext => {
    const selectedDocument = activeTab.kind === 'strategy-document' ? strategyDocuments.find((document) => document.id === activeTab.strategyDocumentId) : undefined
    const strategy = (activeTab.section === 'Planning' ? planningStrategyOverride : null) ?? selectedDocument?.strategy ?? loadStrategyData(user.id)
    const hasContext = Boolean(selectedDocument) || hasStrategyProgress(strategy)
    return {
      strategy,
      hasActiveStrategy: hasContext,
      userId: user.id,
      tasks: hasContext ? loadPlanningTasks(user.id).filter((task) => task.strategyId === strategy.id) : [],
      documents: strategyDocuments.filter((document) => document.strategy.id === strategy.id),
      activeView: activeTab.kind === 'section' ? activeTab.section ?? 'Workspace' : activeTab.kind === 'file' ? 'Documents' : 'Strategy Documents',
      currentDocument: agentPrompt?.currentDocument ?? selectedDocument ?? (activeFile?.content ? { id: activeFile.id, title: activeFile.name, content: activeFile.content } : undefined),
    }
  }

  const openTab = (tab: WorkspaceTab) => {
    setTabs((current) => current.some((item) => item.id === tab.id) ? current : [...current, tab])
    setActiveTabId(tab.id)
    if (tab.kind === 'section' && tab.section) setActiveSection(tab.section)
    if (tab.kind === 'file') setActiveSection('Documents')
    if (tab.kind === 'strategy-document') setActiveSection('Strategy Documents')
  }

  const navigate = (section: WorkspaceSection) => {
    if (section === 'Planning') setPlanningStrategyOverride(null)
    openTab({ id: section.toLowerCase(), label: section === 'Strategy' ? 'Strategy Algorithm' : section, kind: 'section', section })
  }

  const openPlanningForStrategy = (strategy: StrategyData) => {
    setPlanningStrategyOverride(strategy)
    openTab({ id: 'planning', label: 'Planning', kind: 'section', section: 'Planning' })
  }

  const askAgent = (prompt?: string, currentDocument?: AgentContext['currentDocument']) => {
    setAgentOpen(true)
    if (prompt) setAgentPrompt({ id: createDocumentId(), prompt, currentDocument })
  }

  const handleAgentProposal = (proposal: AgentProposal) => {
    if (proposal.kind === 'create-tasks') {
      const context = getAgentContext()
      if (!proposal.tasks.length || proposal.tasks.some((task) => task.userId !== user.id || task.strategyId !== context.strategy.id)) return false
      const existingStagePlans = new Set(loadPlanningTasks(user.id).filter((task) => task.strategyId === context.strategy.id).map((task) => task.sourceStagePlanId).filter(Boolean))
      if (proposal.tasks.some((task) => task.sourceStagePlanId && existingStagePlans.has(task.sourceStagePlanId))) return false
      return createPlanningTasks(user.id, proposal.tasks).length > 0
    }

    const current = loadStrategyData(user.id)
    if (proposal.userId !== user.id || current.userId !== proposal.userId || current.id !== proposal.strategyId || current.desiredState.destination !== proposal.previousValue) return false
    const updated = { ...current, desiredState: { ...current.desiredState, destination: proposal.proposedValue }, updatedAt: new Date().toISOString() }
    saveStrategyData(updated)
    recordStrategyActivity('strategy-updated', 'Desired State updated by AI proposal', current.id, undefined, user.id)
    return true
  }

  const handleAgentPrompt = (id: string) => setAgentPrompt((current) => current?.id === id ? undefined : current)

  const openFile = (file: ProjectFile) => openTab({ id: `file:${file.id}`, label: file.name, kind: 'file', fileId: file.id })

  const closeTab = (tab: WorkspaceTab) => {
    const nextTabs = tabs.filter((item) => item.id !== tab.id)
    setTabs(nextTabs)
    if (activeTabId === tab.id) {
      const nextTab = nextTabs[Math.max(0, tabs.findIndex((item) => item.id === tab.id) - 1)] ?? initialTabs[0]
      setActiveTabId(nextTab.id)
      if (nextTab.section) setActiveSection(nextTab.section)
      else setActiveSection(nextTab.kind === 'strategy-document' ? 'Strategy Documents' : 'Documents')
    }
  }

  const createFile = (folder: string, name: string) => {
    const file: ProjectFile = { id: `${folder}-${Date.now()}`, userId: user.id, name, folder, content: '' }
    setFiles((current) => [...current, file])
    openFile(file)
  }

  const generateStrategyDocument = (strategy: StrategyData) => {
    if (strategy.userId !== user.id) return
    const document = createStrategyDocument(strategy)
    setStrategyDocuments((current) => [document, ...current])
    recordStrategyActivity('document-generated', document.title, strategy.id, document.id, user.id)
    openTab({ id: `strategy-document:${document.id}`, label: document.title, kind: 'strategy-document', section: 'Strategy Documents', strategyDocumentId: document.id })
  }

  const saveStrategyDocument = (id: string, content: string) => {
    const document = strategyDocuments.find((item) => item.id === id)
    setStrategyDocuments((current) => current.map((item) => item.id === id
      ? { ...item, content, updatedAt: new Date().toISOString(), status: 'edited' }
      : item))
    if (document?.userId === user.id) recordStrategyActivity('document-edited', document.title, document.strategy.id, id, user.id)
  }

  const duplicateStrategyDocument = (document: StrategyDocument) => {
    const now = new Date().toISOString()
    if (document.userId !== user.id) return
    const duplicate: StrategyDocument = { ...document, id: createDocumentId(), title: `${document.title} (Copy)`, createdAt: now, updatedAt: now, status: 'ready', strategy: structuredClone(document.strategy) }
    setStrategyDocuments((current) => [duplicate, ...current])
    recordStrategyActivity('document-generated', `Document duplicated: ${duplicate.title}`, duplicate.strategy.id, duplicate.id, user.id)
    openTab({ id: `strategy-document:${duplicate.id}`, label: duplicate.title, kind: 'strategy-document', section: 'Strategy Documents', strategyDocumentId: duplicate.id })
  }

  const deleteStrategyDocument = (id: string) => {
    const document = strategyDocuments.find((item) => item.id === id)
    const nextTabs = tabs.filter((tab) => tab.strategyDocumentId !== id)
    setStrategyDocuments((current) => current.filter((document) => document.id !== id))
    if (document?.userId === user.id) recordStrategyActivity('document-deleted', document.title, document.strategy.id, id, user.id)
    setTabs(nextTabs)
    if (activeTab.strategyDocumentId === id) {
      const listTab: WorkspaceTab = { id: 'strategy documents', label: 'Strategy Documents', kind: 'section', section: 'Strategy Documents' }
      setTabs((current) => current.some((tab) => tab.id === listTab.id) ? current : [...current, listTab])
      setActiveTabId(listTab.id)
      setActiveSection('Strategy Documents')
    }
  }

  const saveProfileName = (name: string) => {
    const updated = localAuthProvider.updateProfile(user.id, name)
    if (!updated) return false
    onUserUpdated(updated)
    return true
  }

  const deleteLocalUserData = () => {
    localStorageDataProvider.removeUserData(user.id)
    window.location.reload()
  }

  const addTab = () => navigate('Documents')

  return <AppLayout activeSection={activeSection} tabs={tabs} activeTabId={activeTabId} files={visibleFiles} activeFile={activeFile?.id} query={query} agentOpen={agentOpen} agentContext={getAgentContext} agentPrompt={agentPrompt} sidebarOpen={sidebarOpen} onQueryChange={setQuery} onNavigate={navigate} onOpenFile={openFile} onCreateFile={createFile} onSelectTab={openTab} onCloseTab={closeTab} onAddTab={addTab} onToggleAgent={() => setAgentOpen((open) => !open)} onCloseAgent={() => setAgentOpen(false)} onAgentPromptHandled={handleAgentPrompt} onApplyAgentProposal={handleAgentProposal} onToggleSidebar={() => setSidebarOpen((open) => !open)}>
    {activeTab.kind === 'strategy-document' ? <StrategyDocuments documents={strategyDocuments} selectedDocumentId={activeTab.strategyDocumentId} onOpen={(document) => openTab({ id: `strategy-document:${document.id}`, label: document.title, kind: 'strategy-document', section: 'Strategy Documents', strategyDocumentId: document.id })} onSave={saveStrategyDocument} onDelete={deleteStrategyDocument} onDuplicate={duplicateStrategyDocument} onBack={() => navigate('Strategy Documents')} onOpenPlanning={openPlanningForStrategy} onAskAI={askAgent} /> : activeTab.kind === 'file' ? <WorkspacePage section="Documents" fileName={activeFile?.name ?? activeTab.label} fileContent={activeFile?.content} /> : activeTab.section === 'Strategy' ? <Strategy onGenerateDocument={generateStrategyDocument} onAskAI={askAgent} /> : activeTab.section === 'Strategy Documents' ? <StrategyDocuments documents={strategyDocuments} onOpen={(document) => openTab({ id: `strategy-document:${document.id}`, label: document.title, kind: 'strategy-document', section: 'Strategy Documents', strategyDocumentId: document.id })} onSave={saveStrategyDocument} onDelete={deleteStrategyDocument} onDuplicate={duplicateStrategyDocument} onBack={() => navigate('Strategy Documents')} onOpenPlanning={openPlanningForStrategy} onAskAI={askAgent} /> : activeTab.section === 'Overview' ? <Dashboard documents={strategyDocuments} activity={activity} migrationNotice={migrationNotice} onOpenStrategy={() => navigate('Strategy')} onOpenDocuments={() => navigate('Strategy Documents')} onOpenDocument={(document) => openTab({ id: `strategy-document:${document.id}`, label: document.title, kind: 'strategy-document', section: 'Strategy Documents', strategyDocumentId: document.id })} onOpenAgent={askAgent} onOpenPlanning={() => navigate('Planning')} /> : activeTab.section === 'Planning' ? <Planning strategyOverride={planningStrategyOverride} onCreateStrategy={() => navigate('Strategy')} onAskAI={askAgent} /> : activeTab.section === 'Settings' ? <AccountSettings user={user} storageStatus={getUserDataStatus(user.id)} migrationNotice={migrationNotice} onSaveName={saveProfileName} onLogout={onLogout} onDeleteLocalData={deleteLocalUserData} /> : <WorkspacePage section={activeTab.section ?? 'Overview'} />}
  </AppLayout>
}