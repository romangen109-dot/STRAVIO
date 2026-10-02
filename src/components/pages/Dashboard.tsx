import { useEffect, useState } from 'react'
import { ArrowRight, Check, Circle, Clock3, FileText, ListChecks, Plus, Sparkles } from 'lucide-react'
import { project } from '../../data/mockProject'
import type { PlanningTask, StrategyActivity, StrategyData, StrategyDocument } from '../../types'
import { usePlanningTasks } from '../planning/usePlanningTasks'
import { hasStrategyProgress, useStrategy } from '../strategy/useStrategy'

const stages = ['Current State', 'Desired State', 'Strategic Options', 'Plans', 'Stage Plans', 'Control']
const activityLabels: Record<StrategyActivity['type'], string> = {
  'strategy-created': 'Strategy created',
  'strategy-updated': 'Strategy updated',
  'strategy-completed': 'Strategy completed',
  'document-generated': 'Document generated',
  'document-edited': 'Document edited',
  'document-deleted': 'Document deleted',
  'task-created': 'Task created',
  'task-completed': 'Task completed',
  'ai-action-applied': 'AI action applied',
}

type Props = {
  documents: StrategyDocument[]
  activity: StrategyActivity[]
  migrationNotice?: string
  onOpenStrategy: () => void
  onOpenDocuments: () => void
  onOpenDocument: (document: StrategyDocument) => void
  onOpenAgent: (prompt?: string) => void
  onOpenPlanning: () => void
}

