import type { AgentContext, AgentMessage, AgentProposal, AgentProposalStatus, AgentTaskDraft, PlanningTaskStatus, StrategyData } from '../types'
import { currentStateQuestions, desiredStateQuestions, type InterviewQuestion } from './strategyAlgorithm'
import { localStorageDataProvider } from './storage'

export const STRAVIO_SYSTEM_INSTRUCTION = `Ты — стратегический AI Agent внутри Stravio. Анализируй стратегию и выполнение только на основе переданного контекста. Не выдумывай пользовательские данные и явно отделяй сохранённые факты от своих предложений. Если информации недостаточно, назови отсутствующие поля и задай короткий уточняющий вопрос. Помогай оценивать цели, варианты, Plan A и Plan B, ограничения, риски и задачи Planning. Не изменяй стратегию и не создавай задачи самостоятельно: сформируй предложение, покажи его пользователю и дождись явного Apply/Create Tasks. Пиши кратко, структурированно, с заголовками и списками. Для неподключённого внешнего provider используй только локальный context-aware fallback и сообщай о его ограничениях.`

export type AIRequest = { prompt: string; context: AgentContext; systemInstruction: string }
export type AIResponse = { text: string; proposal?: AgentProposal }

export interface AIProvider {
  readonly id: string
  readonly external: boolean
  respond(request: AIRequest): Promise<AIResponse>
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word))
}

