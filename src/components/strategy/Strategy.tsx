import { ChevronRight, Clock3, Layers3 } from 'lucide-react'
import { currentStateQuestions, desiredStateQuestions } from '../../data/strategyAlgorithm'
import type { CurrentStateAnswers, DesiredStateAnswers, StrategyData, StrategyPlan, StrategyStagePlan } from '../../types'
import { AlgorithmProgress } from './AlgorithmProgress'
import { ControlStep } from './ControlStep'
import { InterviewStep } from './InterviewStep'
import { PlansStep } from './PlansStep'
import { StagePlansStep } from './StagePlansStep'
import { StrategyCompleted } from './StrategyCompleted'
import { StrategicOptionsStep } from './StrategicOptionsStep'
import { useStrategy } from './useStrategy'
import { useI18n } from '../../i18n'

type Props = { onGenerateDocument: (strategy: StrategyData) => Promise<boolean>; onAskAI: (prompt: string) => void }

export function Strategy({ onGenerateDocument, onAskAI }: Props) {
  const { t } = useI18n()
  const { strategy, strategies, updateStrategy, chooseStrategy, createNewStrategy, deleteCurrentStrategy, loading, loadError, saveState, error } = useStrategy()
  const setStep = (workflowStep: number) => updateStrategy((current) => ({ ...current, workflowStep }))

  const setCurrentAnswer = (key: keyof CurrentStateAnswers, answer: string) => updateStrategy((current) => ({ ...current, currentState: { ...current.currentState, [key]: answer } }))
  const setDesiredAnswer = (key: keyof DesiredStateAnswers, answer: string) => updateStrategy((current) => ({ ...current, desiredState: { ...current.desiredState, [key]: answer } }))
  const setPlanField = (plan: 'A' | 'B', field: keyof StrategyPlan, value: string) => updateStrategy((current) => ({ ...current, plans: { ...current.plans, [plan]: { ...current.plans[plan], [field]: value } } }))
  const addOption = (option: StrategyData['strategicOptions'][number]) => updateStrategy((current) => ({ ...current, strategicOptions: [...current.strategicOptions, option] }))
  const updateOption = (id: string, changes: Partial<StrategyData['strategicOptions'][number]>) => updateStrategy((current) => ({ ...current, strategicOptions: current.strategicOptions.map((option) => option.id === id ? { ...option, ...changes } : option) }))
  const deleteOption = (id: string) => updateStrategy((current) => ({ ...current, strategicOptions: current.strategicOptions.filter((option) => option.id !== id), selectedOptionIds: current.selectedOptionIds.filter((selectedId) => selectedId !== id) }))
  const updateStage = (id: string, field: keyof StrategyStagePlan, value: string) => updateStrategy((current) => ({ ...current, stages: current.stages.map((stage) => stage.id === id ? { ...stage, [field]: value } : stage) }))
  const addStage = () => updateStrategy((current) => ({ ...current, stages: [...current.stages, { id: `stage-${Date.now()}-${Math.random().toString(16).slice(2)}`, title: '', objective: '', actions: '', expectedResult: '', dependencies: '' }] }))
  const deleteStage = (id: string) => updateStrategy((current) => ({ ...current, stages: current.stages.filter((stage) => stage.id !== id) }))
  const finishControl = () => updateStrategy((current) => ({ ...current, completed: true, workflowStep: 5 }))

  if (loading) return <div className="strategy-page"><section className="workspace-panel algorithm-completed" aria-live="polite">{t('Loading strategy…')}</section></div>
  if (loadError) return <div className="strategy-page"><section className="workspace-panel algorithm-completed" role="alert"><h2>{t('Strategy could not be loaded.')}</h2><p>{t(loadError)}</p><button className="outline-button" onClick={() => window.location.reload()}>{t('Reload workspace')}</button></section></div>

  return <div className="strategy-page">
    <header className="project-page-header">
      <div className="page-crumb"><span>{t('PROJECT')}</span><ChevronRight size={12} /><span>{t('STRATEGY')}</span></div>
      <div className="project-title-row">
        <div className="strategy-project-icon"><Layers3 size={19} /></div>
        <div className="project-title-copy"><label className="eyebrow" htmlFor="strategy-name">{t('STRATEGY NAME')}</label><input id="strategy-name" className="strategy-name-input" required maxLength={120} value={strategy.name} onChange={(event) => updateStrategy((current) => ({ ...current, name: event.target.value || 'Untitled Strategy' }))} /><p>{strategy.description || t('Build a strategy from your current state, goals and available options.')}</p></div>
        <div className="project-header-meta"><button className="outline-button" onClick={() => onAskAI('Help me answer the current Strategy Algorithm step.')}>{t('Ask AI')}</button><span className="status-pill"><i /> {t(strategy.completed ? 'Strategy completed' : 'In progress')}</span><span className="updated-label"><Clock3 size={12} /> {t(saveState === 'saving' ? 'Saving in browser…' : saveState === 'saved' ? 'Saved in browser' : saveState === 'error' ? 'Not saved' : 'Browser save pending')}</span></div>
      </div>
      <div className="strategy-library-actions">
        <label className="strategy-selector-label" htmlFor="strategy-selector">{t('STRATEGY LIBRARY')}</label>
        <select id="strategy-selector" value={strategies.some((entry) => entry.id === strategy.id) ? strategy.id : ''} onChange={(event) => chooseStrategy(event.target.value)} disabled={!strategies.length} aria-label={t('Select active strategy')}>
          {strategies.length ? strategies.map((entry) => <option value={entry.id} key={entry.id}>{entry.name || t('Untitled Strategy')}</option>) : <option value="">{t('No saved strategies')}</option>}
        </select>
        <button className="outline-button" onClick={() => void createNewStrategy()} disabled={saveState === 'saving'}>{t('New Strategy')}</button>
        <button className="outline-button planning-delete" onClick={() => {
          if (window.confirm(t('Delete “{name}”? Its linked documents, tasks and AI history will also be permanently deleted.', { name: strategy.name || t('Untitled Strategy') }))) void deleteCurrentStrategy()
        }} disabled={!strategies.some((entry) => entry.id === strategy.id) || saveState === 'saving'}>{t('Delete')}</button>
      </div>
    </header>
    {error && <div className="auth-error" role="alert">{t('Could not save strategy: {error}', { error })}</div>}
    <AlgorithmProgress activeStep={strategy.workflowStep} completed={strategy.completed} onSelectStep={setStep} />
    <div className="strategy-content algorithm-content">
      {strategy.completed ? <StrategyCompleted strategy={strategy} onGenerateDocument={() => onGenerateDocument(strategy)} /> : strategy.workflowStep === 0 ? <InterviewStep
        key="current-state"
        eyebrow="01 · CURRENT STATE"
        title="Current State"
        description="Соберите исходные данные, прежде чем выбирать направление действий."
        questions={currentStateQuestions}
        answers={strategy.currentState}
        onAnswer={setCurrentAnswer}
        onBack={() => {}}
        disableBack
        onComplete={() => setStep(1)}
      /> : strategy.workflowStep === 1 ? <InterviewStep
        key="desired-state"
        eyebrow="02 · DESIRED STATE"
        title="Desired State"
        description="Сформулируйте, куда должна привести стратегия и как будет распознан успех."
        questions={desiredStateQuestions}
        answers={strategy.desiredState}
        onAnswer={setDesiredAnswer}
        onBack={() => setStep(0)}
        onComplete={() => setStep(2)}
      /> : strategy.workflowStep === 2 ? <StrategicOptionsStep
        options={strategy.strategicOptions}
        selected={strategy.selectedOptionIds}
        onAdd={addOption}
        onUpdate={updateOption}
        onDelete={deleteOption}
        onToggle={(id) => updateStrategy((current) => ({ ...current, selectedOptionIds: current.selectedOptionIds.includes(id) ? current.selectedOptionIds.filter((selectedId) => selectedId !== id) : [...current.selectedOptionIds, id] }))}
        onBack={() => setStep(1)}
        onNext={() => setStep(3)}
      /> : strategy.workflowStep === 3 ? <PlansStep plans={strategy.plans} onChange={setPlanField} onBack={() => setStep(2)} onNext={() => setStep(4)} /> : strategy.workflowStep === 4 ? <StagePlansStep
        stages={strategy.stages}
        onChange={updateStage}
        onAdd={addStage}
        onDelete={deleteStage}
        onBack={() => setStep(3)}
        onNext={() => setStep(5)}
      /> : <ControlStep control={strategy.control} onChange={(control) => updateStrategy((current) => ({ ...current, control }))} onBack={() => setStep(4)} onComplete={finishControl} />}
    </div>
  </div>
}