export function Dashboard({ documents, activity, migrationNotice, onOpenStrategy, onOpenDocuments, onOpenDocument, onOpenAgent, onOpenPlanning }: Props) {
  const { strategy, updateStrategy, loading: strategyLoading, loadError: strategyLoadError } = useStrategy()
  const { tasks, loading: tasksLoading, loadError: tasksLoadError } = usePlanningTasks()
  const [pendingStep, setPendingStep] = useState<number | null>(null)
  const started = hasStrategyProgress(strategy)
  const currentStage = strategy.completed ? 'Completed' : stages[Math.min(strategy.workflowStep, stages.length - 1)]
  const strategyTitle = strategy.desiredState.destination.trim()
    || (strategy.name !== project.name ? strategy.name.trim() : '')
    || 'Untitled Strategy'
  const strategyDescription = strategy.desiredState.successPicture.trim()
    || strategy.desiredState.destination.trim()
    || strategy.currentState.situation.trim()
    || 'Strategy in progress'
  const recentDocuments = [...documents].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 5)
  const strategyDocument = [...documents].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).find((document) => document.strategy.id === strategy.id)
  const strategyTasks = started ? tasks.filter((task) => task.strategyId === strategy.id) : []
  const openTasks = strategyTasks.filter((task) => task.status !== 'completed')
  const dashboardTasks = [...openTasks].sort((left, right) => (left.deadline || '9999-12-31').localeCompare(right.deadline || '9999-12-31')).slice(0, 3)
  const completedTasks = strategyTasks.filter((task) => task.status === 'completed').length
  const highPriorityTasks = openTasks.filter((task) => task.priority === 'high').length
  const nearestDeadline = openTasks.filter((task) => task.deadline).sort((left, right) => left.deadline.localeCompare(right.deadline))[0]?.deadline
  const openStep = (step: number) => {
    if (step !== strategy.workflowStep) {
      setPendingStep(step)
      updateStrategy((current) => ({ ...current, workflowStep: step }))
    } else {
      onOpenStrategy()
    }
  }
  const nextAction = getNextAction(strategy, started, strategyDocument, onOpenDocument, openStep)
  const greeting = getGreeting()

  useEffect(() => {
    if (pendingStep !== null && strategy.workflowStep === pendingStep) {
      setPendingStep(null)
      onOpenStrategy()
    }
  }, [onOpenStrategy, pendingStep, strategy.workflowStep])

  if (strategyLoading || tasksLoading) return <div className="dashboard-page"><section className="workspace-panel dashboard-active" aria-live="polite">Loading your cloud workspace…</section></div>
  if (strategyLoadError || tasksLoadError) return <div className="dashboard-page"><section className="workspace-panel dashboard-active" role="alert"><h2>Workspace data could not be loaded.</h2><p>{strategyLoadError || tasksLoadError}</p><button className="outline-button" onClick={() => window.location.reload()}>Reload workspace</button></section></div>

  return <div className="dashboard-page">
    <header className="dashboard-welcome">
      <div><span className="eyebrow">STRAVIO WORKSPACE <i /> PERSONAL</span><h1>{greeting}, welcome back.</h1><p>Your strategic work, in one place.</p></div>
      {started && <div className="dashboard-current-label"><span className="dashboard-live-dot" /> ACTIVE STRATEGY <strong>{strategyTitle}</strong></div>}
    </header>
    {migrationNotice && <div className="account-migration-notice dashboard-migration-notice"><span>i</span>{migrationNotice}</div>}

    <section className={`dashboard-active workspace-panel ${started ? '' : 'is-empty'}`}>
      {started ? <>
        <div className="dashboard-active-top"><span className="eyebrow"><span className="dashboard-live-dot" /> ACTIVE STRATEGY</span><span className="dashboard-stage-label">CURRENT STAGE <strong>{currentStage}</strong></span></div>
        <div className="dashboard-strategy-main"><div><h2>{strategyTitle}</h2><p>{strategyDescription}</p></div><button className="outline-button algorithm-primary" onClick={() => onOpenStrategy()}><span>Open Strategy</span><ArrowRight size={14} /></button></div>
        <div className="dashboard-strategy-meta"><span><small>CREATED</small>{formatDate(strategy.createdAt)}</span><span><small>LAST UPDATED</small>{formatDate(strategy.updatedAt)}</span><span><small>PROGRESS</small>{strategy.completed ? 'All stages complete' : `Stage ${strategy.workflowStep + 1} of ${stages.length}`}</span></div>
      </> : <div className="dashboard-empty-copy"><span className="dashboard-empty-icon"><Sparkles size={17} /></span><div><span className="eyebrow">YOUR STRATEGY WORKSPACE</span><h2>No strategy yet</h2><p>Turn your current situation into a structured strategy.</p><button className="outline-button algorithm-primary" onClick={() => openStep(0)}><Plus size={14} /> Create your first strategy</button></div></div>}
    </section>

    {started && <section className="dashboard-progress workspace-panel">
      <div className="dashboard-section-heading"><div><span className="eyebrow">STRATEGY ALGORITHM</span><h2>Progress</h2></div><button className="subtle-link" onClick={() => openStep(strategy.workflowStep)}>Continue <ArrowRight size={13} /></button></div>
      <div className="dashboard-stage-list">{stages.map((stage, index) => {
        const complete = strategy.completed || index < strategy.workflowStep
        const current = !strategy.completed && index === strategy.workflowStep
        return <button className={`dashboard-stage ${complete ? 'complete' : ''} ${current ? 'current' : ''}`} key={stage} onClick={() => openStep(index)} disabled={index > strategy.workflowStep || strategy.completed}>
          <span className="dashboard-stage-marker">{complete ? <Check size={12} /> : current ? <span /> : <Circle size={10} />}</span>
          <span>{stage}</span>
          {current && <small>IN PROGRESS</small>}
          {complete && <small>COMPLETE</small>}
        </button>
      })}</div>
    </section>}

    <section className="dashboard-quick-actions">
      <button onClick={() => openStep(started ? strategy.workflowStep : 0)}><span><Plus size={15} /></span><strong>{started ? 'Strategy Algorithm' : 'Create Strategy'}</strong><small>Open the strategy algorithm</small></button>
      <button onClick={onOpenDocuments}><span><FileText size={15} /></span><strong>Open Documents</strong><small>{documents.length} saved {documents.length === 1 ? 'document' : 'documents'}</small></button>
      <button onClick={() => openStep(strategy.workflowStep)}><span><ListChecks size={15} /></span><strong>Continue Strategy</strong><small>{started ? currentStage : 'Start with your current state'}</small></button>
      <button onClick={() => onOpenAgent()}><span><Sparkles size={15} /></span><strong>Open AI Agent</strong><small>Work with project context</small></button>
    </section>

    <section className="dashboard-ai-panel workspace-panel">
      <div className="dashboard-section-heading"><div><span className="eyebrow">PROJECT-AWARE ASSISTANCE</span><h2>Ask Stravio AI</h2></div><button className="subtle-link" onClick={() => onOpenAgent()}>Open Agent <ArrowRight size={13} /></button></div>
      <div className="dashboard-ai-prompts"><button onClick={() => onOpenAgent('Analyze my strategy')}>Analyze my strategy</button><button onClick={() => onOpenAgent('What should I do next?')}>What should I do next?</button><button onClick={() => onOpenAgent('Find risks and contradictions')}>Find risks</button><button onClick={() => onOpenAgent('Review Plan A and Plan B')}>Review my plan</button></div>
    </section>

    <div className="dashboard-lower-grid">
      <section className="dashboard-panel workspace-panel">
        <div className="dashboard-section-heading"><div><span className="eyebrow">STRATEGY LIBRARY</span><h2>Recent Documents</h2></div><button className="subtle-link" onClick={onOpenDocuments}>View all <ArrowRight size={13} /></button></div>
        {recentDocuments.length ? <div className="dashboard-document-list">{recentDocuments.map((document) => <article className="dashboard-document-row" key={document.id}>
          <span className="dashboard-document-icon"><FileText size={15} /></span><span className="dashboard-document-copy"><strong>{document.title}</strong><small>{formatDate(document.createdAt)}</small></span>
          <span className={`strategy-document-status ${document.status}`}>{document.status === 'edited' ? 'EDITED' : 'READY'}</span>
          <button className="outline-button" onClick={() => onOpenDocument(document)}>Open</button>
        </article>)}</div> : <div className="dashboard-inline-empty"><FileText size={15} /><span>No strategy documents yet.</span><button onClick={onOpenDocuments}>Open library</button></div>}
      </section>

      <section className="dashboard-panel workspace-panel">
        <div className="dashboard-section-heading"><div><span className="eyebrow">BASED ON CURRENT PROGRESS</span><h2>Next Actions</h2></div><span className="dashboard-count">{started ? '01' : '00'}</span></div>
        {started ? <button className="dashboard-next-action" onClick={nextAction.onClick}><span className="dashboard-action-marker"><Circle size={12} /></span><span><strong>{nextAction.title}</strong><small>{nextAction.detail}</small></span><ArrowRight size={14} /></button> : <div className="dashboard-inline-empty"><Clock3 size={15} /><span>Start a strategy to see your next action.</span></div>}
      </section>
    </div>

    <section className="dashboard-panel workspace-panel dashboard-execution-panel">
      <div className="dashboard-section-heading"><div><span className="eyebrow">STRATEGY EXECUTION</span><h2>Planning</h2></div><button className="outline-button" onClick={onOpenPlanning}>Open Planning <ArrowRight size={13} /></button></div>
      <div className="dashboard-execution-stats"><span><small>TOTAL TASKS</small><strong>{strategyTasks.length}</strong></span><span><small>COMPLETED</small><strong>{completedTasks}</strong></span><span><small>HIGH PRIORITY</small><strong>{highPriorityTasks}</strong></span><span><small>NEXT DEADLINE</small><strong>{nearestDeadline ? formatDate(nearestDeadline) : '—'}</strong></span></div>
      {dashboardTasks.length ? <div className="dashboard-upcoming-tasks">{dashboardTasks.map((task) => <DashboardTask key={task.id} task={task} onOpenPlanning={onOpenPlanning} />)}</div> : <div className="dashboard-inline-empty"><Clock3 size={15} /><span>{started ? 'Your plan is ready to be executed.' : 'Create a strategy to start planning.'}</span><button onClick={onOpenPlanning}>{started ? 'Add a task' : 'Open Planning'}</button></div>}
    </section>

    <section className="dashboard-panel workspace-panel dashboard-activity-panel">
      <div className="dashboard-section-heading"><div><span className="eyebrow">LOCAL WORKSPACE HISTORY</span><h2>Recent Activity</h2></div><span className="dashboard-count">{String(Math.min(activity.length, 10)).padStart(2, '0')}</span></div>
      {activity.length ? <div className="dashboard-activity-list">{activity.slice(0, 8).map((entry) => <div className="dashboard-activity-row" key={entry.id}><span className={`activity-indicator ${entry.type.startsWith('document') ? 'document' : 'strategy'}`} /> <strong>{activityLabels[entry.type]}</strong><span>{entry.title}</span><time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time></div>)}</div> : <div className="dashboard-inline-empty"><Clock3 size={15} /><span>New strategy and document activity will appear here.</span></div>}
    </section>
  </div>
}

