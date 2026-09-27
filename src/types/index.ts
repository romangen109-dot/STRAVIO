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

export type AgentJob = {
  id: number
  title: string
  result: string
  status: 'thinking' | 'analyzing' | 'completed'
  source?: 'action' | 'chat'
}