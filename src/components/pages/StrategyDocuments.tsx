import { useEffect, useState, type ReactNode } from 'react'
import { Copy, FileText, Pencil, Save, Trash2 } from 'lucide-react'
import type { PlanningTask, StrategyData, StrategyDocument } from '../../types'
import { usePlanningTasks } from '../planning/usePlanningTasks'

type Props = {
  documents: StrategyDocument[]
  selectedDocumentId?: string
  onOpen: (document: StrategyDocument) => void
  onSave: (id: string, content: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onDuplicate: (document: StrategyDocument) => Promise<boolean>
  onBack: () => void
  onOpenPlanning: (strategy: StrategyData) => void
  onAskAI: (prompt: string, documentContext?: { id: string; title: string; content: string }) => void
}

const dateFormatter = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' })

export function StrategyDocuments({ documents, selectedDocumentId, onOpen, onSave, onDelete, onDuplicate, onBack, onOpenPlanning, onAskAI }: Props) {
  const { tasks } = usePlanningTasks()
  const selected = documents.find((document) => document.id === selectedDocumentId)
  const documentTasks = selected ? tasks.filter((task) => task.strategyId === selected.strategy.id) : []
  const executionCounts = countExecutionTasks(documentTasks)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [actionId, setActionId] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    setEditing(false)
    setDraft('')
  }, [selectedDocumentId])

  const duplicate = async (document: StrategyDocument) => {
    if (actionId) return
    setActionId(document.id)
    setActionError('')
    try {
      if (!await onDuplicate(document)) setActionError('Document was not duplicated. Please try again.')
    } catch {
      setActionError('Document was not duplicated. Please try again.')
    } finally {
      setActionId('')
    }
  }

  const remove = async (id: string) => {
    if (actionId) return
    setActionId(id)
    setActionError('')
    try {
      if (!await onDelete(id)) setActionError('Document was not deleted. Please try again.')
    } catch {
      setActionError('Document was not deleted. Please try again.')
    } finally {
      setActionId('')
    }
  }

  if (!selected) return <div className="secondary-page strategy-documents-page">
    <div className="page-crumb"><span>PROJECT</span><span>›</span><span>STRATEGY DOCUMENTS</span></div>
    <div className="secondary-heading"><div><span className="eyebrow">STRATEGY LIBRARY <i /> {String(documents.length).padStart(2, '0')} DOCUMENTS</span><h1>Strategy Documents</h1><p>Сохранённые снимки стратегий, сформированные из ответов Strategy Algorithm.</p></div></div>
    {documents.length ? <div className="strategy-document-list">{documents.map((document) => <article className="strategy-document-row" key={document.id}>
      <span className="strategy-document-icon"><FileText size={17} /></span>
      <div className="strategy-document-summary"><strong>{document.title}</strong><span>Created {dateFormatter.format(new Date(document.createdAt))}</span></div>
      <span className={`strategy-document-status ${document.status}`}>{document.status === 'edited' ? 'EDITED' : 'READY'}</span>
      <button className="outline-button strategy-document-open" onClick={() => onOpen(document)}>Open</button>
      <button className="icon-button strategy-document-action" onClick={() => void duplicate(document)} aria-label={`Duplicate ${document.title}`} title="Duplicate" disabled={Boolean(actionId)}><Copy size={14} /></button>
      <button className="icon-button strategy-document-action delete" onClick={() => void remove(document.id)} aria-label={actionId === document.id ? `Deleting ${document.title}` : `Delete ${document.title}`} title={actionId === document.id ? 'Deleting…' : 'Delete'} disabled={Boolean(actionId)}><Trash2 size={14} /></button>
    </article>)}</div> : <div className="strategy-documents-empty workspace-panel"><span className="strategy-document-icon"><FileText size={18} /></span><h2>Пока нет стратегических документов</h2><p>После завершения Strategy Algorithm выберите Generate Strategy Document. Документ будет создан из сохранённых ответов.</p></div>}
    {actionError && <div className="auth-error" role="alert">{actionError}</div>}
  </div>

  const startEditing = () => {
    setDraft(selected.content)
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    setSaveError('')
    const saved = await onSave(selected.id, draft)
    setSaving(false)
    if (saved) setEditing(false)
    else setSaveError('Document was not saved. Your draft is still available here.')
  }

  return <div className="secondary-page strategy-document-editor-page">
    <div className="page-crumb"><span>PROJECT</span><span>›</span><button onClick={onBack}>STRATEGY DOCUMENTS</button><span>›</span><span>DOCUMENT</span></div>
    {(saveError || actionError) && <div className="auth-error" role="alert">{saveError || actionError}</div>}
    <div className="strategy-document-toolbar"><div className="document-toolbar-title"><span className="strategy-document-icon"><FileText size={16} /></span><div><strong>{selected.title}</strong><small>{saving ? 'Saving to cloud…' : editing ? 'Unsaved changes' : `Last saved ${dateFormatter.format(new Date(selected.updatedAt))}`}</small></div></div><div className="document-toolbar-actions">
      <button className="outline-button" onClick={() => onOpenPlanning(selected.strategy)}>Open Planning</button>
      <button className="outline-button" onClick={() => onAskAI('Analyze this strategy document for gaps and risks.', { id: selected.id, title: selected.title, content: editing ? draft : selected.content })}>Analyze this strategy</button>
      <button className="outline-button" onClick={() => void duplicate(selected)} disabled={Boolean(actionId) || saving}><Copy size={13} /> {actionId === selected.id ? 'Duplicating…' : 'Duplicate'}</button>
      {editing ? <><button className="outline-button" onClick={() => setEditing(false)} disabled={saving}>Cancel</button><button className="outline-button algorithm-primary" onClick={() => void save()} disabled={saving}><Save size={13} /> {saving ? 'Saving…' : 'Save'}</button></> : <button className="outline-button" onClick={startEditing}><Pencil size={13} /> Edit</button>}
      <button className="icon-button strategy-document-action delete" onClick={() => void remove(selected.id)} aria-label={actionId === selected.id ? 'Deleting strategy document' : 'Delete strategy document'} title={actionId === selected.id ? 'Deleting…' : 'Delete'} disabled={Boolean(actionId) || saving}><Trash2 size={14} /></button>
    </div></div>
    <div className="strategy-document-meta"><span className={`strategy-document-status ${selected.status}`}>{selected.status === 'edited' ? 'EDITED' : 'READY'}</span><span>Created {dateFormatter.format(new Date(selected.createdAt))}</span><span>Strategy Algorithm snapshot</span></div>
    <section className="strategy-execution workspace-panel"><div><span className="eyebrow">EXECUTION</span><h2>Planning</h2></div><div className="strategy-execution-counts"><span><small>TOTAL TASKS</small><strong>{executionCounts.total}</strong></span><span><small>COMPLETED</small><strong>{executionCounts.completed}</strong></span><span><small>IN PROGRESS</small><strong>{executionCounts.inProgress}</strong></span><span><small>TO DO</small><strong>{executionCounts.todo}</strong></span></div><button className="subtle-link" onClick={() => onOpenPlanning(selected.strategy)}>Open Planning <span aria-hidden="true">→</span></button></section>
    {editing ? <div className="strategy-document-edit workspace-panel"><label htmlFor="strategy-document-content">Document content</label><textarea id="strategy-document-content" value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck /></div> : <article className="strategy-document-paper workspace-panel"><DocumentMarkdown content={selected.content} /></article>}
  </div>
}

