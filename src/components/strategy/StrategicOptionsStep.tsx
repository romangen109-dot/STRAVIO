import { Check, Sparkles } from 'lucide-react'
import type { StrategicOption } from '../../types'

type Props = { options: StrategicOption[]; selected: string[]; onToggle: (id: string) => void; onBack: () => void; onNext: () => void }

export function StrategicOptionsStep({ options, selected, onToggle, onBack, onNext }: Props) {
  return <section className="algorithm-step">
    <div className="algorithm-step-heading"><div><span className="eyebrow">MOCK GENERATOR · MULTI-SELECT</span><h2>Strategic Options</h2><p>Выберите один или несколько путей. Варианты можно комбинировать в следующих планах.</p></div><span className="algorithm-ai-note"><Sparkles size={13} /> AI DRAFT</span></div>
    <div className="algorithm-option-list">{options.map((option) => {
      const isSelected = selected.includes(option.id)
      return <button className={`algorithm-option workspace-panel ${isSelected ? 'is-selected' : ''}`} key={option.id} onClick={() => onToggle(option.id)} aria-pressed={isSelected}>
        <span className="algorithm-option-check">{isSelected && <Check size={13} />}</span>
        <span className="algorithm-option-body">
          <strong>{option.title}</strong><span>{option.description}</span>
          <span className="algorithm-option-details">
            <span><small>ADVANTAGES</small>{option.advantages.join(' · ')}</span>
            <span><small>RISKS</small>{option.risks.join(' · ')}</span>
            <span><small>REQUIRED RESOURCES</small>{option.requiredResources.join(' · ')}</span>
          </span>
        </span>
      </button>
    })}</div>
    <div className="algorithm-navigation"><button className="outline-button" onClick={onBack}>Back</button><button className="outline-button algorithm-primary" onClick={onNext} disabled={!selected.length}>Next</button></div>
  </section>
}