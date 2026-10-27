import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, Check, Clock3, ListChecks, Plus, Sparkles, Trash2, Pencil, X } from 'lucide-react'
import type { PlanningTask, PlanningTaskPriority, PlanningTaskStatus, StrategyData } from '../../types'
import { dateKey, getWeekBounds, matchesPlanningDate, type PlanningDateView } from '../../data/planningDateFilters'
import { usePlanningTasks } from '../planning/usePlanningTasks'
import { hasStrategyProgress, useStrategy } from '../strategy/useStrategy'
import { useI18n } from '../../i18n'

type PlanningStage = { id: string; title: string; description: string }
type Props = {
  strategyOverride?: StrategyData | null
  onCreateStrategy: () => void
  onAskAI: (prompt: string) => void
}

type TaskDraft = {
  title: string
  description: string
  stageId: string
  status: PlanningTaskStatus
  priority: PlanningTaskPriority
  deadline: string
}

const algorithmStages = ['Current State', 'Desired State', 'Strategic Options', 'Plan A / Plan B', 'Stage Plans', 'Control']
const statusLabels: Record<PlanningTaskStatus, string> = { todo: 'To Do', 'in-progress': 'In Progress', completed: 'Completed' }
const priorityLabels: Record<PlanningTaskPriority, string> = { low: 'low', medium: 'medium', high: 'high' }

function buildStages(strategy: StrategyData): PlanningStage[] {
  const selectedOptions = strategy.strategicOptions.filter((option) => strategy.selectedOptionIds.includes(option.id)).map((option) => option.title)
  const planSummary = (['A', 'B'] as const).map((key) => strategy.plans[key].objective.trim()).filter(Boolean).map((objective, index) => `Plan ${index === 0 ? 'A' : 'B'}: ${objective}`)
  const executionSummary = strategy.stages.map((stage) => [stage.title, stage.objective, stage.actions].map((value) => value.trim()).filter(Boolean).join(' · ')).filter(Boolean)
  const controlSummary = strategy.control.metrics.map((metric) => [metric.name, metric.target && `Target ${metric.target}`].filter(Boolean).join(' · ')).filter(Boolean)
  return [
    { id: 'current-state', title: 'Current State', description: strategy.currentState.situation.trim() },
    { id: 'desired-state', title: 'Desired State', description: [strategy.desiredState.destination, strategy.desiredState.successPicture].map((value) => value.trim()).filter(Boolean).join(' · ') },
    { id: 'strategic-options', title: 'Strategic Options', description: selectedOptions.join(' · ') },
    { id: 'plans', title: 'Plan A / Plan B', description: planSummary.join(' · ') },
    { id: 'stage-plans', title: 'Stage Plans', description: executionSummary.join(' · ') },
    { id: 'control', title: 'Control', description: controlSummary.join(' · ') || strategy.control.reviewConditions.trim() },
  ]
}

