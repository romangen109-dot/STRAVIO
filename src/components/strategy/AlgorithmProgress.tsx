const steps = ['Current State', 'Desired State', 'Strategic Options', 'Plans', 'Stage Plans', 'Control']

type Props = { activeStep: number; completed: boolean; onSelectStep: (step: number) => void }

export function AlgorithmProgress({ activeStep, completed, onSelectStep }: Props) {
  return <div className="strategy-progress-wrap algorithm-progress-wrap">
    <div className="section-kicker"><span>STRATEGY ALGORITHM</span><span className="framework-version">{completed ? 'COMPLETED' : `STEP 0${activeStep + 1} / 06`} <i /></span></div>
    <div className="strategy-progress algorithm-progress" role="list" aria-label="Strategy Algorithm progress">
      {steps.map((step, index) => {
        const isComplete = completed || index < activeStep
        const isActive = index === activeStep
        return <button
          className={`progress-step ${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''}`}
          key={step}
          onClick={() => index <= activeStep && onSelectStep(index)}
          disabled={index > activeStep || completed}
          aria-current={isActive ? 'step' : undefined}
          role="listitem"
        >
          <span className="progress-icon">{String(index + 1).padStart(2, '0')}</span>
          <span className="progress-label"><small>{String(index + 1).padStart(2, '0')}</small><strong>{step}</strong></span>
          {index < steps.length - 1 && <span className="progress-connector" />}
        </button>
      })}
    </div>
  </div>
}