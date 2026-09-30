import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Command, Cpu, FileText, Maximize2, Minimize2, MoreHorizontal, PanelRightClose, Sparkles, Trash2 } from 'lucide-react'
import { loadAgentChats, localStrategyProvider, saveAgentChats, STRAVIO_SYSTEM_INSTRUCTION } from '../../data/aiAgent'
import type { AgentContext, AgentJob, AgentMessage, AgentProposal, AgentProposalStatus } from '../../types'
import { hasStrategyProgress } from '../strategy/useStrategy'
import { AgentMessage as AgentMessageView } from '../ai/AgentMessage'
import { ChatInput } from '../ai/ChatInput'
import { useCurrentUser } from '../auth/UserContext'

type Props = {
  onClose: () => void
  getContext: () => AgentContext
  initialPrompt?: { id: string; prompt: string; currentDocument?: AgentContext['currentDocument'] }
  onPromptHandled: (id: string) => void
  onApplyProposal: (proposal: AgentProposal) => boolean
}

const actionSteps = ['Reading saved strategy context', 'Checking Planning and documents', 'Preparing a contextual response']
const agentActions = [
  { id: 'analyze', label: 'Проанализировать стратегию', prompt: 'Analyze my strategy' },
  { id: 'risks', label: 'Найти риски и противоречия', prompt: 'Find risks and contradictions' },
  { id: 'tasks', label: 'Расставить приоритеты задач', prompt: 'What tasks should I do first?' },
  { id: 'plans', label: 'Сравнить Plan A и Plan B', prompt: 'Review Plan A and Plan B' },
  { id: 'step', label: 'Помочь с текущим шагом', prompt: 'Help me answer the current Strategy Algorithm step.' },
  { id: 'goal', label: 'Уточнить Desired State', prompt: 'Help formulate my Desired State' },
]

function contextKey(context: AgentContext) {
  return hasStrategyProgress(context.strategy) ? context.strategy.id : 'no-active-strategy'
}

function createMessage(userId: string, strategyId: string, role: AgentMessage['role'], content: string, proposal?: AgentProposal): AgentMessage {
  return {
    userId,
    strategyId,
    id: globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    proposal,
  }
}

