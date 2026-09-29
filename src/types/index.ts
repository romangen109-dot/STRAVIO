export type WorkspaceSection =
  | 'Overview'
  | 'Strategy'
  | 'Research'
  | 'Documents'
  | 'Planning'
  | 'Tasks'
  | 'Insights'
  | 'Settings'

export type ProjectFile = {
  id: string
  name: string
  folder: string
  content?: string
}

export type WorkspaceTab = {
  id: string
  label: string
  kind: 'section' | 'file'
  section?: WorkspaceSection
  fileId?: string
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

export type AgentJob = {
  id: number
  title: string
  result: string
  status: 'thinking' | 'analyzing' | 'completed'
  source?: 'action' | 'chat'
}