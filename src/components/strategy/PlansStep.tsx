import type { StrategyPlan } from '../../types'

type PlanId = 'A' | 'B'
type Props = { plans: Record<PlanId, StrategyPlan>; onChange: (plan: PlanId, field: keyof StrategyPlan, value: string) => void; onBack: () => void; onNext: () => void }

const fields: { key: keyof StrategyPlan; label: string; rows: number; required?: boolean }[] = [
  { key: 'objective', label: 'Objective', rows: 2, required: true },
  { key: 'approach', label: 'Approach', rows: 3, required: true },
  { key: 'keyActions', label: 'Key Actions', rows: 4, required: true },
  { key: 'risks', label: 'Risks', rows: 2 },
  { key: 'resources', label: 'Resources', rows: 2 },
]

export function PlansStep({ plans, onChange, onBack, onNext }: Props) {
  const ready = (['A', 'B'] as const).every((plan) => fields.filter((field) => field.required).every((field) => plans[plan][field.key].trim()))
  return <section className="algorithm-step">
    <div className="algorithm-step-heading"><div><span className="eyebrow">PRIMARY & ALTERNATIVE SCENARIO</span><h2>Plans</h2><p>Опишите основное направление и альтернативу, которую можно активировать при изменении условий.</p></div></div>
    <div className="algorithm-plans">{(['A', 'B'] as const).map((plan) => <article className="algorithm-plan workspace-panel" key={plan}>
      <div className="algorithm-plan-heading"><span className="stage-number">{plan}</span><div><small>STRATEGY PLAN</small><h3>Plan {plan}{plan === 'A' ? ' · Основной' : ' · Альтернативный'}</h3></div></div>
      {fields.map((field) => <label className="algorithm-field" key={field.key}>{field.label}{field.required && <span aria-hidden="true"> *</span>}<textarea rows={field.rows} value={plans[plan][field.key]} onChange={(event) => onChange(plan, field.key, event.target.value)} placeholder={`${field.label} для Plan ${plan}...`} /></label>)}
    </article>)}</div>
    <div className="algorithm-navigation"><button className="outline-button" onClick={onBack}>Back</button><button className="outline-button algorithm-primary" onClick={onNext} disabled={!ready}>Next</button></div>
  </section>
}