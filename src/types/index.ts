export type WorkspaceSection =
  | 'Overview'
  | 'Strategy'
  | 'Strategy Documents'
  | 'Research'
  | 'Documents'
  | 'Planning'
  | 'Tasks'
  | 'Insights'
  | 'Settings'

export type User = {
  id: string
  name: string
  email: string
}

export type ProjectFile = {
  id: string
  userId: string
  name: string
  folder: string
  content?: string
}

export type WorkspaceTab = {
  id: string
  label: string
  kind: 'section' | 'file' | 'strategy-document'
  section?: WorkspaceSection
  fileId?: string
  strategyDocumentId?: string
}

export type StrategyStage = {
  id: string
  number: string
  title: string
  description: string
  eyebrow: string
  items: { title: string; icon: string; points: string[] }[]
}

export type CurrentStateAnswers = {
  situation: string
  resources: string
  skills: string
  constraints: string
  problems: string
  opportunities: string
}

export type DesiredStateAnswers = {
  destination: string
  successPicture: string
  indicators: string
  timeframe: string
  changes: string
}

export type StrategicOption = {
  id: string
  title: string
  description: string
  advantages: string[]
  risks: string[]
  requiredResources: string[]
}

export type StrategyPlan = {
  objective: string
  approach: string
  keyActions: string
  risks: string
  resources: string
}

export type StrategyStagePlan = {
  id: string
  title: string
  objective: string
  actions: string
  expectedResult: string
  dependencies: string
}

export type StrategyMetric = {
  id: string
  name: string
  target: string
  currentValue: string
  reviewDate: string
}

export type StrategyControl = {
  metrics: StrategyMetric[]
  risks: string
  warningSigns: string
  reviewConditions: string
}

export type StrategyData = {
  userId: string
  id: string
  name: string
  description: string
  currentState: CurrentStateAnswers
  desiredState: DesiredStateAnswers
  strategicOptions: StrategicOption[]
  selectedOptionIds: string[]
  plans: { A: StrategyPlan; B: StrategyPlan }
  stages: StrategyStagePlan[]
  control: StrategyControl
  workflowStep: number
  completed: boolean
  createdAt: string
  updatedAt: string
}

export type StrategyDocument = {
  userId: string
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  status: 'ready' | 'edited'
  strategy: StrategyData
}

export type StrategyActivityType = 'strategy-created' | 'strategy-updated' | 'strategy-completed' | 'document-generated' | 'document-edited' | 'document-deleted' | 'task-created' | 'task-completed' | 'ai-action-applied'

export type StrategyActivity = {
  userId: string
  id: string
  type: StrategyActivityType
  title: string
  createdAt: string
  strategyId?: string
  documentId?: string
}

export type PlanningTaskStatus = 'todo' | 'in-progress' | 'completed'
export type PlanningTaskPriority = 'low' | 'medium' | 'high'

export type PlanningTask = {
  userId: string
  id: string
  strategyId: string
  stageId: string
  title: string
  description: string
  status: PlanningTaskStatus
  priority: PlanningTaskPriority
  deadline: string
  createdAt: string
  sourceStagePlanId?: string
}

export type AgentTaskDraft = Omit<PlanningTask, 'id' | 'createdAt'>
export type AgentProposalStatus = 'pending' | 'applied' | 'cancelled'

export type AgentProposal =
  | { id: string; kind: 'create-tasks'; status: AgentProposalStatus; tasks: AgentTaskDraft[] }
  | { id: string; kind: 'update-desired-state'; status: AgentProposalStatus; userId: string; strategyId: string; previousValue: string; proposedValue: string }

export type AgentMessage = {
  userId: string
  strategyId: string
  id: string
  role: 'user' | 'agent'
  content: string
  createdAt: string
  proposal?: AgentProposal
}

export type AgentContext = {
  userId: string
  strategy: StrategyData
  hasActiveStrategy: boolean
  tasks: PlanningTask[]
  documents: StrategyDocument[]
  activeView: string
  currentDocument?: StrategyDocument | { id: string; title: string; content: string }
}

export type AgentJob = {
  id: number
  title: string
  result: string
  status: 'thinking' | 'analyzing' | 'completed' | 'failed'
  source?: 'action' | 'chat'
  strategyId?: string
  proposal?: AgentProposal
}