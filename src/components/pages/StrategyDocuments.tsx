import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Copy, FileText, Pencil, Save, Trash2 } from 'lucide-react'
import type { PlanningTask, StrategyData, StrategyDocument } from '../../types'
import { usePlanningTasks } from '../planning/usePlanningTasks'
import { useI18n } from '../../i18n'

type Props = {
  documents: StrategyDocument[]
  selectedDocumentId?: string
  onCreate: () => void
  onOpen: (document: StrategyDocument) => void
  onSave: (id: string, content: string) => Promise<boolean>
  onSaveDraft: (id: string, content: string) => Promise<boolean>
  onDiscardDraft: (id: string) => Promise<boolean>
  onRename: (id: string, title: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onDuplicate: (document: StrategyDocument) => Promise<boolean>
  onBack: () => void
  onOpenPlanning: (strategy: StrategyData) => void
  onAskAI: (prompt: string, documentContext?: { id: string; title: string; content: string }) => void
}

export function StrategyDocuments({ documents, selectedDocumentId, onCreate, onOpen, onSave, onSaveDraft, onDiscardDraft, onRename, onDelete, onDuplicate, onBack, onOpenPlanning, onAskAI }: Props) {
  const { t, formatDate } = useI18n()
  const { tasks } = usePlanningTasks()
  const selected = documents.find((document) => document.id === selectedDocumentId)
  const documentTasks = selected ? tasks.filter((task) => task.strategyId === selected.strategy.id) : []
  const executionCounts = countExecutionTasks(documentTasks)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [renameError, setRenameError] = useState('')
  const [actionId, setActionId] = useState('')
  const [actionError, setActionError] = useState('')
  const draftSaveSequence = useRef(0)

  useEffect(() => {
    draftSaveSequence.current += 1
    setEditing(false)
    setDraft(selected?.draftContent ?? '')
    setTitleDraft(selected?.title ?? '')
    setRenameError('')
  }, [selectedDocumentId, selected?.title])

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
    const document = documents.find((item) => item.id === id)
    if (!window.confirm(t('Delete “{title}”? This action cannot be undone.', { title: document?.title ?? t('this document') }))) return
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
    <div className="page-crumb"><span>{t('WORKSPACE')}</span><span>›</span><span>{t('DOCUMENTS').toUpperCase()}</span></div>
    <div className="secondary-heading"><div><span className="eyebrow">{t('DOCUMENT LIBRARY')} <i /> {String(documents.length).padStart(2, '0')} {t('DOCUMENTS').toUpperCase()}</span><h1>{t('Documents')}</h1><p>{t('Write strategy briefs, working papers and plans linked to your strategy.')}</p></div><button className="outline-button algorithm-primary" onClick={onCreate}>{t('Create document')}</button></div>
    {documents.length ? <div className="strategy-document-list">{documents.map((document) => <article className="strategy-document-row" key={document.id}>
      <span className="strategy-document-icon"><FileText size={17} /></span>
      <div className="strategy-document-summary"><strong>{document.title}</strong><span>{t('Created {date}', { date: formatDate(document.createdAt) })}</span></div>
      <span className={`strategy-document-status ${document.status}`}>{t(document.status === 'edited' ? 'EDITED' : 'READY')}</span>
      <button className="outline-button strategy-document-open" onClick={() => onOpen(document)}>{t('Open')}</button>
      <button className="icon-button strategy-document-action" onClick={() => void duplicate(document)} aria-label={t('Duplicate {title}', { title: document.title })} title={t('Duplicate')} disabled={Boolean(actionId)}><Copy size={14} /></button>
      <button className="icon-button strategy-document-action delete" onClick={() => void remove(document.id)} aria-label={t(actionId === document.id ? 'Deleting {title}' : 'Delete {title}', { title: document.title })} title={t(actionId === document.id ? 'Deleting…' : 'Delete')} disabled={Boolean(actionId)}><Trash2 size={14} /></button>
    </article>)}</div> : <div className="strategy-documents-empty workspace-panel"><span className="strategy-document-icon"><FileText size={18} /></span><h2>{t('No documents yet')}</h2><p>{t('Create a working document or generate a strategy brief from your saved answers.')}</p><button className="outline-button algorithm-primary" onClick={onCreate}>{t('Create your first document')}</button></div>}
    {actionError && <div className="auth-error" role="alert">{t(actionError)}</div>}
  </div>

  const startEditing = () => {
    setDraft(selected.draftContent ?? selected.content)
    setEditing(true)
  }

  const cancelEditing = async () => {
    draftSaveSequence.current += 1
    setSaving(true)
    setSaveError('')
    const discarded = await onDiscardDraft(selected.id)
    setSaving(false)
    if (discarded) {
      setDraft(selected.content)
      setEditing(false)
    } else {
      setSaveError('Draft was not discarded. Please try again.')
    }
  }

  const changeDraft = (content: string) => {
    setDraft(content)
    setSaveError('')
    const sequence = ++draftSaveSequence.current
    void onSaveDraft(selected.id, content).then((saved) => {
      if (sequence !== draftSaveSequence.current) return
      if (!saved) setSaveError('Draft was not saved. Your changes remain available until you leave this page.')
      else setSaveError('')
    })
  }

  const save = async () => {
    draftSaveSequence.current += 1
    setSaving(true)
    setSaveError('')
    const saved = await onSave(selected.id, draft)
    setSaving(false)
    if (saved) setEditing(false)
    else setSaveError('Document was not saved. Your draft is still available here.')
  }

  const rename = async () => {
    if (!selected || !titleDraft.trim() || titleDraft.trim() === selected.title || renaming) return
    setRenaming(true)
    setRenameError('')
    try {
      if (!await onRename(selected.id, titleDraft.trim())) setRenameError('Document title was not saved. Please try again.')
    } catch {
      setRenameError('Document title was not saved. Please try again.')
    } finally {
      setRenaming(false)
    }
  }

  return <div className="secondary-page strategy-document-editor-page">
    <div className="page-crumb"><span>{t('PROJECT')}</span><span>›</span><button onClick={onBack}>{t('STRATEGY DOCUMENTS')}</button><span>›</span><span>{t('DOCUMENT')}</span></div>
    {(saveError || renameError || actionError) && <div className="auth-error" role="alert">{t(saveError || renameError || actionError)}</div>}
    <div className="strategy-document-toolbar"><div className="document-toolbar-title"><span className="strategy-document-icon"><FileText size={16} /></span><div><input className="document-title-input" aria-label={t('Document title')} maxLength={200} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void rename() }} /><small>{saving ? t('Saving in browser…') : editing ? t('Unsaved changes') : t('Last saved {date}', { date: formatDate(selected.updatedAt) })}</small></div><button className="outline-button" onClick={() => void rename()} disabled={renaming || !titleDraft.trim() || titleDraft.trim() === selected.title}>{renaming ? t('Renaming…') : t('Save title')}</button></div><div className="document-toolbar-actions">
      <button className="outline-button" onClick={() => onOpenPlanning(selected.strategy)}>{t('Open Planning')}</button>
      <button className="outline-button" onClick={() => onAskAI('Analyze this strategy document for gaps and risks.', { id: selected.id, title: selected.title, content: editing ? draft : selected.content })}>{t('Analyze this strategy')}</button>
      <button className="outline-button" onClick={() => void duplicate(selected)} disabled={Boolean(actionId) || saving}><Copy size={13} /> {actionId === selected.id ? t('Duplicating…') : t('Duplicate')}</button>
      {editing ? <><button className="outline-button" onClick={() => void cancelEditing()} disabled={saving}>{t('Cancel')}</button><button className="outline-button algorithm-primary" onClick={() => void save()} disabled={saving}><Save size={13} /> {saving ? t('Saving…') : t('Save')}</button></> : <button className="outline-button" onClick={startEditing}><Pencil size={13} /> {t('Edit')}</button>}
      <button className="icon-button strategy-document-action delete" onClick={() => void remove(selected.id)} aria-label={t(actionId === selected.id ? 'Deleting strategy document' : 'Delete strategy document')} title={t(actionId === selected.id ? 'Deleting…' : 'Delete')} disabled={Boolean(actionId) || saving}><Trash2 size={14} /></button>
    </div></div>
    <div className="strategy-document-meta"><span className={`strategy-document-status ${selected.status}`}>{t(selected.status === 'edited' ? 'EDITED' : 'READY')}</span><span>{t('Created {date}', { date: formatDate(selected.createdAt) })}</span><span>{t('Strategy Algorithm snapshot')}</span></div>
    <section className="strategy-execution workspace-panel"><div><span className="eyebrow">{t('EXECUTION')}</span><h2>{t('Planning')}</h2></div><div className="strategy-execution-counts"><span><small>{t('TOTAL TASKS')}</small><strong>{executionCounts.total}</strong></span><span><small>{t('COMPLETED')}</small><strong>{executionCounts.completed}</strong></span><span><small>{t('IN PROGRESS')}</small><strong>{executionCounts.inProgress}</strong></span><span><small>{t('TO DO')}</small><strong>{executionCounts.todo}</strong></span></div><button className="subtle-link" onClick={() => onOpenPlanning(selected.strategy)}>{t('Open Planning')} <span aria-hidden="true">→</span></button></section>
    {editing ? <div className="strategy-document-edit workspace-panel"><label htmlFor="strategy-document-content">{t('Document content')}</label><textarea id="strategy-document-content" value={draft} onChange={(event) => changeDraft(event.target.value)} spellCheck /></div> : <article className="strategy-document-paper workspace-panel"><DocumentMarkdown content={selected.content} /></article>}
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