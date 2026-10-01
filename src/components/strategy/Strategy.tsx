import { ChevronRight, Clock3, Layers3 } from 'lucide-react'
import { project } from '../../data/mockProject'
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

type Props = { onGenerateDocument: (strategy: StrategyData) => void; onAskAI: (prompt: string) => void }

export function Strategy({ onGenerateDocument, onAskAI }: Props) {
  const { strategy, updateStrategy, saveState, error } = useStrategy()
  const setStep = (workflowStep: number) => updateStrategy((current) => ({ ...current, workflowStep }))

  const setCurrentAnswer = (key: keyof CurrentStateAnswers, answer: string) => updateStrategy((current) => ({ ...current, currentState: { ...current.currentState, [key]: answer } }))
  const setDesiredAnswer = (key: keyof DesiredStateAnswers, answer: string) => updateStrategy((current) => ({ ...current, desiredState: { ...current.desiredState, [key]: answer } }))
  const setPlanField = (plan: 'A' | 'B', field: keyof StrategyPlan, value: string) => updateStrategy((current) => ({ ...current, plans: { ...current.plans, [plan]: { ...current.plans[plan], [field]: value } } }))
  const updateStage = (id: string, field: keyof StrategyStagePlan, value: string) => updateStrategy((current) => ({ ...current, stages: current.stages.map((stage) => stage.id === id ? { ...stage, [field]: value } : stage) }))
  const addStage = () => updateStrategy((current) => ({ ...current, stages: [...current.stages, { id: `stage-${Date.now()}-${Math.random().toString(16).slice(2)}`, title: '', objective: '', actions: '', expectedResult: '', dependencies: '' }] }))
  const deleteStage = (id: string) => updateStrategy((current) => ({ ...current, stages: current.stages.filter((stage) => stage.id !== id) }))
  const finishControl = () => updateStrategy((current) => ({ ...current, completed: true, workflowStep: 5 }))

  return <div className="strategy-page">
    <header className="project-page-header">
      <div className="page-crumb"><span>PROJECT</span><ChevronRight size={12} /><span>STRATEGY</span></div>
      <div className="project-title-row">
        <div className="strategy-project-icon"><Layers3 size={19} /></div>
        <div className="project-title-copy"><h1>{strategy.name || project.name}</h1><p>{strategy.description || project.description}</p></div>
        <div className="project-header-meta"><button className="outline-button" onClick={() => onAskAI('Help me answer the current Strategy Algorithm step.')}>Ask AI</button><span className="status-pill"><i /> {strategy.completed ? 'Strategy completed' : project.status}</span><span className="updated-label"><Clock3 size={12} /> {saveState === 'saving' ? 'Saving to cloud…' : saveState === 'saved' ? 'Saved to cloud' : saveState === 'error' ? 'Not saved' : 'Cloud save pending'}</span></div>
      </div>
    </header>
    {error && <div className="auth-error" role="alert">Could not save strategy: {error}</div>}
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