import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { createStrategyDocumentRecord, deleteStrategyDocumentRecord, getStrategyDocuments, syncStrategyDocumentRecord, updateStrategyDocumentRecord } from './data/documentService'
import { PLANNING_TASKS_CHANGED_EVENT } from './data/planningTasks'
import { resolveAgentProposal } from './data/chatService'
import { getRecentActivity } from './data/activityService'
import { getPlanningTasks } from './data/taskService'
import { getStrategy } from './data/strategyService'
import { supabaseAuthProvider } from './data/supabaseAuth'
import { getUserDataStatus, localStorageDataProvider } from './data/storage'
import { hasStrategyProgress, loadStrategyData, saveStrategyData, STRATEGY_DATA_EVENT } from './components/strategy/useStrategy'
import type { AgentContext, AgentProposal, PlanningTask, ProjectFile, StrategyData, StrategyDocument, StrategyActivity, User, WorkspaceSection, WorkspaceTab } from './types'

const initialTabs: WorkspaceTab[] = [
  { id: 'overview', label: 'Dashboard', kind: 'section', section: 'Overview' },
  { id: 'strategy', label: 'Strategy Algorithm', kind: 'section', section: 'Strategy' },
  { id: 'file:roadmap', label: 'roadmap.md', kind: 'file', fileId: 'roadmap' },
  { id: 'file:options', label: 'options.md', kind: 'file', fileId: 'options' },
  { id: 'file:market-analysis', label: 'research.md', kind: 'file', fileId: 'market-analysis' },
]

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return <main className="auth-screen"><section className="auth-panel" role="alert"><div className="auth-heading"><span className="eyebrow">STRAVIO WORKSPACE</span><h1>Workspace couldn’t be loaded.</h1><p>Your saved local data has not been intentionally changed.</p></div><button className="auth-submit" onClick={() => window.location.reload()}>Reload workspace</button></section></main>
    return this.props.children
  }
}

