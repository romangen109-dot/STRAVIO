import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { AuthScreen } from './components/auth/AuthScreen'
import { CurrentUserProvider } from './components/auth/UserContext'
import { AccountSettings } from './components/pages/AccountSettings'
import { Dashboard } from './components/pages/Dashboard'
import { Planning } from './components/pages/Planning'
import { Strategy } from './components/strategy/Strategy'
import { StrategyDocuments } from './components/pages/StrategyDocuments'
import { createStrategyDocument } from './data/strategyDocument'
import { createStrategyDocumentRecord, deleteStrategyDocumentRecord, getStrategyDocuments, renameStrategyDocumentRecord, syncStrategyDocumentRecord, updateStrategyDocumentRecord } from './data/documentService'
import { PLANNING_TASKS_CHANGED_EVENT } from './data/planningTasks'
import { resolveAgentProposal } from './data/chatService'
import { getRecentActivity } from './data/activityService'
import { getPlanningTasks, invalidatePlanningTaskCache } from './data/taskService'
import { getStrategy } from './data/strategyService'
import { demoAuthProvider } from './data/supabaseAuth'
import { authRedirectError, isPasswordRecoveryRequested } from './data/authErrors'
import { logClientError, userFacingError } from './data/errorHandling'
import { hasStrategyProgress, loadStrategyData, saveStrategyData, STRATEGY_DATA_EVENT } from './components/strategy/useStrategy'
import type { AgentContext, AgentProposal, PlanningTask, StrategyData, StrategyDocument, StrategyActivity, User, WorkspaceSection, WorkspaceTab } from './types'

