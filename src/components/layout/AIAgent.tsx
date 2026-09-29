importimport { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Command, Cpu, FileText, MoreHorizontal, PanelRightClose, Sparkles } from 'lucide-react'
import { suggestedActions } from '../../data/mockStrategy'
import type { AgentJob } from '../../types'
import { ChatInput } from '../ai/ChatInput'

type Props = { onClose: () => void }
type ChatMessage = { role: 'user' | 'agent'; text: string }

const actionSteps = ['Изучаю контекст проекта', 'Анализирую ресурсы и ограничения', 'Сверяю сигналы стратегии', 'Подготавливаю результат']

export function AIAgent({ onClose }: Props) {
  const [job, setJob] = useState<AgentJob | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const jobId = useRef(0)
  const lastChatResult = useRef(0)
  const conversationEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!job || job.status === 'completed') return
    const timer = window.setTimeout(() => {
      setJob((current) => current ? { ...current, status: current.status === 'thinking' ? 'analyzing' : 'completed' } : null)
    }, job.status === 'thinking' ? 500 : 1450)
    return () => window.clearTimeout(timer)
  }, [job])

  useEffect(() => {
    if (!job || job.status !== 'completed' || job.source !== 'chat' || lastChatResult.current === job.id) return
    lastChatResult.current = job.id
    setMessages((current) => [...current, { role: 'agent', text: job.result }])
  }, [job])

  useEffect(() => { conversationEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [job, messages])

  const runAction = (title: string, result: string, source: AgentJob['source'] = 'action') => {
    setJob({ id: ++jobId.current, title, result, status: 'thinking', source })
  }

  const ask = (message: string) => {
    setMessages((current) => [...current, { role: 'user', text: message }])
    const lower = message.toLowerCase()
    const response = lower.includes('риск') || lower.includes('противореч')
      ? 'В текущем контексте вижу один заметный риск: масштабирование библиотеки до подтверждения спроса. Ранний пилот и интервью помогут проверить гипотезу с меньшими затратами.'
      : lower.includes('план') || lower.includes('дальше')
        ? 'Следующий практический шаг — завершить 15 интервью и зафиксировать повторяющиеся потребности. После этого проверьте предложение через страницу ожидания и выберите метрики пилота.'
        : `По контексту проекта «Tech Education Platform»: ${message.endsWith('?') ? 'этот вопрос лучше проверить через короткий эксперимент с целевой аудиторией. Сейчас наиболее полезно зафиксировать гипотезу, сигнал успеха и срок проверки.' : 'могу помочь проверить эту идею. Сопоставьте её с текущей гипотезой целевого сегмента и запланированными интервью.'}`
    runAction('Ответ на вопрос', response, 'chat')
  }

  const phase = job?.status === 'thinking' ? 0 : job?.status === 'analyzing' ? 2 : 4

  return <aside className="agent-panel">
    <div className="agent-header"><div className="agent-title-mark"><Sparkles size={15} /></div><div className="agent-header-copy"><strong>AI Agent</strong><span className="beta-pill">BETA</span></div><button className="icon-button agent-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Меню AI-агента"><MoreHorizontal size={16} /></button><button className="icon-button agent-close-button" onClick={onClose} aria-label="Скрыть AI-агента"><PanelRightClose size={16} /></button>
      {menuOpen && <div className="agent-menu"><button onClick={() => { setJob(null); setMessages([]); setMenuOpen(false) }}>Очистить сессию</button><button onClick={() => setMenuOpen(false)}>Настроить контекст</button></div>}
    </div>
    <div className="agent-context"><span className="context-signal" /><span>PROJECT CONTEXT</span><span className="context-divider" /><FileText size={12} /><span>Tech Education Platform</span><ChevronDown size={12} /></div>
    <div className="agent-scroll-area">
      <div className="agent-intro"><div className="agent-orb"><Sparkles size={17} /></div><span className="eyebrow">STRAVIO INTELLIGENCE <i /> READY</span><h2>Привет! Я AI-агент Stravio.</h2><p>Я работаю внутри контекста проекта: анализирую стратегию, помогаю исследовать рынок и превращаю решения в план действий.</p><div className="agent-model-note"><Cpu size={12} /> PROJECT-AWARE AGENT <span>·</span> MOCK MODE</div></div>

      <div className="agent-actions-block"><div className="agent-section-label"><span>ЧЕМ МОГУ ПОМОЧЬ</span><span>06</span></div><div className="agent-action-list">{suggestedActions.map((action, index) => <button className="agent-action" key={action.id} onClick={() => runAction(action.label, action.result)} disabled={job?.status === 'thinking' || job?.status === 'analyzing'}><span className="agent-action-number">0{index + 1}</span><span>{action.label}</span><ArrowRight size={13} /></button>)}</div></div>

      {job && <div className="agent-job-card">
        <div className="job-card-heading"><span className={`job-state-icon ${job.status}`}><Sparkles size={13} /></span><div><strong>{job.status === 'completed' ? (job.source === 'chat' ? 'Ответ готов' : 'Готов результат') : job.status === 'thinking' ? 'Thinking' : 'Analyzing'}</strong><small>{job.title}</small></div><span className={`job-status-text ${job.status}`}>{job.status.toUpperCase()}</span></div>
        {job.status !== 'completed' ? <div className="agent-progress-list">{actionSteps.map((step, index) => <div className={`agent-progress-step ${index < phase ? 'is-done' : index === phase ? 'is-current' : ''}`} key={step}><span>{index < phase ? <Check size={10} /> : index === phase ? <span className="progress-pulse" /> : null}</span>{step}</div>)}</div> : job.source === 'action' && <div className="agent-result"><p>{job.result}</p><div className="result-actions"><button onClick={() => setMessages((current) => [...current, { role: 'user', text: 'Сохрани результат в документ' }])}><FileText size={12} /> В документ</button><button onClick={() => runAction('Уточнение результата', 'Результат можно развить: укажите целевой сегмент, горизонт проверки или желаемый формат следующего шага.')}>Уточнить <ArrowRight size={12} /></button></div></div>}
      </div>}

      {messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${index}-${message.role}`}><span className="chat-message-avatar">{message.role === 'user' ? 'AK' : <Sparkles size={12} />}</span><div><small>{message.role === 'user' ? 'YOU' : 'STRAVIO AGENT'}</small><p>{message.text}</p></div></div>)}
      {job?.status !== 'completed' && job?.source === 'chat' && <div className="agent-typing"><span /><span /><span /> Анализирую контекст</div>}
      <div ref={conversationEnd} />
    </div>
    <div className="agent-composer"><div className="composer-context"><span><span className="context-signal" /> Контекст проекта</span><button className="icon-button" title="Настроить контекст"><ChevronDown size={13} /></button></div><ChatInput disabled={job?.status === 'thinking' || job?.status === 'analyzing'} onSend={ask} /><div className="composer-footer"><span><Command size={10} /> Enter чтобы отправить</span><span>AI может ошибаться</span></div></div>
  </aside>
}