function createDocumentId() {
  return globalThis.crypto?.randomUUID?.() ?? `strategy-document-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadProjectFiles(userId: string): ProjectFile[] {
  const stored = localStorageDataProvider.get<unknown>(userId, 'files')
  if (Array.isArray(stored) && stored.every((file) => file && typeof file === 'object' && 'userId' in file && file.userId === userId && 'id' in file && typeof file.id === 'string' && 'name' in file && typeof file.name === 'string' && 'folder' in file && typeof file.folder === 'string')) return stored as ProjectFile[]
  return initialFiles.map((file) => ({ ...file, userId }))
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let active = true
    const unsubscribe = supabaseAuthProvider.subscribe((user) => {
      if (active) {
        setCurrentUser(user)
        setAuthReady(true)
      }
    })
    supabaseAuthProvider.getCurrentUser().then((user) => {
      if (active) setCurrentUser(user)
    }).catch((error: unknown) => {
      if (active) setAuthError(error instanceof Error ? error.message : 'Could not restore the cloud session.')
    }).finally(() => {
      if (active) setAuthReady(true)
    })
    return () => { active = false; unsubscribe() }
  }, [])

  const onAuthenticated = (user: User) => setCurrentUser(user)

  if (!authReady) return <main className="auth-screen"><section className="auth-panel"><div className="auth-heading"><span className="eyebrow">STRAVIO WORKSPACE</span><h1>Restoring secure session…</h1></div></section></main>
  if (!currentUser) return <AppErrorBoundary><AuthScreen onAuthenticated={onAuthenticated} initialError={authError} key={authError} /></AppErrorBoundary>

  return <AppErrorBoundary><CurrentUserProvider user={currentUser}><AuthenticatedWorkspace key={currentUser.id} user={currentUser} migrationNotice={authError || undefined} onLogout={() => supabaseAuthProvider.logout()} onUserUpdated={setCurrentUser} /></CurrentUserProvider></AppErrorBoundary>
}

type WorkspaceProps = { user: User; migrationNotice?: string; onLogout: () => void; onUserUpdated: (user: User) => void }

function AuthenticatedWorkspace({ user, migrationNotice, onLogout, onUserUpdated }: WorkspaceProps) {
  const [files, setFiles] = useState<ProjectFile[]>(() => loadProjectFiles(user.id))
  const [strategyDocuments, setStrategyDocuments] = useState<StrategyDocument[]>([])
  const [activity, setActivity] = useState<StrategyActivity[]>([])
  const [planningTasks, setPlanningTasks] = useState<PlanningTask[]>([])
  const [workspaceError, setWorkspaceError] = useState('')
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

  const refreshTasks = useCallback(() => {
    void getPlanningTasks(user.id).then(setPlanningTasks).catch((error: unknown) => setWorkspaceError(error instanceof Error ? error.message : 'Could not load Planning tasks.'))
  }, [user.id])

  const refreshRecentActivity = useCallback(() => {
    void getRecentActivity(user.id).then(setActivity).catch((error: unknown) => setWorkspaceError(error instanceof Error ? error.message : 'Could not load activity.'))
  }, [user.id])

  const refreshWorkspaceData = useCallback(() => {
    void Promise.all([getStrategyDocuments(user.id), getRecentActivity(user.id), getPlanningTasks(user.id)]).then(([documents, recentActivity, tasks]) => {
      setStrategyDocuments(documents)
      setActivity(recentActivity)
      setPlanningTasks(tasks)
      setWorkspaceError('')
    }).catch((error: unknown) => setWorkspaceError(error instanceof Error ? error.message : 'Could not refresh cloud workspace data.'))
  }, [user.id])

  useEffect(() => {
    let active = true
    Promise.all([getStrategyDocuments(user.id), getRecentActivity(user.id), getPlanningTasks(user.id)]).then(([documents, recentActivity, tasks]) => {
      if (!active) return
      setStrategyDocuments(documents)
      setActivity(recentActivity)
      setPlanningTasks(tasks)
      setWorkspaceError('')
    }).catch((error: unknown) => {
      if (active) setWorkspaceError(error instanceof Error ? error.message : 'Could not load cloud workspace data.')
    })
    return () => { active = false }
  }, [user.id])

  const documentSyncQueue = useRef(Promise.resolve())
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('stravio:backend-error', { detail: workspaceError }))
  }, [workspaceError])
  const syncStrategyDocuments = useCallback((event: Event) => {
    documentSyncQueue.current = documentSyncQueue.current.then(async () => {
      const strategy = event instanceof CustomEvent && event.detail ? event.detail as StrategyData : loadStrategyData(user.id)
      const current = await getStrategyDocuments(user.id)
      const updated = await Promise.all(current.map((document) => document.strategy.id === strategy.id && JSON.stringify(document.strategy) !== JSON.stringify(strategy)
        ? syncStrategyDocumentRecord(user.id, document, strategy)
        : document))
      setStrategyDocuments(updated)
      setActivity(await getRecentActivity(user.id))
      setWorkspaceError('')
    }).catch((error: unknown) => setWorkspaceError(error instanceof Error ? error.message : 'Could not synchronize strategy documents.'))
  }, [user.id])

  useEffect(() => {
    window.addEventListener(STRATEGY_DATA_EVENT, syncStrategyDocuments)
    window.addEventListener(PLANNING_TASKS_CHANGED_EVENT, refreshTasks)
    window.addEventListener(PLANNING_TASKS_CHANGED_EVENT, refreshRecentActivity)
    window.addEventListener('stravio:workspace-refresh', refreshWorkspaceData)
    return () => {
      window.removeEventListener(STRATEGY_DATA_EVENT, syncStrategyDocuments)
      window.removeEventListener(PLANNING_TASKS_CHANGED_EVENT, refreshTasks)
      window.removeEventListener(PLANNING_TASKS_CHANGED_EVENT, refreshRecentActivity)
      window.removeEventListener('stravio:workspace-refresh', refreshWorkspaceData)
    }
  }, [refreshRecentActivity, refreshTasks, refreshWorkspaceData, syncStrategyDocuments])

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? initialTabs[0]
  const activeFile = files.find((file) => file.id === activeTab.fileId)
  const visibleFiles = useMemo(() => query.trim() ? files.filter((file) => file.name.toLowerCase().includes(query.trim().toLowerCase()) || file.folder.includes(query.trim().toLowerCase())) : files, [files, query])

  const getAgentContext = (): AgentContext => {
    const selectedDocument = activeTab.kind === 'strategy-document' ? strategyDocuments.find((document) => document.id === activeTab.strategyDocumentId) : undefined
    const savedStrategy = loadStrategyData(user.id)
    const strategy = (activeTab.section === 'Planning' ? planningStrategyOverride : null)
      ?? (selectedDocument?.strategy.id === savedStrategy.id ? savedStrategy : selectedDocument?.strategy ?? savedStrategy)
    const hasContext = Boolean(selectedDocument) || hasStrategyProgress(strategy)
    return {
      strategy,
      hasActiveStrategy: hasContext,
      userId: user.id,
      tasks: hasContext ? planningTasks.filter((task) => task.strategyId === strategy.id) : [],
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
    const savedStrategy = loadStrategyData(user.id)
    setPlanningStrategyOverride(strategy.id === savedStrategy.id ? null : strategy)
    openTab({ id: 'planning', label: 'Planning', kind: 'section', section: 'Planning' })
  }

  const askAgent = (prompt?: string, currentDocument?: AgentContext['currentDocument']) => {
    setAgentOpen(true)
    if (prompt) setAgentPrompt({ id: createDocumentId(), prompt, currentDocument })
  }

  const handleAgentProposal = async (messageId: string, proposal: AgentProposal) => {
    const context = getAgentContext()
    const strategyId = proposal.kind === 'update-desired-state' ? proposal.strategyId : proposal.tasks[0]?.strategyId
    if (!strategyId || strategyId !== context.strategy.id || (proposal.kind === 'update-desired-state' && proposal.userId !== user.id)
      || (proposal.kind === 'create-tasks' && (!proposal.tasks.length || proposal.tasks.some((task) => task.userId !== user.id || task.strategyId !== strategyId)))) return false
    try {
      await resolveAgentProposal(strategyId, messageId, 'apply')
      if (proposal.kind === 'create-tasks') window.dispatchEvent(new Event(PLANNING_TASKS_CHANGED_EVENT))
      else {
        const updated = await getStrategy(user.id, strategyId)
        if (updated) window.dispatchEvent(new CustomEvent(STRATEGY_DATA_EVENT, { detail: updated }))
      }
      return true
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Could not apply the AI proposal.')
      return false
    }
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

  const generateStrategyDocument = async (strategy: StrategyData) => {
    if (strategy.userId !== user.id) return false
    try {
      const savedStrategy = await saveStrategyData(strategy)
      const document = await createStrategyDocumentRecord(createStrategyDocument(savedStrategy))
      setStrategyDocuments((current) => [document, ...current])
      refreshRecentActivity()
      openTab({ id: `strategy-document:${document.id}`, label: document.title, kind: 'strategy-document', section: 'Strategy Documents', strategyDocumentId: document.id })
      setWorkspaceError('')
      return true
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Could not create the strategy document.')
      return false
    }
  }

  const saveStrategyDocument = async (id: string, content: string) => {
    try {
      const updated = await updateStrategyDocumentRecord(user.id, id, content)
      setStrategyDocuments((current) => current.map((document) => document.id === id ? updated : document))
      refreshRecentActivity()
      setWorkspaceError('')
      return true
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Could not save the strategy document.')
      return false
    }
  }

  const duplicateStrategyDocument = async (document: StrategyDocument) => {
    const now = new Date().toISOString()
    if (document.userId !== user.id) return
    try {
      const duplicate = await createStrategyDocumentRecord({ ...document, id: createDocumentId(), title: `${document.title} (Copy)`, createdAt: now, updatedAt: now, status: 'ready', strategy: structuredClone(document.strategy) })
      setStrategyDocuments((current) => [duplicate, ...current])
      refreshRecentActivity()
      openTab({ id: `strategy-document:${duplicate.id}`, label: duplicate.title, kind: 'strategy-document', section: 'Strategy Documents', strategyDocumentId: duplicate.id })
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Could not duplicate the strategy document.')
    }
  }

  const deleteStrategyDocument = async (id: string) => {
    try {
      await deleteStrategyDocumentRecord(user.id, id)
      setStrategyDocuments((current) => current.filter((item) => item.id !== id))
      refreshRecentActivity()
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Could not delete the strategy document.')
      return
    }
    const nextTabs = tabs.filter((tab) => tab.strategyDocumentId !== id)
    setTabs(nextTabs)
    if (activeTab.strategyDocumentId === id) {
      const listTab: WorkspaceTab = { id: 'strategy documents', label: 'Strategy Documents', kind: 'section', section: 'Strategy Documents' }
      setTabs((current) => current.some((tab) => tab.id === listTab.id) ? current : [...current, listTab])
      setActiveTabId(listTab.id)
      setActiveSection('Strategy Documents')
    }
  }

  const saveProfileName = async (name: string) => {
    const updated = await supabaseAuthProvider.updateProfile(user.id, name)
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