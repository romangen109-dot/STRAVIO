import { useState } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Ellipsis, FilePlus2, Flag, Gauge, Layers3, Lightbulb, Link2, ShieldAlert, Sparkles, Target, Users, Zap, type LucideIcon } from 'lucide-react'
import { project } from '../../data/mockProject'
import { strategyStages } from '../../data/mockStrategy'

const stageIcons = [Gauge, Target, Lightbulb, Flag, Activity]
const blockIcons: Record<string, LucideIcon> = {
  layers: Layers3, sparkles: Sparkles, limit: ShieldAlert, alert: CircleHelp,
  trend: ArrowUpRight, target: Target, check: Check, calendar: Clock3, zap: Zap,
  users: Users, book: FilePlus2, route: ArrowDownRight, link: Link2, chart: Activity,
  flag: Flag, refresh: Activity,
}

export function Strategy() {
  const [expanded, setExpanded] = useState<string[]>(['current-state'])
  const [activeStage, setActiveStage] = useState('current-state')
  const [menuOpen, setMenuOpen] = useState(false)

  const showStage = (id: string) => {
    setActiveStage(id)
    setExpanded((current) => current.includes(id) ? current : [...current, id])
    document.getElementById(`stage-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const toggleStage = (id: string) => {
    setActiveStage(id)
    setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <div className="strategy-page">
      <header className="project-page-header">
        <div className="page-crumb"><span>PROJECT</span><ChevronRight size={12} /><span>STRATEGY</span></div>
        <div className="project-title-row">
          <div className="strategy-project-icon"><Layers3 size={19} /></div>
          <div className="project-title-copy"><h1>{project.name}</h1><p>{project.description}</p></div>
          <div className="project-header-meta"><span className="status-pill"><i /> {project.status}</span><span className="updated-label"><Clock3 size={12} /> Обновлён 12 минут назад</span></div>
          <div className="strategy-menu-wrap">
            <button className="icon-button page-menu-button" aria-label="Действия стратегии" onClick={() => setMenuOpen(!menuOpen)}><Ellipsis size={19} /></button>
            {menuOpen && <div className="strategy-menu"><button onClick={() => setMenuOpen(false)}>Экспортировать стратегию</button><button onClick={() => setMenuOpen(false)}>Скопировать ссылку</button><button onClick={() => setMenuOpen(false)}>Настроить проект</button></div>}
          </div>
        </div>
      </header>

      <div className="strategy-progress-wrap">
        <div className="section-kicker"><span>STRATEGY FRAMEWORK</span><span className="framework-version">v1.4 <i /> IN PROGRESS</span></div>
        <div className="strategy-progress" role="list" aria-label="Этапы стратегии">
          {strategyStages.map((stage, index) => {
            const Icon = stageIcons[index]
            const isActive = activeStage === stage.id
            const isDone = index === 0
            return <button className={`progress-step ${isActive ? 'is-active' : ''} ${isDone ? 'is-complete' : ''}`} key={stage.id} onClick={() => showStage(stage.id)} role="listitem">
              <span className="progress-icon">{isDone ? <Check size={14} /> : <Icon size={14} />}</span>
              <span className="progress-label"><small>{stage.number}</small><strong>{stage.title}</strong></span>
              {index < strategyStages.length - 1 && <span className="progress-connector" />}
            </button>
          })}
        </div>
      </div>

      <div className="strategy-content">
        <div className="content-section-heading">
          <div><span className="eyebrow">STRATEGY WORKSPACE <i /> LAST EDITED TODAY</span><h2>Стратегический обзор</h2><p>Рабочая модель проекта · 5 этапов</p></div>
          <button className="outline-button" onClick={() => showStage('desired-state')}><FilePlus2 size={14} /> Добавить заметку</button>
        </div>

        {strategyStages.map((stage, index) => {
          const open = expanded.includes(stage.id)
          return <section className={`strategy-section ${activeStage === stage.id ? 'is-current' : ''}`} id={`stage-${stage.id}`} key={stage.id}>
            <button className="strategy-section-head" onClick={() => toggleStage(stage.id)} aria-expanded={open}>
              <span className={`stage-number ${index === 0 ? 'stage-number-active' : ''}`}>{stage.number}</span>
              <span className="stage-title-area"><span className="stage-eyebrow">{stage.eyebrow}</span><strong>{stage.title}</strong></span>
              {index === 0 && <span className="active-stage-tag"><i /> ACTIVE STAGE</span>}
              {index === 1 && <span className="section-completion">0 / 3</span>}
              <ChevronDown className={`section-chevron ${open ? '' : 'is-collapsed'}`} size={17} />
            </button>
            {open && <div className="strategy-section-body">
              <p className="stage-description">{stage.description}</p>
              <div className={`strategy-cards ${stage.id === 'current-state' ? 'current-cards' : ''} ${stage.id === 'options' ? 'option-cards' : ''}`}>
                {stage.items.map((item, itemIndex) => {
                  const Icon = blockIcons[item.icon] ?? Sparkles
                  return <article className={`strategy-card ${stage.id === 'current-state' && itemIndex === 4 ? 'opportunity-card' : ''}`} key={item.title}>
                    <div className="strategy-card-head"><span className="card-icon"><Icon size={15} strokeWidth={1.8} /></span><h3>{item.title}</h3>{stage.id === 'options' && <span className={`option-badge option-${itemIndex}`}>OPTION {String.fromCharCode(65 + itemIndex)}</span>}</div>
                    <ul>{item.points.map((point) => <li key={point}><span className="point-marker" />{point}</li>)}</ul>
                    {stage.id === 'options' && <div className="option-footer"><span className={`risk-indicator risk-${itemIndex}`} />{['Низкий риск · Быстрая проверка', 'Средний риск · Ранняя выручка', 'Выше риск · Долгий горизонт'][itemIndex]}</div>}
                    {stage.id === 'action-plan' && itemIndex === 0 && <div className="plan-progress"><span><i /></span><small>1 из 3 этапов</small></div>}
                    {stage.id === 'control' && itemIndex === 0 && <div className="metric-sparkline"><span>Текущий baseline</span><div><i /><i /><i /><i /><i /><i /><i /></div><strong>Сбор данных</strong></div>}
                  </article>
                })}
                {stage.id === 'current-state' && <button className="add-insight-card" onClick={() => showStage('desired-state')}><span><Sparkles size={15} /></span><strong>Сформировать инсайты</strong><small>Найти связи между наблюдениями</small><ChevronRight size={14} /></button>}
              </div>
              {stage.id === 'action-plan' && <div className="dependency-strip"><Link2 size={14} /><span><strong>Зависимость:</strong> подтвердить целевой сегмент перед сборкой полного курса</span><span className="dependency-state">NEEDS REVIEW</span></div>}
            </div>}
          </section>
        })}
        <footer className="strategy-footer"><span><span className="footer-dot" /> Стратегия синхронизирована</span><span>Локальный workspace <i /> Изменения сохраняются автоматически</span></footer>
      </div>
    </div>
  )
}