export function AIAgent({ onClose, getContext, initialPrompt, onPromptHandled, onApplyProposal }: Props) {
  const user = useCurrentUser()
  const [chats, setChats] = useState<Record<string, AgentMessage[]>>(() => loadAgentChats(user.id))
  const [job, setJob] = useState<AgentJob | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [providerError, setProviderError] = useState('')
  const jobId = useRef(0)
  const processedJobId = useRef(0)
  const handledPromptId = useRef('')
  const sendPromptRef = useRef<(prompt: string, currentDocument?: AgentContext['currentDocument']) => void>(() => undefined)
  const conversationEnd = useRef<HTMLDivElement>(null)
  const context = getContext()
  const strategyId = contextKey(context)
  const messages = chats[strategyId] ?? []
  const strategyTitle = context.strategy.desiredState.destination.trim() || context.strategy.name.trim() || 'Untitled Strategy'
  const contextLabel = context.currentDocument?.title ?? strategyTitle

  const appendMessage = (selectedStrategyId: string, message: AgentMessage) => {
    setChats((current) => ({ ...current, [selectedStrategyId]: [...(current[selectedStrategyId] ?? []), message].slice(-120) }))
  }

  const sendPrompt = async (value: string, currentDocument?: AgentContext['currentDocument']) => {
    const prompt = value.trim()
    if (!prompt || job?.status === 'thinking' || job?.status === 'analyzing') return
    const requestContext = getContext()
    if (currentDocument) requestContext.currentDocument = currentDocument
    const requestStrategyId = contextKey(requestContext)
    const currentJobId = ++jobId.current
    setProviderError('')
    appendMessage(requestStrategyId, createMessage(user.id, requestStrategyId, 'user', prompt))
    setJob({ id: currentJobId, title: 'Reading project context', result: '', status: 'thinking', source: 'chat', strategyId: requestStrategyId })
    try {
      const response = await localStrategyProvider.respond({ prompt, context: requestContext, systemInstruction: STRAVIO_SYSTEM_INSTRUCTION })
      setJob((current) => current?.id === currentJobId ? { ...current, title: 'Contextual analysis', result: response.text, proposal: response.proposal, status: 'analyzing' } : current)
    } catch {
      setJob((current) => current?.id === currentJobId ? { ...current, title: 'Local context analysis', result: 'AI Agent is not connected yet. The local context assistant could not complete this request. Your strategy and task data were not changed.', status: 'analyzing' } : current)
    }
  }

  sendPromptRef.current = (prompt) => { void sendPrompt(prompt) }

  useEffect(() => {
    saveAgentChats(user.id, chats)
  }, [chats, user.id])

  useEffect(() => {
    if (!initialPrompt || handledPromptId.current === initialPrompt.id) return
    handledPromptId.current = initialPrompt.id
    onPromptHandled(initialPrompt.id)
    sendPromptRef.current(initialPrompt.prompt, initialPrompt.currentDocument)
  }, [initialPrompt?.id])

  useEffect(() => {
    if (!job) return
    if (job.status === 'thinking') {
      const timer = window.setTimeout(() => setJob((current) => current?.id === job.id && current.status === 'thinking' ? { ...current, status: 'analyzing' } : current), 380)
      return () => window.clearTimeout(timer)
    }
    if (job.status === 'analyzing') {
      const timer = window.setTimeout(() => setJob((current) => current?.id === job.id && current.status === 'analyzing' ? { ...current, status: 'completed' } : current), 650)
      return () => window.clearTimeout(timer)
    }
    if (job.status === 'completed' && processedJobId.current !== job.id) {
      processedJobId.current = job.id
      const responseStrategyId = job.strategyId ?? strategyId
      appendMessage(responseStrategyId, createMessage(user.id, responseStrategyId, 'agent', job.result, job.proposal))
      setJob(null)
    }
  }, [job, strategyId, user.id])

  useEffect(() => { conversationEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [job, messages])

  const clearConversation = () => {
    jobId.current += 1
    setJob(null)
    setChats((current) => {
      const next = { ...current }
      delete next[strategyId]
      return next
    })
    setMenuOpen(false)
  }

  const updateProposal = (messageId: string, status: AgentProposalStatus) => setChats((current) => ({
    ...current,
    [strategyId]: (current[strategyId] ?? []).map((message) => message.id === messageId && message.proposal
      ? { ...message, proposal: { ...message.proposal, status } }
      : message),
  }))

  const applyProposal = (message: AgentMessage, proposal: AgentProposal) => {
    if (!onApplyProposal(proposal)) {
      setProviderError('The strategy context changed. Review the current strategy and try again.')
      return false
    }
    updateProposal(message.id, 'applied')
    setProviderError('')
    return true
  }

  const phase = job?.status === 'thinking' ? 0 : job?.status === 'analyzing' ? 2 : 3

  return <aside className={`agent-panel ${isFullscreen ? 'is-fullscreen' : ''}`}>
    <div className="agent-header"><div className="agent-title-mark"><Sparkles size={15} /></div><div className="agent-header-copy"><strong>AI Agent</strong><span className="beta-pill">BETA</span></div>
      <button className="icon-button" onClick={clearConversation} aria-label="Clear current conversation" title="Clear current conversation"><Trash2 size={14} /></button>
      <button className="icon-button" onClick={() => setIsFullscreen((current) => !current)} aria-label={isFullscreen ? 'Exit fullscreen' : 'Open fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'Open fullscreen'}>{isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
      <button className="icon-button agent-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Agent options"><MoreHorizontal size={16} /></button>
      <button className="icon-button agent-close-button" onClick={onClose} aria-label="Hide AI Agent"><PanelRightClose size={16} /></button>
      {menuOpen && <div className="agent-menu"><button onClick={clearConversation}>Clear this strategy chat</button><button onClick={() => setMenuOpen(false)}>Context is loaded automatically</button></div>}
    </div>
    <div className="agent-context"><span className="context-signal" /><span>STRATEGY CONTEXT</span><span className="context-divider" /><FileText size={12} /><span>{contextLabel}</span><ChevronDown size={12} /></div>
    <div className="agent-scroll-area">
      <div className="agent-intro"><div className="agent-orb"><Sparkles size={17} /></div><span className="eyebrow">STRAVIO INTELLIGENCE <i /> LOCAL MODE</span><h2>Strategy-aware assistance.</h2><p>Ответы опираются на сохранённую стратегию, текущий документ и задачи Planning. Предложения не применяются без подтверждения.</p><div className="agent-model-note"><Cpu size={12} /> CONTEXT-AWARE LOCAL PROVIDER <span>·</span> NO API KEY</div></div>
      <div className="agent-connection-note"><span>i</span><div><strong>AI Agent is not connected yet.</strong><small>Внешний AI API не настроен. Локальный помощник отвечает по сохранённому контексту без внешнего сервиса.</small></div></div>

      <div className="agent-actions-block"><div className="agent-section-label"><span>STRATEGY ACTIONS</span><span>06</span></div><div className="agent-action-list">{agentActions.map((action, index) => <button className="agent-action" key={action.id} onClick={() => sendPrompt(action.prompt)} disabled={job?.status === 'thinking' || job?.status === 'analyzing'}><span className="agent-action-number">0{index + 1}</span><span>{action.label}</span><ArrowRight size={13} /></button>)}</div></div>

      {job && <div className="agent-job-card"><div className="job-card-heading"><span className={`job-state-icon ${job.status}`}><Sparkles size={13} /></span><div><strong>{job.status === 'thinking' ? 'Thinking' : 'Analyzing'}</strong><small>{job.title}</small></div><span className={`job-status-text ${job.status}`}>{job.status.toUpperCase()}</span></div><div className="agent-progress-list">{actionSteps.map((step, index) => <div className={`agent-progress-step ${index < phase ? 'is-done' : index === phase ? 'is-current' : ''}`} key={step}><span>{index < phase ? <Check size={10} /> : index === phase ? <span className="progress-pulse" /> : null}</span>{step}</div>)}</div></div>}

      {messages.map((message) => <div className={`chat-message ${message.role}`} key={message.id}><span className="chat-message-avatar">{message.role === 'user' ? 'YOU' : <Sparkles size={12} />}</span><div className="chat-message-body"><small>{message.role === 'user' ? 'YOU' : 'STRAVIO AGENT · LOCAL CONTEXT'}</small>{message.role === 'user' ? <p>{message.content}</p> : <AgentMessageView content={message.content} proposal={message.proposal} onApplyProposal={(proposal) => applyProposal(message, proposal)} onSetProposalStatus={(status) => updateProposal(message.id, status)} />}</div></div>)}
      {providerError && <div className="agent-inline-error">{providerError}</div>}
      {job?.status === 'thinking' && <div className="agent-typing"><span /><span /><span /> Reading saved project context</div>}
      <div ref={conversationEnd} />
    </div>
    <div className="agent-composer"><div className="composer-context"><span><span className="context-signal" /> {context.activeView} · strategy, tasks and documents</span><button className="icon-button" title="Context refreshes before each request"><ChevronDown size={13} /></button></div><ChatInput disabled={job?.status === 'thinking' || job?.status === 'analyzing'} onSend={sendPrompt} /><div className="composer-footer"><span><Command size={10} /> Enter to send</span><span>Changes require confirmation</span></div></div>
  </aside>
}
