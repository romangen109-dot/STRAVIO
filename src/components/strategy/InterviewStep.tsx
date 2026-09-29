import { useState } from 'react'
import type { InterviewQuestion } from '../../data/strategyAlgorithm'

type Props<T extends string> = {
  eyebrow: string
  title: string
  description: string
  questions: InterviewQuestion<T>[]
  answers: Record<T, string>
  onAnswer: (key: T, answer: string) => void
  onBack: () => void
  disableBack?: boolean
  onComplete: () => void
}

export function InterviewStep<T extends string>({ eyebrow, title, description, questions, answers, onAnswer, onBack, disableBack, onComplete }: Props<T>) {
  const [questionIndex, setQuestionIndex] = useState(0)
  const question = questions[questionIndex]
  const hasAnswer = answers[question.key].trim().length > 0
  const isLast = questionIndex === questions.length - 1

  const goBack = () => questionIndex > 0 ? setQuestionIndex((index) => index - 1) : onBack()
  const goNext = () => {
    if (!hasAnswer) return
    if (isLast) onComplete()
    else setQuestionIndex((index) => index + 1)
  }

  return <section className="algorithm-panel workspace-panel">
    <div className="algorithm-step-heading">
      <div><span className="eyebrow">{eyebrow} · {String(questionIndex + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}</span><h2>{title}</h2><p>{description}</p></div>
    </div>
    <div className="interview-question" key={question.key}>
      <label htmlFor="strategy-answer">{question.title}</label>
      <p>{question.explanation}</p>
      <textarea id="strategy-answer" value={answers[question.key]} onChange={(event) => onAnswer(question.key, event.target.value)} placeholder={question.placeholder} rows={8} autoFocus />
      <small className="required-hint">Ответьте, чтобы продолжить</small>
    </div>
    <div className="algorithm-navigation">
      <button className="outline-button" onClick={goBack} disabled={disableBack && questionIndex === 0}>Back</button>
      <button className="outline-button algorithm-primary" onClick={goNext} disabled={!hasAnswer}>Next</button>
    </div>
  </section>
}