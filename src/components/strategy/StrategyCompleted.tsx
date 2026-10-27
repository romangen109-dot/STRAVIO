import { useState } from 'react'
import { Check, FileText } from 'lucide-react'
import type { StrategyData } from '../../types'
import { useI18n } from '../../i18n'

type Props = { strategy: StrategyData; onGenerateDocument: () => Promise<boolean> }

export function StrategyCompleted({ strategy, onGenerateDocument }: Props) {
  const { t } = useI18n()
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    if (generating) return
    setGenerating(true)
    setError('')
    try {
      if (!await onGenerateDocument()) setError('The document was not created. Please check the connection and try again.')
    } catch {
      setError('The document was not created. Please check the connection and try again.')
    } finally {
      setGenerating(false)
    }
  }

  return <section className="algorithm-completed workspace-panel">
    <span className="algorithm-completed-icon"><Check size={22} /></span>
    <span className="eyebrow">{t('STRATEGY ALGORITHM · COMPLETE')}</span>
    <h2>{t('Strategy Completed')}</h2>
    <p>{t('Strategy “{name}” is saved. Its stages, options and control conditions are ready to use.', { name: strategy.name })}</p>
    {error && <p className="auth-error" role="alert">{t(error)}</p>}
    <button className="outline-button algorithm-primary" onClick={() => void generate()} disabled={generating}><FileText size={14} /> {generating ? t('Generating…') : t('Generate Strategy Document')}</button>
  </section>
}