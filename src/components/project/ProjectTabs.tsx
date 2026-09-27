import { FileText, LayoutDashboard, Plus, X } from 'lucide-react'
import type { WorkspaceTab } from '../../types'

type Props = {
  tabs: WorkspaceTab[]
  activeId: string
  onSelect: (tab: WorkspaceTab) => void
  onClose: (tab: WorkspaceTab) => void
  onAdd: () => void
}

export function ProjectTabs({ tabs, activeId, onSelect, onClose, onAdd }: Props) {
  return (
    <div className="tabs-bar" role="tablist" aria-label="Открытые документы">
      {tabs.map((tab) => (
        <div className={`document-tab ${activeId === tab.id ? 'is-active' : ''}`} key={tab.id}>
          <button className="document-tab-select" role="tab" aria-selected={activeId === tab.id} onClick={() => onSelect(tab)}>
            {tab.kind === 'section' ? <LayoutDashboard size={13} /> : <FileText size={13} />}
            <span>{tab.label}</span>
          </button>
          {tab.id !== 'strategy' && <button className="document-tab-close" aria-label={`Закрыть ${tab.label}`} onClick={() => onClose(tab)}><X size={12} /></button>}
        </div>
      ))}
      <button className="tab-add" aria-label="Добавить вкладку" title="Открыть раздел" onClick={onAdd}><Plus size={15} /></button>
      <div className="tabs-spacer" />
      <span className="save-indicator"><span /> Все изменения сохранены</span>
    </div>
  )
}