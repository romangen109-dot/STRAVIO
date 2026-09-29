import { Check, FileText } from 'lucide-react'
import type { StrategyData } from '../../types'

type Props = { strategy: StrategyData; onGenerateDocument: () => void }

export function StrategyCompleted({ strategy, onGenerateDocument }: Props) {
  return <section className="algorithm-completed workspace-panel">
    <span className="algorithm-completed-icon"><Check size={22} /></span>
    <span className="eyebrow">STRATEGY ALGORITHM · COMPLETE</span>
    <h2>Strategy Completed</h2>
    <p>Стратегия «{strategy.name}» сохранена. Этапы, варианты и контрольные условия готовы к использованию.</p>
    <button className="outline-button algorithm-primary" onClick={onGenerateDocument}><FileText size={14} /> Generate Strategy Document</button>
  </section>
}