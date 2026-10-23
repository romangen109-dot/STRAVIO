import type { WorkspaceSection } from '../types'

export const navigation: { label: WorkspaceSection; title?: string; icon: string }[] = [
  { label: 'Overview', title: 'Dashboard', icon: 'layout' },
  { label: 'Strategy', title: 'Strategy Algorithm', icon: 'compass' },
  { label: 'Documents', icon: 'strategyDocuments' },
  { label: 'Planning', icon: 'calendar' },
  { label: 'Settings', icon: 'settings' },
]