const initialTabs: WorkspaceTab[] = [
  { id: 'overview', label: 'Dashboard', kind: 'section', section: 'Overview' },
  { id: 'strategy', label: 'Strategy Algorithm', kind: 'section', section: 'Strategy' },
  { id: 'documents', label: 'Documents', kind: 'section', section: 'Documents' },
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

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState(() => authRedirectError(window.location.search, window.location.hash) ?? '')
  const [recoveryMode, setRecoveryMode] = useState(() => isPasswordRecoveryRequested(window.location.search, window.location.hash))

  useEffect(() => {
    let active = true
    let authEventSeen = false
    if (authError) {
      const url = new URL(window.location.href)
      for (const key of ['error', 'error_code', 'error_description', 'flow']) url.searchParams.delete(key)
      url.hash = ''
      window.history.replaceState(window.history.state, document.title, url)
    }
    const unsubscribe = demoAuthProvider.subscribe((user, event) => {
      authEventSeen = true
      if (active) {
        setCurrentUser(user)
        if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
        if (event === 'SIGNED_OUT') setRecoveryMode(false)
        setAuthReady(true)
      }
    })
    demoAuthProvider.getCurrentUser().then((user) => {
      if (active && !authEventSeen) setCurrentUser(user)
    }).catch((error: unknown) => {
      logClientError('restore auth session', error)
      if (active && !authEventSeen) setAuthError(error instanceof Error ? error.message : 'Could not restore the local profile. Please try again.')
    }).finally(() => {
      if (active) setAuthReady(true)
    })
    return () => { active = false; unsubscribe() }
  }, [])

  const onAuthenticated = (user: User, notice?: string) => {
    setCurrentUser(user)
    setAuthError(notice ?? '')
  }
  const onRecoveryComplete = () => {
    setRecoveryMode(false)
    setAuthError('')
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  if (!authReady) return <main className="auth-screen"><section className="auth-panel"><div className="auth-heading"><span className="eyebrow">STRAVIO WORKSPACE</span><h1>Restoring local profile…</h1></div></section></main>
  if (recoveryMode) return <AppErrorBoundary><AuthScreen onAuthenticated={onAuthenticated} onRecoveryComplete={onRecoveryComplete} initialMode="recovery" /></AppErrorBoundary>
  if (!currentUser) return <AppErrorBoundary><AuthScreen onAuthenticated={onAuthenticated} initialError={authError} key={authError} /></AppErrorBoundary>

  return <AppErrorBoundary><CurrentUserProvider user={currentUser}><AuthenticatedWorkspace key={currentUser.id} user={currentUser} migrationNotice={authError || undefined} onLogout={() => demoAuthProvider.logout()} onUserUpdated={setCurrentUser} /></CurrentUserProvider></AppErrorBoundary>
}

type WorkspaceProps = { user: User; migrationNotice?: string; onLogout: () => void; onUserUpdated: (user: User) => void }

function AuthenticatedWorkspace({ user, migrationNotice, onLogout, onUserUpdated }: WorkspaceProps) {
  const [strategyDocuments, setStrategyDocuments] = useState<StrategyDocument[]>([])
  const [activity, setActivity] = useState<StrategyActivity[]>([])
  const [planningTasks, setPlanningTasks] = useState<PlanningTask[]>([])
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [workspaceLoadError, setWorkspaceLoadError] = useState('')
  const [workspaceError, setWorkspaceError] = useState('')
  const [planningStrategyOverride, setPlanningStrategyOverride] = useState<StrategyData | null>(null)
  const [agentPrompt, setAgentPrompt] = useState<{ id: string; prompt: string; currentDocument?: AgentContext['currentDocument'] }>()
  const [tabs, setTabs] = useState(initialTabs)
  const [activeTabId, setActiveTabId] = useState('overview')
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('Overview')
  const [query, setQuery] = useState('')
  const [agentOpen, setAgentOpen] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const refreshTasks = useCallback(() => {
    void getPlanningTasks(user.id).then(setPlanningTasks).catch((error: unknown) => { logClientError('refresh Planning tasks', error); setWorkspaceError(userFacingError(error, 'Could not refresh Planning tasks. Please try again.')) })
  }, [user.id])

  const refreshRecentActivity = useCallback(() => {
    void getRecentActivity(user.id).then(setActivity).catch((error: unknown) => { logClientError('refresh activity', error); setWorkspaceError('Could not refresh activity. Please try again.') })
  }, [user.id])

  const refreshWorkspaceData = useCallback(() => {
    setWorkspaceLoading(true)
    setWorkspaceLoadError('')
    void Promise.all([getStrategyDocuments(user.id), getRecentActivity(user.id), getPlanningTasks(user.id)]).then(([documents, recentActivity, tasks]) => {
      setStrategyDocuments(documents)
      setActivity(recentActivity)
      setPlanningTasks(tasks)
      setWorkspaceLoading(false)
      setWorkspaceError('')
    }).catch((error: unknown) => { logClientError('refresh workspace', error); setWorkspaceLoading(false); setWorkspaceLoadError(userFacingError(error, 'Workspace data could not be loaded. Please try again.')) })
  }, [user.id])

  useEffect(() => {
    let active = true
    Promise.all([getStrategyDocuments(user.id), getRecentActivity(user.id), getPlanningTasks(user.id)]).then(([documents, recentActivity, tasks]) => {
      if (!active) return
      setStrategyDocuments(documents)
      setActivity(recentActivity)
      setPlanningTasks(tasks)
      setWorkspaceLoading(false)
      setWorkspaceLoadError('')
      setWorkspaceError('')
    }).catch((error: unknown) => {
      logClientError('load workspace data', error)
      if (active) {
        setWorkspaceLoading(false)
        setWorkspaceLoadError(userFacingError(error, 'Workspace data could not be loaded. Please try again.'))
      }
    })
    return () => { active = false }
  }, [user.id])

  const documentSyncQueue = useRef(Promise.resolve())
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('stravio:backend-error', { detail: workspaceError }))
  }, [workspaceError])
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('stravio:workspace-load-state', { detail: { loading: workspaceLoading, error: workspaceLoadError } }))
  }, [workspaceLoading, workspaceLoadError])
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
    }).catch((error: unknown) => { logClientError('sync strategy documents', error); setWorkspaceError('Could not refresh strategy documents. Please try again.') })
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
      activeView: activeTab.kind === 'section' ? activeTab.section ?? 'Workspace' : 'Documents',
      currentDocument: agentPrompt?.currentDocument ?? selectedDocument,
    }
  }

  const openTab = (tab: WorkspaceTab) => {
    setTabs((current) => current.some((item) => item.id === tab.id) ? current : [...current, tab])
    setActiveTabId(tab.id)
    if (tab.kind === 'section' && tab.section) setActiveSection(tab.section)
    if (tab.kind === 'strategy-document') setActiveSection('Documents')
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
      await resolveAgentProposal(user.id, strategyId, messageId, 'apply')
      if (proposal.kind === 'create-tasks') {
        invalidatePlanningTaskCache(user.id)
        window.dispatchEvent(new Event(PLANNING_TASKS_CHANGED_EVENT))
      }
      else {
        const updated = await getStrategy(user.id, strategyId)
        if (updated) window.dispatchEvent(new CustomEvent(STRATEGY_DATA_EVENT, { detail: updated }))
      }
      return true
    } catch (error) {
      logClientError('apply AI proposal', error)
      setWorkspaceError(userFacingError(error, 'The AI change was not applied. Please try again.'))
      return false
    }
  }

  const handleAgentPrompt = (id: string) => setAgentPrompt((current) => current?.id === id ? undefined : current)

  const createBlankDocument = async () => {
    try {
      const strategy = await saveStrategyData(loadStrategyData(user.id))
      const now = new Date().toISOString()
      const document = await createStrategyDocumentRecord({
        userId: user.id,
        id: createDocumentId(),
        title: 'Untitled Document',
        content: '',
        createdAt: now,
        updatedAt: now,
        status: 'ready',
        strategy,
      })
      setStrategyDocuments((current) => [document, ...current])
      openTab({ id: `strategy-document:${document.id}`, label: document.title, kind: 'strategy-document', section: 'Documents', strategyDocumentId: document.id })
      setWorkspaceError('')
    } catch (error) {
      logClientError('create document', error)
      setWorkspaceError(userFacingError(error, 'The document was not created. Please try again.'))
    }
  }

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

  const generateStrategyDocument = async (strategy: StrategyData) => {
    if (strategy.userId !== user.id) return false
    try {
      const savedStrategy = await saveStrategyData(strategy)
      const document = await createStrategyDocumentRecord(createStrategyDocument(savedStrategy))
      setStrategyDocuments((current) => [document, ...current])
      refreshRecentActivity()
      openTab({ id: `strategy-document:${document.id}`, label: document.title, kind: 'strategy-document', section: 'Documents', strategyDocumentId: document.id })
      setWorkspaceError('')
      return true
    } catch (error) {
      logClientError('create strategy document', error)
      setWorkspaceError(userFacingError(error, 'The document was not created. Please try again.'))
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
      logClientError('save strategy document', error)
      setWorkspaceError(userFacingError(error, 'The document was not saved. Please try again.'))
      return false
    }
  }

  const renameStrategyDocument = async (id: string, title: string) => {
    if (!title.trim()) return false
    try {
      const updated = await renameStrategyDocumentRecord(user.id, id, title)
      setStrategyDocuments((current) => current.map((document) => document.id === id ? updated : document))
      setTabs((current) => current.map((tab) => tab.strategyDocumentId === id ? { ...tab, label: updated.title } : tab))
      refreshRecentActivity()
      setWorkspaceError('')
      return true
    } catch (error) {
      logClientError('rename strategy document', error)
      setWorkspaceError(userFacingError(error, 'The document was not renamed. Please try again.'))
      return false
    }
  }

  const duplicateStrategyDocument = async (document: StrategyDocument) => {
    const now = new Date().toISOString()
    if (document.userId !== user.id) return false
    try {
      const duplicate = await createStrategyDocumentRecord({ ...document, id: createDocumentId(), title: `${document.title} (Copy)`, createdAt: now, updatedAt: now, status: 'ready', strategy: structuredClone(document.strategy) })
      setStrategyDocuments((current) => [duplicate, ...current])
      refreshRecentActivity()
      openTab({ id: `strategy-document:${duplicate.id}`, label: duplicate.title, kind: 'strategy-document', section: 'Documents', strategyDocumentId: duplicate.id })
      return true
    } catch (error) {
      logClientError('duplicate strategy document', error)
      setWorkspaceError(userFacingError(error, 'The document was not duplicated. Please try again.'))
      return false
    }
  }

  const deleteStrategyDocument = async (id: string) => {
    try {
      await deleteStrategyDocumentRecord(user.id, id)
      setStrategyDocuments((current) => current.filter((item) => item.id !== id))
      refreshRecentActivity()
    } catch (error) {
      logClientError('delete strategy document', error)
      setWorkspaceError(userFacingError(error, 'The document was not deleted. Please try again.'))
      return false
    }
    const nextTabs = tabs.filter((tab) => tab.strategyDocumentId !== id)
    setTabs(nextTabs)
    if (activeTab.strategyDocumentId === id) {
      const listTab: WorkspaceTab = { id: 'documents', label: 'Documents', kind: 'section', section: 'Documents' }
      setTabs((current) => current.some((tab) => tab.id === listTab.id) ? current : [...current, listTab])
      setActiveTabId(listTab.id)
      setActiveSection('Documents')
    }
    return true
  }

  const saveProfileName = async (name: string) => {
    const updated = await demoAuthProvider.updateProfile(user.id, name)
    onUserUpdated(updated)
    return true
  }

  const addTab = () => navigate('Documents')

  return <AppLayout activeSection={activeSection} tabs={tabs} activeTabId={activeTabId} query={query} agentOpen={agentOpen} agentContext={getAgentContext} agentPrompt={agentPrompt} sidebarOpen={sidebarOpen} onQueryChange={setQuery} onNavigate={navigate} onSelectTab={openTab} onCloseTab={closeTab} onAddTab={addTab} onToggleAgent={() => setAgentOpen((open) => !open)} onCloseAgent={() => setAgentOpen(false)} onAgentPromptHandled={handleAgentPrompt} onApplyAgentProposal={handleAgentProposal} onToggleSidebar={() => setSidebarOpen((open) => !open)}>
    {activeTab.kind === 'strategy-document' ? <StrategyDocuments documents={strategyDocuments} selectedDocumentId={activeTab.strategyDocumentId} onCreate={() => void createBlankDocument()} onOpen={(document) => openTab({ id: `strategy-document:${document.id}`, label: document.title, kind: 'strategy-document', section: 'Documents', strategyDocumentId: document.id })} onSave={saveStrategyDocument} onRename={renameStrategyDocument} onDelete={deleteStrategyDocument} onDuplicate={duplicateStrategyDocument} onBack={() => navigate('Documents')} onOpenPlanning={openPlanningForStrategy} onAskAI={askAgent} /> : activeTab.section === 'Strategy' ? <Strategy onGenerateDocument={generateStrategyDocument} onAskAI={askAgent} /> : activeTab.section === 'Documents' ? <StrategyDocuments documents={strategyDocuments} onCreate={() => void createBlankDocument()} onOpen={(document) => openTab({ id: `strategy-document:${document.id}`, label: document.title, kind: 'strategy-document', section: 'Documents', strategyDocumentId: document.id })} onSave={saveStrategyDocument} onRename={renameStrategyDocument} onDelete={deleteStrategyDocument} onDuplicate={duplicateStrategyDocument} onBack={() => navigate('Documents')} onOpenPlanning={openPlanningForStrategy} onAskAI={askAgent} /> : activeTab.section === 'Overview' ? <Dashboard documents={strategyDocuments} activity={activity} migrationNotice={migrationNotice} onOpenStrategy={() => navigate('Strategy')} onOpenDocuments={() => navigate('Documents')} onOpenDocument={(document) => openTab({ id: `strategy-document:${document.id}`, label: document.title, kind: 'strategy-document', section: 'Documents', strategyDocumentId: document.id })} onOpenAgent={askAgent} onOpenPlanning={() => navigate('Planning')} /> : activeTab.section === 'Planning' ? <Planning strategyOverride={planningStrategyOverride} onCreateStrategy={() => navigate('Strategy')} onAskAI={askAgent} /> : <AccountSettings user={user} migrationNotice={migrationNotice} onSaveName={saveProfileName} onLogout={onLogout} />}
  </AppLayout>
}