function countExecutionTasks(tasks: PlanningTask[]) {
  return {
    total: tasks.length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    inProgress: tasks.filter((task) => task.status === 'in-progress').length,
    todo: tasks.filter((task) => task.status === 'todo').length,
  }
}

function DocumentMarkdown({ content }: { content: string }) {
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let list: string[] = []
  let key = 0

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={`p-${key++}`}>{paragraph.join(' ')}</p>)
    paragraph = []
  }
  const flushList = () => {
    if (list.length) blocks.push(<ul key={`ul-${key++}`}>{list.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>)
    list = []
  }

  for (const line of content.split('\n')) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim())
    const item = /^-\s+(.+)$/.exec(line.trim())
    if (!line.trim()) {
      flushParagraph()
      flushList()
    } else if (heading) {
      flushParagraph()
      flushList()
      const level = heading[1].length
      const text = heading[2]
      if (level === 1) blocks.push(<h1 key={`h-${key++}`}>{text}</h1>)
      else if (level === 2) blocks.push(<h2 key={`h-${key++}`}>{text}</h2>)
      else blocks.push(<h3 key={`h-${key++}`}>{text}</h3>)
    } else if (item) {
      flushParagraph()
      list.push(item[1])
    } else {
      flushList()
      paragraph.push(line.trim())
    }
  }
  flushParagraph()
  flushList()

  return <div className="strategy-document-prose">{blocks}</div>
}