function DashboardTask({ task, onOpenPlanning }: { task: PlanningTask; onOpenPlanning: () => void }) {
  return <button className="dashboard-upcoming-task" onClick={onOpenPlanning}><span className={`planning-priority ${task.priority}`}>{task.priority}</span><span><strong>{task.title}</strong><small>{task.deadline ? `Due ${formatDate(task.deadline)}` : 'No deadline'} · {task.status === 'in-progress' ? 'In Progress' : 'To Do'}</small></span><ArrowRight size={13} /></button>
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(value: string) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function getNextAction(strategy: StrategyData, started: boolean, document: StrategyDocument | undefined, onOpenDocument: (document: StrategyDocument) => void, openStep: (step: number) => void) {
  if (!started) return { title: 'Create Strategy', detail: 'Start by describing the current state.', onClick: () => openStep(0) }
  if (strategy.completed && document) return { title: 'Review Strategy Document', detail: document.title, onClick: () => onOpenDocument(document) }
  if (strategy.completed) return { title: 'Generate Strategy Document', detail: 'Turn the completed strategy into a document.', onClick: () => openStep(5) }
  const actions = [
    ['Complete Current State', 'Add the context, resources, and constraints.'],
    ['Define Desired State', 'Describe the destination and success indicators.'],
    ['Review Strategic Options', 'Select the approaches worth pursuing.'],
    ['Create Plan A', 'Define the primary plan and key actions.'],
    ['Add Stage Plans', 'Break the strategy into actionable stages.'],
    ['Complete Control', 'Set metrics and review conditions.'],
  ]
  const [title, detail] = actions[Math.min(strategy.workflowStep, actions.length - 1)]
  return { title, detail, onClick: () => openStep(strategy.workflowStep) }
}