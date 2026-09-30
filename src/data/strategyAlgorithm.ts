import type { CurrentStateAnswers, DesiredStateAnswers, StrategyData } from '../types'
import { project } from './mockProject'

export type InterviewQuestion<T extends string> = {
  key: T
  title: string
  explanation: string
  placeholder: string
}

export const currentStateQuestions: InterviewQuestion<keyof CurrentStateAnswers>[] = [
  { key: 'situation', title: 'Situation', explanation: 'Что происходит сейчас и какой контекст важно учитывать?', placeholder: 'Опишите текущую ситуацию проекта...' },
  { key: 'resources', title: 'Resources', explanation: 'Какие ресурсы доступны: время, бюджет, команда, связи и инструменты?', placeholder: 'Перечислите доступные ресурсы...' },
  { key: 'skills', title: 'Skills & Knowledge', explanation: 'Какими навыками и знаниями уже обладает команда?', placeholder: 'Опишите компетенции и опыт...' },
  { key: 'constraints', title: 'Constraints', explanation: 'Какие ограничения влияют на возможные решения?', placeholder: 'Опишите ограничения по срокам, бюджету, доступу...' },
  { key: 'problems', title: 'Problems', explanation: 'Какие проблемы или неудовлетворённые потребности нужно решить?', placeholder: 'Сформулируйте основные проблемы...' },
  { key: 'opportunities', title: 'Opportunities', explanation: 'Какие возможности, тренды или преимущества можно использовать?', placeholder: 'Опишите возможности...' },
]

export const desiredStateQuestions: InterviewQuestion<keyof DesiredStateAnswers>[] = [
  { key: 'destination', title: 'Desired Destination', explanation: 'К какому конкретному состоянию вы хотите прийти?', placeholder: 'Опишите желаемый результат...' },
  { key: 'successPicture', title: 'Success Picture', explanation: 'Как будет выглядеть успех для команды и пользователей?', placeholder: 'Представьте, что цель достигнута...' },
  { key: 'indicators', title: 'Indicators', explanation: 'По каким наблюдаемым признакам станет ясно, что цель достигнута?', placeholder: 'Укажите измеримые признаки успеха...' },
  { key: 'timeframe', title: 'Timeframe', explanation: 'К какому сроку нужно достичь результата и какие есть контрольные даты?', placeholder: 'Например: пилот за 90 дней...' },
  { key: 'changes', title: 'Changes After Result', explanation: 'Что изменится после достижения результата?', placeholder: 'Опишите последствия для продукта, команды и клиентов...' },
]

export function createInitialStrategy(userId = ''): StrategyData {
  const now = new Date().toISOString()
  return {
    userId,
    id: globalThis.crypto?.randomUUID?.() ?? `strategy-${userId}-${Date.now()}`,
    name: project.name,
    description: project.description,
    currentState: { situation: '', resources: '', skills: '', constraints: '', problems: '', opportunities: '' },
    desiredState: { destination: '', successPicture: '', indicators: '', timeframe: '', changes: '' },
    strategicOptions: [
      {
        id: 'A', title: 'Option A · Нишевый MVP',
        description: 'Запустить один короткий практический курс для конкретного сегмента и быстро проверить спрос.',
        advantages: ['Быстрая проверка спроса', 'Низкие затраты на первый запуск'],
        risks: ['Узкий первоначальный рынок', 'Результат зависит от качества выбранного сегмента'],
        requiredResources: ['Команда продукта', 'Один автор курса', 'Лендинг и инструменты интервью'],
      },
      {
        id: 'B', title: 'Option B · Когортное обучение',
        description: 'Провести обучение небольшими потоками с поддержкой наставников и обратной связью.',
        advantages: ['Высокая вовлечённость', 'Ранняя выручка и качественная обратная связь'],
        risks: ['Зависимость от доступности наставников', 'Ограниченная пропускная способность'],
        requiredResources: ['Наставники', 'Учебная программа', 'Платформа для групповых занятий'],
      },
      {
        id: 'C', title: 'Option C · Контентная платформа',
        description: 'Создать библиотеку самостоятельных курсов, постепенно расширяя каталог и охват.',
        advantages: ['Потенциал масштабирования', 'Контент может поддерживать органический охват'],
        risks: ['Долгий путь к монетизации', 'Риск создать контент без подтверждённого спроса'],
        requiredResources: ['Производство контента', 'Техническая платформа', 'Маркетинг и аналитика'],
      },
    ],
    selectedOptionIds: [],
    plans: {
      A: { objective: '', approach: '', keyActions: '', risks: '', resources: '' },
      B: { objective: '', approach: '', keyActions: '', risks: '', resources: '' },
    },
    stages: [],
    control: { metrics: [], risks: '', warningSigns: '', reviewConditions: '' },
    workflowStep: 0,
    completed: false,
    createdAt: now,
    updatedAt: now,
  }
}