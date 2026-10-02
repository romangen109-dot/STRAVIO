
import { useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Circle, Plus } from 'lucide-react'
import type { AgentProposal, AgentProposalStatus } from '../../types'

type Props = {
  content: string
  proposal?: AgentProposal
  onApplyProposal: (proposal: AgentProposal) => Promise<boolean>
  onSetProposalStatus: (status: AgentProposalStatus) => Promise<void>
}

export function AgentMessage({ content, proposal, onApplyProposal, onSetProposalStatus }: Props) {
  const [proposalError, setProposalError] = useState('')
  const [busy, setBusy] = useState(false)
  const applyingProposalIds = useRef(new Set<string>())

  const apply = async () => {
    if (!proposal || applyingProposalIds.current.has(proposal.id)) return
    applyingProposalIds.current.add(proposal.id)
    setBusy(true)
    if (!await onApplyProposal(proposal)) {
      applyingProposalIds.current.delete(proposal.id)
      setProposalError('The change was not applied. Check the cloud connection and current strategy, then try again.')
      setBusy(false)
      return
    }
    setProposalError('')
    setBusy(false)
  }

  const cancel = async () => {
    setBusy(true)
    try {
      await onSetProposalStatus('cancelled')
      setProposalError('')
    } catch (error) {
      setProposalError(error instanceof Error ? error.message : 'Could not cancel the proposal.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="agent-response-content">
    <MarkdownContent content={content} />
    {proposal && <section className={`agent-proposal-card ${proposal.status}`}>
      <div className="agent-proposal-heading"><span><Circle size={7} fill="currentColor" /></span><strong>{proposal.kind === 'create-tasks' ? 'Proposed Planning tasks' : 'Proposed strategy change'}</strong><small>{proposal.status === 'pending' ? 'AWAITING CONFIRMATION' : proposal.status === 'applied' ? 'APPLIED' : 'CANCELLED'}</small></div>
      {proposal.kind === 'create-tasks' ? <div className="agent-proposal-items">{proposal.tasks.map((task, index) => <div key={`${task.title}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{task.title}</strong>{task.description && <small>{task.description}</small>}</div></div>)}</div> : <div className="agent-proposal-change"><div><small>CURRENT DESIRED STATE</small><p>{proposal.previousValue || 'Not provided'}</p></div><ChevronDown size={14} /><div><small>PROPOSED DESIRED STATE</small><p>{proposal.proposedValue}</p></div></div>}
      {proposal.status === 'pending' ? <div className="agent-proposal-actions"><button className="outline-button" onClick={() => void cancel()} disabled={busy}>Cancel</button><button className="outline-button algorithm-primary" onClick={() => void apply()} disabled={busy}>{proposal.kind === 'create-tasks' ? <><Plus size={12} /> {busy ? 'Creating…' : 'Create Tasks'}</> : <><Check size={12} /> {busy ? 'Applying…' : 'Apply Change'}</>}</button></div> : <div className="agent-proposal-result"><Check size={12} /> {proposal.status === 'applied' ? 'Confirmed and saved' : 'No changes made'}</div>}
      {proposalError && <p className="agent-proposal-error">{proposalError}</p>}
    </section>}
  </div>
}

function MarkdownContent({ content }: { content: string }) {
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let bulletItems: string[] = []
  let numberedItems: string[] = []
  let key = 0

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={`p-${key++}`}>{formatInline(paragraph.join(' '))}</p>)
    paragraph = []
  }
  const flushBullets = () => {
    if (bulletItems.length) blocks.push(<ul key={`ul-${key++}`}>{bulletItems.map((item, index) => <li key={`${index}-${item}`}>{formatInline(item)}</li>)}</ul>)
    bulletItems = []
  }
  const flushNumbers = () => {
    if (numberedItems.length) blocks.push(<ol key={`ol-${key++}`}>{numberedItems.map((item, index) => <li key={`${index}-${item}`}>{formatInline(item)}</li>)}</ol>)
    numberedItems = []
  }
  const flushLists = () => { flushBullets(); flushNumbers() }

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    const bullet = /^[-*]\s+(.+)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line)
    if (!line) {
      flushParagraph()
      flushLists()
    } else if (heading) {
      flushParagraph()
      flushLists()
      const level = heading[1].length
      if (level === 1) blocks.push(<h3 key={`h-${key++}`}>{formatInline(heading[2])}</h3>)
      else blocks.push(<h4 key={`h-${key++}`}>{formatInline(heading[2])}</h4>)
    } else if (bullet) {
      flushParagraph()
      flushNumbers()
      bulletItems.push(bullet[1])
    } else if (numbered) {
      flushParagraph()
      flushBullets()
      numberedItems.push(numbered[1])
    } else {
      flushLists()
      paragraph.push(line.replace(/^>\s*/, ''))
    }
  }
  flushParagraph()
  flushLists()

  return <div className="agent-markdown">{blocks}</div>
}

function formatInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={index}>{part.slice(2, -2)}</strong>
    : part)
}
