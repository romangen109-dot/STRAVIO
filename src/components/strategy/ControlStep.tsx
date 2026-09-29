import { Plus, Trash2 } from 'lucide-react'
import type { StrategyControl, StrategyMetric } from '../../types'

type Props = { control: StrategyControl; onChange: (control: StrategyControl) => void; onBack: () => void; onComplete: () => void }

function createMetric(): StrategyMetric {
  return { id: `metric-${Date.now()}-${Math.random().toString(16).slice(2)}`, name: '', target: '', currentValue: '', reviewDate: '' }
}

export function ControlStep({ control, onChange, onBack, onComplete }: Props) {
  const updateMetric = (id: string, field: keyof Omit<StrategyMetric, 'id'>, value: string) => onChange({ ...control, metrics: control.metrics.map((metric) => metric.id === id ? { ...metric, [field]: value } : metric) })
  const updateText = (field: 'risks' | 'warningSigns' | 'reviewConditions', value: string) => onChange({ ...control, [field]: value })
  const ready = control.metrics.length > 0
    && control.metrics.every((metric) => metric.name.trim() && metric.target.trim() && metric.currentValue.trim() && metric.reviewDate)
    && control.risks.trim() && control.warningSigns.trim() && control.reviewConditions.trim()

  return <section className="algorithm-step">
    <div className="algorithm-step-heading"><div><span className="eyebrow">METRICS & LEARNING LOOP</span><h2>Control</h2><p>Определите сигналы, по которым команда будет следить за ходом стратегии и принимать решения.</p></div><button className="outline-button" onClick={() => onChange({ ...control, metrics: [...control.metrics, createMetric()] })}><Plus size={14} /> Add Metric</button></div>
    <div className="algorithm-metrics">{control.metrics.map((metric, index) => <article className="algorithm-metric workspace-panel" key={metric.id}>
      <div className="algorithm-stage-heading"><span className="stage-number">{String(index + 1).padStart(2, '0')}</span><strong>Metric {index + 1}</strong><button className="icon-button" onClick={() => onChange({ ...control, metrics: control.metrics.filter((item) => item.id !== metric.id) })} aria-label={`Delete metric ${index + 1}`} title="Delete metric"><Trash2 size={14} /></button></div>
      <div className="algorithm-metric-fields">
        <label className="algorithm-field">Metric *<input value={metric.name} onChange={(event) => updateMetric(metric.id, 'name', event.target.value)} placeholder="Например, конверсия в регистрацию" /></label>
        <label className="algorithm-field">Target *<input value={metric.target} onChange={(event) => updateMetric(metric.id, 'target', event.target.value)} placeholder="Целевое значение" /></label>
        <label className="algorithm-field">Current Value *<input value={metric.currentValue} onChange={(event) => updateMetric(metric.id, 'currentValue', event.target.value)} placeholder="Текущее значение" /></label>
        <label className="algorithm-field">Review Date *<input type="date" value={metric.reviewDate} onChange={(event) => updateMetric(metric.id, 'reviewDate', event.target.value)} /></label>
      </div>
    </article>)}</div>
    <div className="algorithm-control-fields">
      <label className="algorithm-field">Risks *<textarea rows={3} value={control.risks} onChange={(event) => updateText('risks', event.target.value)} placeholder="Риски, которые нужно отслеживать..." /></label>
      <label className="algorithm-field">Warning Signs *<textarea rows={3} value={control.warningSigns} onChange={(event) => updateText('warningSigns', event.target.value)} placeholder="Ранние признаки отклонения от плана..." /></label>
      <label className="algorithm-field">Review Conditions *<textarea rows={3} value={control.reviewConditions} onChange={(event) => updateText('reviewConditions', event.target.value)} placeholder="Условия, при которых стратегия пересматривается..." /></label>
    </div>
    <div className="algorithm-navigation"><button className="outline-button" onClick={onBack}>Back</button><button className="outline-button algorithm-primary" onClick={onComplete} disabled={!ready}>Complete Strategy</button></div>
  </section>
}