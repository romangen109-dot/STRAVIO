import { ArrowUp, Paperclip } from 'lucide-react'
import { useState, type FormEvent } from 'react'

type Props = { disabled?: boolean; onSend: (message: string) => void }

export function ChatInput({ disabled, onSend }: Props) {
  const [value, setValue] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
  }
  return <form className="chat-input-wrap" onSubmit={submit}>
    <textarea value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder="Задайте вопрос о проекте..." rows={2} aria-label="Сообщение AI-агенту" />
    <div className="chat-input-footer"><button type="button" className="icon-button attach-button" title="Прикрепить контекст"><Paperclip size={14} /></button><span>Контекст проекта включён</span><button className="send-button" aria-label="Отправить сообщение" disabled={!value.trim() || disabled}><ArrowUp size={15} /></button></div>
  </form>
}