export function Planning({ strategyOverride, onCreateStrategy, onAskAI }: Props) {
  const { t, formatDate } = useI18n()
  const { strategy: savedStrategy, loading: strategyLoading, error: strategyError } = useStrategy()
  const { tasks, createTask, updateTask, deleteTask, createFromStagePlans, saving, loading: tasksLoading, loadError: tasksLoadError, error } = usePlanningTasks()
  const strategy = strategyOverride ?? savedStrategy
  const [editingTask, setEditingTask] = useState<PlanningTask | null>(null)
  const [newTaskStage, setNewTaskStage] = useState<string | null>(null)
  const [planningView, setPlanningView] = useState<PlanningDateView>('all')
  const [monthCursor, setMonthCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null)
  const strategyStarted = hasStrategyProgress(strategy)
  const stages = buildStages(strategy)
  const strategyTasks = tasks.filter((task) => task.strategyId === strategy.id)
  const completedCount = strategyTasks.filter((task) => task.status === 'completed').length
  const inProgressCount = strategyTasks.filter((task) => task.status === 'in-progress').length
  const highPriorityCount = strategyTasks.filter((task) => task.priority === 'high' && task.status !== 'completed').length
  const nextDeadline = strategyTasks.filter((task) => task.status !== 'completed' && task.deadline).sort((left, right) => left.deadline.localeCompare(right.deadline))[0]?.deadline
  const currentAlgorithmStage = strategy.completed ? 'Completed' : algorithmStages[Math.min(strategy.workflowStep, algorithmStages.length - 1)]
  const strategyTitle = strategy.desiredState.destination.trim()
    || strategy.name.trim()
    || t('Untitled Strategy')
  const pendingStagePlans = strategy.stages.filter((stage) => stage.title.trim() && !strategyTasks.some((task) => task.sourceStagePlanId === stage.id))
  const today = dateKey(new Date())
  const { weekStart, weekEnd } = getWeekBounds(today)
  const monthKey = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`
  const monthDays = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate()
  const monthOffset = (new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay() + 6) % 7
  const monthCalendarDays = Array.from({ length: monthOffset + monthDays }, (_, index) => index < monthOffset ? null : index - monthOffset + 1)
  const taskCountForDate = (date: string) => strategyTasks.filter((task) => task.deadline === date).length
  const matchesPlanningView = (task: PlanningTask) => matchesPlanningDate(task.deadline, planningView, today, weekStart, weekEnd, monthKey, selectedCalendarDate)
  const visibleTaskCount = strategyTasks.filter(matchesPlanningView).length

  const openCreate = (stageId = stages[0].id) => setNewTaskStage(stageId)
  const saveTask = async (draft: TaskDraft) => {
    const saved = editingTask
      ? await updateTask(editingTask.id, draft)
      : await createTask({ ...draft, strategyId: strategy.id, sourceStagePlanId: undefined })
    if (saved) {
      setEditingTask(null)
      setNewTaskStage(null)
    }
  }

  if (strategyLoading || tasksLoading) return <div className="secondary-page planning-page"><section className="workspace-panel planning-empty" aria-live="polite">{t('Loading strategy and Planning…')}</section></div>
  if (strategyError || tasksLoadError) return <div className="secondary-page planning-page"><section className="workspace-panel planning-empty" role="alert"><h2>{t('Planning data could not be loaded.')}</h2><p>{t(strategyError || tasksLoadError || '')}</p><button className="outline-button" onClick={() => window.location.reload()}>{t('Reload workspace')}</button></section></div>

  return <div className="secondary-page planning-page">
    <div className="page-crumb"><span>{t('PROJECT')}</span><span>›</span><span>{t('PLANNING')}</span></div>
    <div className="secondary-heading planning-page-heading">
      <div><span className="eyebrow">{t('STRATEGY EXECUTION')} <i /> {t(strategyStarted ? 'ACTIVE PLAN' : 'WAITING FOR STRATEGY')}</span><h1>{t('Planning')}</h1><p>{t(strategyStarted ? 'Translate strategic decisions into coordinated execution.' : 'Prepare a plan for the active strategy.')}</p></div>
      {strategyStarted && <div className="planning-heading-actions">{saving && <span className="eyebrow" role="status">{t('SAVING IN BROWSER…')}</span>}<button className="outline-button" onClick={() => onAskAI('Analyze my tasks and identify the most important next actions.')}>{t('Ask AI')}</button><button className="outline-button algorithm-primary" onClick={() => openCreate()} disabled={saving}><Plus size={14} /> {t('Add Task')}</button></div>}
    </div>
    {error && <div className="auth-error" role="alert">{t('Planning changes were not saved: {error}', { error })}</div>}

    {!strategyStarted ? <section className="planning-empty workspace-panel"><span className="planning-empty-icon"><ListChecks size={18} /></span><span className="eyebrow">{t('STRATEGY REQUIRED')}</span><h2>{t('Create a strategy first.')}</h2><p>{t('Planning stages and tasks are linked to the active Strategy Algorithm.')}</p><button className="outline-button algorithm-primary" onClick={onCreateStrategy}><Plus size={14} /> {t('Create Strategy')}</button></section> : <>
      <section className="planning-strategy workspace-panel">
        <div className="planning-strategy-top"><span className="eyebrow"><span className="dashboard-live-dot" /> {t('ACTIVE STRATEGY')}</span><span className="planning-current-stage">{t('CURRENT ALGORITHM STAGE')} <strong>{t(currentAlgorithmStage)}</strong></span></div>
        <div className="planning-strategy-title"><div><h2>{strategyTitle}</h2><p>{strategy.desiredState.successPicture.trim() || strategy.desiredState.destination.trim() || strategy.currentState.situation.trim() || t('Strategy in progress')}</p></div></div>
        <div className="planning-summary-metrics">
          <span><small>{t('TOTAL TASKS')}</small><strong>{strategyTasks.length}</strong></span>
          <span><small>{t('COMPLETED')}</small><strong>{completedCount}</strong></span>
          <span><small>{t('IN PROGRESS')}</small><strong>{inProgressCount}</strong></span>
          <span><small>{t('HIGH PRIORITY')}</small><strong>{highPriorityCount}</strong></span>
          <span><small>{t('NEXT DEADLINE')}</small><strong>{nextDeadline ? formatDate(nextDeadline) : '—'}</strong></span>
        </div>
      </section>

      <section className="planning-calendar-panel workspace-panel">
        <div className="planning-view-toolbar" role="group" aria-label={t('Planning views')}>
          {([['all', 'All tasks'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'Week'], ['month', 'Month']] as const).map(([view, label]) => <button key={view} aria-pressed={planningView === view} className={`planning-view-button ${planningView === view ? 'is-active' : ''}`} onClick={() => { setPlanningView(view); setSelectedCalendarDate(null) }}>{t(label)}</button>)}
        </div>
        {planningView === 'month' && <div className="planning-month-calendar">
          <div className="planning-month-heading"><button className="outline-button" onClick={() => { setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)); setSelectedCalendarDate(null) }} aria-label={t('Previous month')}>‹</button><strong>{formatDate(monthCursor, { month: 'long', year: 'numeric' })}</strong><button className="outline-button" onClick={() => { setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)); setSelectedCalendarDate(null) }} aria-label={t('Next month')}>›</button></div>
          <div className="planning-month-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span className="planning-month-weekday" key={day}>{t(day)}</span>)}
            {monthCalendarDays.map((day, index) => {
              const dayKey = day ? `${monthKey}-${String(day).padStart(2, '0')}` : ''
              const count = dayKey ? taskCountForDate(dayKey) : 0
              return day ? <button key={dayKey} className={`planning-month-day ${selectedCalendarDate === dayKey ? 'is-selected' : ''} ${dayKey === today ? 'is-today' : ''}`} onClick={() => setSelectedCalendarDate((current) => current === dayKey ? null : dayKey)} aria-pressed={selectedCalendarDate === dayKey} aria-label={t('{date}, {count} tasks', { date: `${formatDate(monthCursor, { month: 'long', year: 'numeric' })} ${day}`, count })}>
                <span>{day}</span>{count > 0 && <small>{t(count === 1 ? '{count} task' : '{count} tasks', { count })}</small>}
              </button> : <span className="planning-month-day is-empty" key={`empty-${index}`} aria-hidden="true" />
            })}
          </div>
          {selectedCalendarDate && <p className="planning-calendar-selection">{t('Showing tasks for {date}. Select the date again to show the full month.', { date: formatDate(selectedCalendarDate) })}</p>}
        </div>}
        {planningView !== 'all' && visibleTaskCount === 0 && <div className="planning-calendar-empty">{t(planningView === 'month' && !selectedCalendarDate ? 'No tasks are scheduled this month.' : 'No tasks are scheduled for this period.')}</div>}
      </section>

      {pendingStagePlans.length > 0 && <button className="planning-suggestions" onClick={() => void createFromStagePlans(strategy.id, strategy.stages)} disabled={saving}><span><Sparkles size={14} /></span><span><strong>{t('Tasks from Stage Plans')}</strong><small>{t('{count} untracked stage {label} · titles and details are taken from your strategy', { count: pendingStagePlans.length, label: t(pendingStagePlans.length === 1 ? 'plan' : 'plans') })}</small></span><span className="planning-suggestion-action">{t('Add {count} tasks', { count: pendingStagePlans.length })} <ArrowRight size={13} /></span></button>}

      {strategyTasks.length === 0 && <section className="planning-empty-task workspace-panel"><div><h2>{t('Your plan is ready to be executed.')}</h2><p>{t('Add the first action to begin tracking execution across your strategy stages.')}</p></div><button className="outline-button algorithm-primary" onClick={() => openCreate()} disabled={saving}><Plus size={14} /> {t('Add your first task')}</button></section>}

      <div className="planning-stage-list">{stages.map((stage, index) => {
        const stageTasks = strategyTasks.filter((task) => task.stageId === stage.id && matchesPlanningView(task))
        const stageCompleted = stageTasks.filter((task) => task.status === 'completed').length
        const stageStatus = stageTasks.length > 0 && stageCompleted === stageTasks.length ? 'completed' : stageTasks.length > 0 ? 'in-progress' : 'todo'
        const isCurrent = !strategy.completed && index === strategy.workflowStep
        return <section className={`planning-stage workspace-panel ${isCurrent ? 'is-current' : ''}`} key={stage.id}>
          <div className="planning-stage-header">
            <span className={`planning-stage-number ${stageStatus}`}><span>{String(index + 1).padStart(2, '0')}</span>{stageStatus === 'completed' && <Check size={11} />}</span>
            <div className="planning-stage-copy"><span className="planning-stage-overline">{t('STAGE {number}', { number: String(index + 1).padStart(2, '0') })}{isCurrent && <i />}{isCurrent && ` ${t('CURRENT STEP')}`}</span><h2>{t(stage.title)}</h2><p>{stage.description || t('No strategy details provided.')}</p></div>
            <div className="planning-stage-stats"><span className={`planning-stage-status ${stageStatus}`}>{t(stageStatus === 'completed' ? 'Completed' : stageStatus === 'in-progress' ? 'In Progress' : 'Not Started')}</span><span>{t('{completed} / {total} tasks', { completed: stageCompleted, total: stageTasks.length })}</span></div>
            <button className="icon-button planning-stage-add" onClick={() => openCreate(stage.id)} aria-label={t('Add task to {stage}', { stage: t(stage.title) })} title={t('Add task to stage')} disabled={saving}><Plus size={15} /></button>
          </div>

          {stage.id === 'stage-plans' && strategy.stages.length > 0 && <div className="planning-stage-plan-list">{strategy.stages.map((plan, planIndex) => <div className="planning-substage" key={plan.id}><span>{String(planIndex + 1).padStart(2, '0')}</span><strong>{plan.title.trim() || t('Stage Plan {number}', { number: planIndex + 1 })}</strong><small>{plan.objective.trim() || plan.expectedResult.trim()}</small></div>)}</div>}

          <div className="planning-task-list">{stageTasks.length ? stageTasks.map((task) => <TaskRow key={task.id} task={task} disabled={saving} onStatusChange={(status) => { void updateTask(task.id, { status }) }} onEdit={() => setEditingTask(task)} onDelete={() => { if (window.confirm(t('Delete “{title}”? This action cannot be undone.', { title: task.title }))) void deleteTask(task.id) }} />) : <div className="planning-stage-empty"><span>{t('No actions assigned to this stage.')}</span><button onClick={() => openCreate(stage.id)} disabled={saving}>{t('Add task')} <Plus size={12} /></button></div>}</div>
        </section>
      })}</div>
    </>}

    {(editingTask || newTaskStage) && <TaskModal
      stages={stages}
      task={editingTask}
      initialStageId={newTaskStage ?? stages[0].id}
      onClose={() => { setEditingTask(null); setNewTaskStage(null) }}
      onSave={saveTask}
      saving={saving}
    />}
  </div>
}

function TaskRow({ task, disabled, onStatusChange, onEdit, onDelete }: { task: PlanningTask; disabled: boolean; onStatusChange: (status: PlanningTaskStatus) => void; onEdit: () => void; onDelete: () => void }) {
  const { t, formatDate } = useI18n()
  return <article className={`planning-task-row ${task.status === 'completed' ? 'is-completed' : ''}`} aria-busy={disabled}>
    <button className={`planning-task-check ${task.status === 'completed' ? 'is-checked' : ''}`} onClick={() => onStatusChange(task.status === 'completed' ? 'todo' : 'completed')} aria-label={t(task.status === 'completed' ? 'Mark task as To Do' : 'Mark task completed')} disabled={disabled}>{task.status === 'completed' && <Check size={12} />}</button>
    <div className="planning-task-main"><strong>{task.title}</strong>{task.description && <p>{task.description}</p>}<small><Clock3 size={11} /> {t('Created {date}', { date: formatDate(task.createdAt) })}</small></div>
    <span className={`planning-priority ${task.priority}`}>{t(priorityLabels[task.priority])}</span>
    <span className="planning-deadline">{task.deadline ? <><CalendarDays size={12} /> {formatDate(task.deadline)}</> : t('No deadline')}</span>
    <select className={`planning-status-select ${task.status}`} value={task.status} onChange={(event) => onStatusChange(event.target.value as PlanningTaskStatus)} aria-label={t('Status for {title}', { title: task.title })} disabled={disabled}>
      {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}
    </select>
    <div className="planning-task-actions"><button className="icon-button" onClick={onEdit} title={t('Edit task')} aria-label={t('Edit {title}', { title: task.title })} disabled={disabled}><Pencil size={13} /></button><button className="icon-button planning-delete" onClick={onDelete} title={t('Delete task')} aria-label={t('Delete {title}', { title: task.title })} disabled={disabled}><Trash2 size={13} /></button></div>
  </article>
}

function TaskModal({ stages, task, initialStageId, onClose, onSave, saving }: { stages: PlanningStage[]; task: PlanningTask | null; initialStageId: string; onClose: () => void; onSave: (draft: TaskDraft) => Promise<void>; saving: boolean }) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<TaskDraft>(() => ({
    title: task?.title ?? '',
    description: task?.description ?? '',
    stageId: task?.stageId ?? initialStageId,
    status: task?.status ?? 'todo',
    priority: task?.priority ?? 'medium',
    deadline: task?.deadline ?? '',
  }))
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  const savingRef = useRef(saving)
  closeRef.current = onClose
  savingRef.current = saving

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const getFocusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])
    getFocusable()[0]?.focus()
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingRef.current) {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (!focusable.length) { event.preventDefault(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handleKeys)
    return () => { window.removeEventListener('keydown', handleKeys); previousFocus?.focus() }
  }, [])

  const update = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.title.trim()) return
    void onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim() })
  }

  return <div className="planning-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section ref={dialogRef} className="planning-modal workspace-panel" role="dialog" aria-modal="true" aria-labelledby="planning-modal-title">
      <header><div><span className="eyebrow">{t('STRATEGY EXECUTION')}</span><h2 id="planning-modal-title">{t(task ? 'Edit Task' : 'Add Task')}</h2></div><button className="icon-button" onClick={onClose} aria-label={t('Close')} disabled={saving}><X size={16} /></button></header>
      <form onSubmit={submit}>
        <label className="planning-field">{t('Task title')}<input required disabled={saving} value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder={t('Name the action')} /></label>
        <label className="planning-field">{t('Description')}<textarea rows={3} disabled={saving} value={draft.description} onChange={(event) => update('description', event.target.value)} placeholder={t('Context or expected outcome')} /></label>
        <div className="planning-field-grid">
          <label className="planning-field">{t('Stage')}<select disabled={saving} value={draft.stageId} onChange={(event) => update('stageId', event.target.value)}>{stages.map((stage) => <option value={stage.id} key={stage.id}>{t(stage.title)}</option>)}</select></label>
          <label className="planning-field">{t('Priority')}<select disabled={saving} value={draft.priority} onChange={(event) => update('priority', event.target.value as PlanningTaskPriority)}>{Object.entries(priorityLabels).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></label>
          {task && <label className="planning-field">{t('Status')}<select disabled={saving} value={draft.status} onChange={(event) => update('status', event.target.value as PlanningTaskStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></label>}
          <label className="planning-field">{t('Deadline')}<input disabled={saving} type="date" value={draft.deadline} onChange={(event) => update('deadline', event.target.value)} /></label>
        </div>
        <footer><button type="button" className="outline-button" onClick={onClose} disabled={saving}>{t('Cancel')}</button><button type="submit" className="outline-button algorithm-primary" disabled={saving}><Check size={13} /> {saving ? t('Saving…') : task ? t('Save Task') : t('Add Task')}</button></footer>
      </form>
    </section>
  </div>
}
