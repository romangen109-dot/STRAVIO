import { Plus, Trash2 } from 'lucide-react'
import type { StrategyStagePlan } from '../../types'

type Props = { stages: StrategyStagePlan[]; onChange: (id: string, field: keyof StrategyStagePlan, value: string) => void; onAdd: () => void; onDelete: (id: string) => void; onBack: () => void; onNext: () => void }

const fields: { key: keyof Omit<StrategyStagePlan, 'id'>; label: string; rows: number; required?: boolean }[] = [
  { key: 'title', label: 'Title', rows: 1, required: true },
  { key: 'objective', label: 'Objective', rows: 2, required: true },
  { key: 'actions', label: 'Actions', rows: 3, required: true },
  { key: 'expectedResult', label: 'Expected Result', rows: 2, required: true },
  { key: 'dependencies', label: 'Dependencies', rows: 2 },
]

export function StagePlansStep({ stages, onChange, onAdd, onDelete, onBack, onNext }: Props) {
  const ready = stages.length > 0 && stages.every((stage) => fields.filter((field) => field.required).every((field) => stage[field.key].trim()))
  return <section className="algorithm-step">
    <div className="algorithm-step-heading"><div><span className="eyebrow">SEQUENCE & DEPENDENCIES</span><h2>Stage Plans</h2><p>Разложите план на управляемые этапы. Поля каждого этапа доступны для редактирования.</p></div><button className="outline-button" onClick={onAdd}><Plus size={14} /> Add Stage</button></div>
    {stages.length === 0 && <div className="algorithm-empty workspace-panel">Этапов пока нет. Добавьте первый этап, чтобы описать последовательность выполнения.</div>}
    <div className="algorithm-stage-list">{stages.map((stage, index) => <article className="algorithm-stage workspace-panel" key={stage.id}>
      <div className="algorithm-stage-heading"><span className="stage-number">{String(index + 1).padStart(2, '0')}</span><strong>Stage {index + 1}</strong><button className="icon-button" onClick={() => onDelete(stage.id)} aria-label={`Delete Stage ${index + 1}`} title="Delete stage"><Trash2 size={14} /></button></div>
      <div className="algorithm-stage-fields">{fields.map((field) => <label className="algorithm-field" key={field.key}>{field.label}{field.required && <span aria-hidden="true"> *</span>}{field.key === 'title' ? <input value={stage[field.key]} onChange={(event) => onChange(stage.id, field.key, event.target.value)} placeholder="Название этапа" /> : <textarea rows={field.rows} value={stage[field.key]} onChange={(event) => onChange(stage.id, field.key, event.target.value)} placeholder={`${field.label}...`} />}</label>)}</div>
    </article>)}</div>
    <div className="algorithm-navigation"><button className="outline-button" onClick={onBack}>Back</button><button className="outline-button algorithm-primary" onClick={onNext} disabled={!ready}>Next</button></div>
  </section>
}