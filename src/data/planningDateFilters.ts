export type PlanningDateView = 'all' | 'today' | 'tomorrow' | 'week' | 'month'

export function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

export function getWeekBounds(today: string) {
  const start = new Date(`${today}T12:00:00`)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const weekStart = dateKey(start)
  return { weekStart, weekEnd: shiftDate(weekStart, 6) }
}

export function matchesPlanningDate(
  deadline: string,
  view: PlanningDateView,
  today: string,
  weekStart: string,
  weekEnd: string,
  monthKey: string,
  selectedDate: string | null,
) {
  if (view === 'all') return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return false
  const parsed = new Date(`${deadline}T12:00:00`)
  if (!Number.isFinite(parsed.getTime()) || dateKey(parsed) !== deadline) return false
  if (view === 'today') return deadline === today
  if (view === 'tomorrow') return deadline === shiftDate(today, 1)
  if (view === 'week') return deadline >= weekStart && deadline <= weekEnd
  return selectedDate ? deadline === selectedDate : deadline.startsWith(monthKey)
}
