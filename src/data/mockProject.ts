import type { ProjectFile, WorkspaceSection } from '../types'

export const project = {
  name: 'Tech Education Platform',
  description: 'Разработка образовательной платформы для изучения технологий',
  status: 'Active Project',
  updated: 'Обновлён 12 минут назад',
}

export const navigation: { label: WorkspaceSection; title?: string; icon: string }[] = [
  { label: 'Overview', title: 'Dashboard', icon: 'layout' },
  { label: 'Strategy', title: 'Strategy Algorithm', icon: 'compass' },
  { label: 'Strategy Documents', icon: 'strategyDocuments' },
  { label: 'Research', icon: 'search' },
  { label: 'Documents', icon: 'files' },
  { label: 'Planning', icon: 'calendar' },
  { label: 'Tasks', icon: 'check' },
  { label: 'Insights', icon: 'chart' },
  { label: 'Settings', icon: 'settings' },
]

export const initialFiles: Omit<ProjectFile, 'userId'>[] = [
  { id: 'current-state', name: 'current-state.md', folder: 'strategy' },
  { id: 'desired-state', name: 'desired-state.md', folder: 'strategy' },
  { id: 'options', name: 'options.md', folder: 'strategy' },
  { id: 'roadmap', name: 'roadmap.md', folder: 'strategy' },
  { id: 'metrics', name: 'metrics.md', folder: 'strategy' },
  { id: 'market-analysis', name: 'market-analysis.md', folder: 'research' },
  { id: 'competitors', name: 'competitors.md', folder: 'research' },
  { id: 'technologies', name: 'technologies.md', folder: 'research' },
  { id: 'summary', name: 'summary.md', folder: 'docs' },
]

export const folders = ['strategy', 'research', 'docs']