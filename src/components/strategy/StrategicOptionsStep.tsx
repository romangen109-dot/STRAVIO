import { Check, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { StrategicOption } from '../../types'

type OptionChanges = Partial<Pick<StrategicOption, 'title' | 'description' | 'advantages' | 'risks' | 'requiredResources'>>
type Props = { options: StrategicOption[]; selected: string[]; onToggle: (id: string) => void; onAdd: (option: StrategicOption) => void; onUpdate: (id: string, changes: OptionChanges) => void; onDelete: (id: string) => void; onBack: () => void; onNext: () => void }

export function StrategicOptionsStep({ options, selected, onToggle, onAdd, onUpdate, onDelete, onBack, onNext }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [advantages, setAdvantages] = useState('')
  const [risks, setRisks] = useState('')
  const [requiredResources, setRequiredResources] = useState('')
  const [optionListDrafts, setOptionListDrafts] = useState<Record<string, { advantages: string; risks: string; requiredResources: string }>>({})

  const addOption = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) return
    const list = (value: string) => value.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
    onAdd({
      id: globalThis.crypto?.randomUUID?.() ?? `option-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      advantages: list(advantages),
      risks: list(risks),
      requiredResources: list(requiredResources),
    })
    setTitle('')
    setDescription('')
    setAdvantages('')
    setRisks('')
    setRequiredResources('')
  }

  return <section className="algorithm-step">
    <div className="algorithm-step-heading"><div><span className="eyebrow">ALTERNATIVES · MULTI-SELECT</span><h2>Strategic Options</h2><p>Добавьте возможные пути и сравните их преимущества, риски и необходимые ресурсы.</p></div><span className="algorithm-ai-note"><Sparkles size={13} /> USER-DEFINED</span></div>
    <form className="algorithm-option-form workspace-panel" onSubmit={addOption}>
      <label className="planning-field">Option title<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Name a possible approach" /></label>
      <label className="planning-field">Description<textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe how this option could reach the desired state" /></label>
      <div className="algorithm-option-input-grid">
        <label className="planning-field">Advantages<textarea rows={2} value={advantages} onChange={(event) => setAdvantages(event.target.value)} placeholder="Separate items with commas or new lines" /></label>
        <label className="planning-field">Risks<textarea rows={2} value={risks} onChange={(event) => setRisks(event.target.value)} placeholder="Separate items with commas or new lines" /></label>
        <label className="planning-field">Required resources<textarea rows={2} value={requiredResources} onChange={(event) => setRequiredResources(event.target.value)} placeholder="Separate items with commas or new lines" /></label>
      </div>
      <button className="outline-button algorithm-primary" type="submit"><Plus size={14} /> Add option</button>
    </form>
    {options.length === 0 && <div className="planning-empty-task workspace-panel"><p>No strategic options yet. Add alternatives based on your situation and desired state.</p></div>}
    <div className="algorithm-option-list">{options.map((option) => {
      const isSelected = selected.includes(option.id)
      return <article className={`algorithm-option workspace-panel ${isSelected ? 'is-selected' : ''}`} key={option.id}>
        <button className="algorithm-option-select" onClick={() => onToggle(option.id)} aria-pressed={isSelected}>
          <span className="algorithm-option-check">{isSelected && <Check size={13} />}</span>
          <span className="algorithm-option-body"><strong>{option.title}</strong><span>{option.description || 'No description provided.'}</span></span>
        </button>
        <button className="icon-button planning-delete" onClick={() => onDelete(option.id)} aria-label={`Delete ${option.title}`} title="Delete option"><Trash2 size={14} /></button>
        <div className="algorithm-option-edit-fields">
          <label className="planning-field">Title<input required maxLength={160} value={option.title} onChange={(event) => onUpdate(option.id, { title: event.target.value })} /></label>
          <label className="planning-field">Description<textarea rows={2} value={option.description} onChange={(event) => onUpdate(option.id, { description: event.target.value })} /></label>
          <div className="algorithm-option-input-grid">
            <label className="planning-field">Advantages<textarea rows={2} value={optionListDrafts[option.id]?.advantages ?? option.advantages.join('\n')} onChange={(event) => setOptionListDrafts((current) => ({ ...current, [option.id]: { advantages: event.target.value, risks: current[option.id]?.risks ?? option.risks.join('\n'), requiredResources: current[option.id]?.requiredResources ?? option.requiredResources.join('\n') } }))} onBlur={(event) => onUpdate(option.id, { advantages: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label>
            <label className="planning-field">Risks<textarea rows={2} value={optionListDrafts[option.id]?.risks ?? option.risks.join('\n')} onChange={(event) => setOptionListDrafts((current) => ({ ...current, [option.id]: { advantages: current[option.id]?.advantages ?? option.advantages.join('\n'), risks: event.target.value, requiredResources: current[option.id]?.requiredResources ?? option.requiredResources.join('\n') } }))} onBlur={(event) => onUpdate(option.id, { risks: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label>
            <label className="planning-field">Required resources<textarea rows={2} value={optionListDrafts[option.id]?.requiredResources ?? option.requiredResources.join('\n')} onChange={(event) => setOptionListDrafts((current) => ({ ...current, [option.id]: { advantages: current[option.id]?.advantages ?? option.advantages.join('\n'), risks: current[option.id]?.risks ?? option.risks.join('\n'), requiredResources: event.target.value } }))} onBlur={(event) => onUpdate(option.id, { requiredResources: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label>
          </div>
        </div>
      </article>
    })}</div>
    <div className="algorithm-navigation"><button className="outline-button" onClick={onBack}>Back</button><button className="outline-button algorithm-primary" onClick={onNext} disabled={!selected.length}>Next</button></div>
  </section>
}