function clean(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `agent-proposal-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function strategyTitle(strategy: StrategyData) {
  return strategy.desiredState.destination.trim() || strategy.name.trim() || 'Untitled Strategy'
}

function taskStageName(stageId: string) {
  return ({
    'current-state': 'Current State',
    'desired-state': 'Desired State',
    'strategic-options': 'Strategic Options',
    plans: 'Plan A / Plan B',
    'stage-plans': 'Stage Plans',
    control: 'Control',
  } as Record<string, string>)[stageId] ?? 'Strategy'
}

function openTasksResponse(context: AgentContext) {
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const tasks = context.tasks.filter((task) => task.status !== 'completed').sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority] || (left.deadline || '9999-12-31').localeCompare(right.deadline || '9999-12-31'))
  if (!tasks.length) return 'В Planning пока нет незавершённых задач для этой стратегии. Добавьте задачи в Planning или попросите меня предложить их на основе Stage Plans.'
  return `**Открытые задачи по приоритету**\n${tasks.slice(0, 8).map((task, index) => `${index + 1}. **${task.title}** — ${task.priority.toUpperCase()}, ${task.status === 'in-progress' ? 'In Progress' : 'To Do'} · ${taskStageName(task.stageId)}${task.deadline ? ` · срок ${task.deadline}` : ''}`).join('\n')}\n\nЭто текущие записи Planning для стратегии «${strategyTitle(context.strategy)}».`
}

function riskResponse(context: AgentContext) {
  const strategy = context.strategy
  const facts = clean([
    strategy.currentState.constraints && `Ограничения: ${strategy.currentState.constraints}`,
    strategy.currentState.problems && `Проблемы: ${strategy.currentState.problems}`,
    strategy.control.risks && `Контрольные риски: ${strategy.control.risks}`,
    strategy.control.warningSigns && `Сигналы риска: ${strategy.control.warningSigns}`,
    strategy.plans.A.risks && `Plan A: ${strategy.plans.A.risks}`,
    strategy.plans.B.risks && `Plan B: ${strategy.plans.B.risks}`,
  ])
  if (!facts.length) return '**Факты стратегии:** поля Constraints, Problems, Risks и Warning Signs пока не заполнены.\n\n**Предложение:** заполните эти поля или добавьте контрольные сигналы, чтобы проверить риски по данным проекта.'
  return `**Факты из стратегии**\n${facts.map((fact) => `- ${fact}`).join('\n')}\n\n**Что проверить**\n- Сопоставьте эти ограничения с целевым результатом и сроком. Это направление проверки, а не подтверждённое противоречие.`
}

function constraintsResponse(context: AgentContext) {
  const current = context.strategy.currentState
  if (!current.constraints.trim()) return 'В Strategy Algorithm поле **Constraints** пока не заполнено, поэтому я не могу назвать главное ограничение без догадок. Укажите ограничения по времени, бюджету, ресурсам или компетенциям.'
  const supporting = [current.problems.trim() && `Связанная проблема: ${current.problems.trim()}`, context.strategy.plans.A.risks.trim() && `Риск Plan A: ${context.strategy.plans.A.risks.trim()}`].filter(Boolean)
  return `**Сохранённое ограничение**\n- ${current.constraints.trim()}${supporting.length ? `\n\n**Связанный контекст**\n${supporting.map((item) => `- ${item}`).join('\n')}` : ''}\n\nЭто главное ограничение, записанное в Current State; других ограничений в заполненных полях нет.`
}

function plansResponse(context: AgentContext) {
  const plans = (['A', 'B'] as const).map((id) => {
    const plan = context.strategy.plans[id]
    const fields = [plan.objective && `Цель: ${plan.objective}`, plan.approach && `Подход: ${plan.approach}`, plan.keyActions && `Действия: ${plan.keyActions}`, plan.risks && `Риски: ${plan.risks}`].filter(Boolean)
    return fields.length ? `**Plan ${id}**\n${fields.map((field) => `- ${field}`).join('\n')}` : `**Plan ${id}:** данные пока не заполнены.`
  })
  return plans.join('\n\n')
}

function optionsResponse(context: AgentContext) {
  const selected = context.strategy.strategicOptions.filter((option) => context.strategy.selectedOptionIds.includes(option.id))
  if (!selected.length) return 'В Strategy Algorithm пока не выбраны Strategic Options. Выберите варианты, чтобы я мог сравнить их фактические описания и риски.'
  return selected.map((option) => `**${option.title}**\n${option.description}\n${option.advantages.length ? `- Преимущества: ${option.advantages.join('; ')}` : ''}${option.risks.length ? `\n- Риски: ${option.risks.join('; ')}` : ''}`).join('\n\n')
}

function strategyAnalysisResponse(context: AgentContext) {
  const strategy = context.strategy
  const selectedOptions = strategy.strategicOptions.filter((option) => strategy.selectedOptionIds.includes(option.id)).map((option) => option.title)
  const taskStats = {
    open: context.tasks.filter((task) => task.status !== 'completed').length,
    high: context.tasks.filter((task) => task.priority === 'high' && task.status !== 'completed').length,
    completed: context.tasks.filter((task) => task.status === 'completed').length,
  }
  const facts = clean([
    strategy.currentState.situation && `Current State: ${strategy.currentState.situation}`,
    strategy.currentState.resources && `Resources: ${strategy.currentState.resources}`,
    strategy.currentState.constraints && `Constraints: ${strategy.currentState.constraints}`,
    strategy.currentState.problems && `Problems: ${strategy.currentState.problems}`,
    strategy.currentState.opportunities && `Opportunities: ${strategy.currentState.opportunities}`,
    strategy.desiredState.destination && `Desired State: ${strategy.desiredState.destination}`,
    strategy.desiredState.indicators && `Success Indicators: ${strategy.desiredState.indicators}`,
    strategy.desiredState.timeframe && `Timeframe: ${strategy.desiredState.timeframe}`,
    selectedOptions.length ? `Selected Options: ${selectedOptions.join('; ')}` : '',
    strategy.plans.A.objective && `Plan A objective: ${strategy.plans.A.objective}`,
    strategy.plans.B.objective && `Plan B objective: ${strategy.plans.B.objective}`,
    strategy.stages.length ? `Stage Plans recorded: ${strategy.stages.filter((stage) => stage.title.trim()).map((stage) => stage.title.trim()).join('; ')}` : '',
    strategy.control.risks && `Control risks: ${strategy.control.risks}`,
    `Planning tasks: ${taskStats.open} open, ${taskStats.high} high priority, ${taskStats.completed} completed`,
    `Strategy documents: ${context.documents.length}`,
  ])
  const missing = clean([
    !strategy.currentState.situation.trim() ? 'Current State / Situation' : '',
    !strategy.currentState.constraints.trim() ? 'Current State / Constraints' : '',
    !strategy.desiredState.destination.trim() ? 'Desired State / Destination' : '',
    !strategy.desiredState.indicators.trim() ? 'Desired State / Success Indicators' : '',
    !selectedOptions.length ? 'Strategic Options selection' : '',
    !strategy.plans.A.objective.trim() ? 'Plan A objective' : '',
  ])
  return `**Факты из стратегии «${strategyTitle(strategy)}»**\n${facts.length ? facts.map((fact) => `- ${fact}`).join('\n') : '- Пока нет заполненных ответов.'}${missing.length ? `\n\n**Поля без данных**\n${missing.map((field) => `- ${field}`).join('\n')}` : ''}\n\n**Что проверить дальше**\nСопоставьте ограничения и ресурсы с выбранной целью. Это направление анализа; выводы не добавляют новых фактов.`
}

function currentStepHelp(context: AgentContext) {
  const strategy = context.strategy
  if (strategy.workflowStep === 0) return answerHelp(currentStateQuestions, strategy.currentState)
  if (strategy.workflowStep === 1) return answerHelp(desiredStateQuestions, strategy.desiredState)
  if (strategy.workflowStep === 2) return `В Strategic Options выбрано: ${strategy.strategicOptions.filter((option) => strategy.selectedOptionIds.includes(option.id)).map((option) => option.title).join(', ') || 'пока ничего'}. Выберите варианты в алгоритме, чтобы продолжить.`
  if (strategy.workflowStep === 3) return plansResponse(context)
  if (strategy.workflowStep === 4) return `В Stage Plans сейчас ${strategy.stages.length} этапов. ${strategy.stages.filter((stage) => stage.title.trim()).map((stage) => `- ${stage.title}: ${stage.objective || stage.actions}`).join('\n') || 'Добавьте название и ожидаемый результат этапа.'}`
  return `В Control записаны метрик: ${strategy.control.metrics.filter((metric) => metric.name.trim()).map((metric) => metric.name).join(', ') || 'нет'}. Укажите целевые значения, сроки пересмотра и сигналы риска.`
}

function answerHelp<T extends string>(questions: InterviewQuestion<T>[], answers: Record<T, string>) {
  const nextQuestion = questions.find((question) => !answers[question.key].trim())
  if (!nextQuestion) return 'Текущий блок заполнен. Перейдите к следующему шагу Strategy Algorithm.'
  const existing = questions.map((question) => ({ title: question.title, answer: answers[question.key] })).filter((entry) => entry.answer.trim()).map((entry) => `- ${entry.title}: ${entry.answer}`)
  return `**Текущий вопрос: ${nextQuestion.title}**\n${nextQuestion.explanation}${existing.length ? `\n\n**Уже указано**\n${existing.join('\n')}` : ''}\n\nПоделитесь фактами о проекте, которые должны попасть в этот ответ. Я не буду заполнять их за вас.`
}

function desiredStateProposal(context: AgentContext): AIResponse {
  const desired = context.strategy.desiredState
  const parts = [
    desired.destination.trim() && `Цель: ${desired.destination.trim()}`,
    desired.successPicture.trim() && `Результат: ${desired.successPicture.trim()}`,
    desired.indicators.trim() && `Критерии успеха: ${desired.indicators.trim()}`,
    desired.timeframe.trim() && `Срок: ${desired.timeframe.trim()}`,
  ].filter(Boolean)
  if (parts.length < 2) return { text: 'Пока недостаточно заполненных данных, чтобы предложить формулировку без выдумок. Добавьте Desired Destination, Success Picture, Success Indicators или Timeframe, затем попросите помочь уточнить цель.' }

  const proposedValue = parts.join('. ')
  return {
    text: `**Факты из стратегии**\n${parts.map((part) => `- ${part}`).join('\n')}\n\n**Предложение**\nОбъединить эти ответы в Desired State:\n\n> ${proposedValue}\n\nИзменение не будет применено без подтверждения.`,
    proposal: { id: createId(), kind: 'update-desired-state', status: 'pending', userId: context.userId, strategyId: context.strategy.id, previousValue: desired.destination, proposedValue },
  }
}

function proposedTasks(context: AgentContext, prompt: string): AIResponse {
  const existingSourceIds = new Set(context.tasks.map((task) => task.sourceStagePlanId).filter(Boolean))
  const stageTasks = context.strategy.stages.filter((stage) => stage.title.trim() && !existingSourceIds.has(stage.id)).map((stage): AgentTaskDraft => ({
    userId: context.userId,
    strategyId: context.strategy.id,
    stageId: 'stage-plans',
    title: stage.title.trim(),
    description: stage.actions.trim() || stage.objective.trim() || stage.expectedResult.trim(),
    status: 'todo',
    priority: 'medium',
    deadline: '',
    sourceStagePlanId: stage.id,
  }))
  const normalized = prompt.toLowerCase()
  const mvpRequest = includesAny(normalized, ['mvp', 'мвп', 'minimum viable product'])
  const tasks: AgentTaskDraft[] = stageTasks.length ? stageTasks : mvpRequest ? [
    { userId: context.userId, strategyId: context.strategy.id, stageId: 'stage-plans', title: 'Define MVP requirements', description: `Подготовить MVP по запросу: ${prompt}`, status: 'todo', priority: 'high', deadline: '' },
    { userId: context.userId, strategyId: context.strategy.id, stageId: 'stage-plans', title: 'Validate MVP scope', description: 'Проверить объём MVP относительно записанной цели и ограничений стратегии.', status: 'todo', priority: 'medium', deadline: '' },
    { userId: context.userId, strategyId: context.strategy.id, stageId: 'stage-plans', title: 'Prioritize MVP features', description: 'Сформировать приоритет функций для согласованного объёма MVP.', status: 'todo', priority: 'medium', deadline: '' },
  ] : []

  if (!tasks.length) return { text: 'Не нашёл заполненных Stage Plans, из которых можно безопасно создать задачи. Добавьте этапы в Strategy Algorithm; я смогу предложить их без повторного ввода.' }
  return {
    text: `**Предлагаемые задачи**\n${tasks.map((task, index) => `${index + 1}. **${task.title}**${task.description ? ` — ${task.description}` : ''}`).join('\n')}\n\nЭто предложения, не сохранённые задачи. Нажмите **Create Tasks**, чтобы добавить их в Planning для стратегии «${strategyTitle(context.strategy)}».`,
    proposal: { id: createId(), kind: 'create-tasks', status: 'pending', tasks },
  }
}

function currentDocumentResponse(context: AgentContext) {
  const document = context.currentDocument
  if (!document) return ''
  const lines = document.content.split('\n').map((line) => line.trim()).filter(Boolean)
  const relevant = lines.filter((line) => /risk|constraint|problem|weak|огранич|проблем|риск|противореч/i.test(line)).slice(0, 8)
  if (!relevant.length) return `В документе «${document.title}» нет заполненных строк с рисками или ограничениями. Я не буду приписывать документу слабые места, которых в нём нет.`
  return `**Факты из документа «${document.title}»**\n${relevant.map((line) => `- ${line.replace(/^#{1,3}\s*/, '')}`).join('\n')}\n\nЭти пункты отмечены в документе как риски, ограничения или проблемы. Проверяйте их вместе с полным контекстом стратегии.`
}

function contextualSummary(context: AgentContext) {
  const strategy = context.strategy
  const facts = [
    strategy.currentState.situation.trim() && `Текущая ситуация: ${strategy.currentState.situation.trim()}`,
    strategy.desiredState.destination.trim() && `Цель: ${strategy.desiredState.destination.trim()}`,
    strategy.desiredState.timeframe.trim() && `Срок: ${strategy.desiredState.timeframe.trim()}`,
    `Этап алгоритма: ${strategy.completed ? 'Completed' : strategy.workflowStep + 1}`,
    `Незавершённых задач: ${context.tasks.filter((task) => task.status !== 'completed').length}`,
    `Документов стратегии: ${context.documents.length}`,
  ].filter(Boolean)
  return facts.length > 3
    ? `**Текущий контекст**\n${facts.map((fact) => `- ${fact}`).join('\n')}\n\nУточните, какую часть нужно разобрать: цель, ограничение, Plan A/B, риски или задачи.`
    : 'В сохранённом контексте пока мало заполненных ответов. Добавьте данные в Strategy Algorithm или задайте более точный вопрос, чтобы я не подменял их общими предположениями.'
}

export const localStrategyProvider: AIProvider = {
  id: 'local-context',
  external: false,
  async respond({ prompt, context }) {
    const normalized = prompt.toLowerCase()
    if (!context.hasActiveStrategy && !context.currentDocument) return { text: 'Сначала начните Strategy Algorithm, чтобы у меня появился реальный контекст для анализа. Сейчас стратегия ещё не содержит сохранённых ответов.' }
    if (includesAny(normalized, ['create tasks', 'создай задач', 'создать задач', 'подготовить mvp', 'подготовить мвп', 'break into actions', 'разбить на действ', 'разложить на задач', 'action items', 'mvp'])) return proposedTasks(context, prompt)
    if (includesAny(normalized, ['desired state', 'цель', 'желаем', 'сформулировать', 'уточнить цель'])) return desiredStateProposal(context)
    if (includesAny(normalized, ['help me answer', 'помоги ответить', 'текущий вопрос']) && context.activeView === 'Strategy') return { text: currentStepHelp(context) }
    if (includesAny(normalized, ['огранич', 'constraint', 'лимит'])) return { text: constraintsResponse(context) }
    if (includesAny(normalized, ['приоритет', 'priority', 'priorit', 'сначала', 'first', 'next', 'что делать', 'важн', 'задач', 'task'])) return { text: openTasksResponse(context) }
    if (context.currentDocument && includesAny(normalized, ['document', 'документ', 'weak', 'слаб', 'risk', 'риск', 'анализ'])) return { text: currentDocumentResponse(context) }
    if (includesAny(normalized, ['risk', 'риск', 'weak', 'слаб', 'противореч', 'contradict'])) return { text: riskResponse(context) }
    if (includesAny(normalized, ['plan a', 'plan b', 'план а', 'план б', 'сравни планы', 'review my plan', 'составить план', 'план действий'])) return { text: plansResponse(context) }
    if (includesAny(normalized, ['strategic options', 'варианты', 'options'])) return { text: optionsResponse(context) }
    if (includesAny(normalized, ['analyze', 'анализа', 'анализир', 'проанализ'])) return { text: strategyAnalysisResponse(context) }
    if (includesAny(normalized, ['review my plan', 'review plan', 'проверь план'])) return { text: plansResponse(context) }
    return { text: contextualSummary(context) }
  },
}

export function loadAgentChats(userId: string): Record<string, AgentMessage[]> {
  const parsed = localStorageDataProvider.get<unknown>(userId, 'ai-history')
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
  return Object.fromEntries(Object.entries(parsed).map(([strategyId, messages]) => [
      strategyId,
      Array.isArray(messages) ? messages.filter((message) => isAgentMessage(message) && message.userId === userId && message.strategyId === strategyId) : [],
    ]))
}

export function saveAgentChats(userId: string, chats: Record<string, AgentMessage[]>) {
  const scoped = Object.fromEntries(Object.entries(chats).map(([strategyId, messages]) => [
    strategyId,
    messages.map((message) => ({ ...message, userId, strategyId })),
  ]))
  localStorageDataProvider.set(userId, 'ai-history', scoped)
}

function isAgentMessage(value: unknown): value is AgentMessage {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Record<string, unknown>
  return typeof message.id === 'string'
    && typeof message.userId === 'string'
    && typeof message.strategyId === 'string'
    && (message.role === 'user' || message.role === 'agent')
    && typeof message.content === 'string'
    && typeof message.createdAt === 'string'
    && (message.proposal === undefined || isAgentProposal(message.proposal))
}

function isAgentProposal(value: unknown): value is AgentProposal {
  if (typeof value !== 'object' || value === null) return false
  const proposal = value as Record<string, unknown>
  const validStatus = (status: unknown): status is AgentProposalStatus => status === 'pending' || status === 'applied' || status === 'cancelled'
  if (typeof proposal.id !== 'string' || !validStatus(proposal.status)) return false
  if (proposal.kind === 'update-desired-state') return typeof proposal.userId === 'string' && typeof proposal.strategyId === 'string' && typeof proposal.previousValue === 'string' && typeof proposal.proposedValue === 'string'
  if (proposal.kind !== 'create-tasks' || !Array.isArray(proposal.tasks)) return false
  const validStatusValue = (status: unknown): status is PlanningTaskStatus => status === 'todo' || status === 'in-progress' || status === 'completed'
  return proposal.tasks.every((value) => {
    if (typeof value !== 'object' || value === null) return false
    const task = value as Record<string, unknown>
    return typeof task.strategyId === 'string'
      && typeof task.stageId === 'string'
      && typeof task.title === 'string'
      && typeof task.description === 'string'
      && validStatusValue(task.status)
      && (task.priority === 'low' || task.priority === 'medium' || task.priority === 'high')
      && typeof task.deadline === 'string'
      && (task.sourceStagePlanId === undefined || typeof task.sourceStagePlanId === 'string')
  })
}