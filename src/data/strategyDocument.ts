import type { StrategyData } from '../types'

function present(value: string | undefined) {
  return value?.trim() ?? ''
}

function block(title: string, value: string | undefined) {
  const text = present(value)
  return text ? `### ${title}\n\n${text}` : ''
}

function section(title: string, blocks: string[]) {
  const content = blocks.filter(Boolean).join('\n\n')
  return `## ${title}\n\n${content || '_No responses provided._'}`
}

function asList(values: string[]) {
  return values.map((value) => present(value)).filter(Boolean).map((value) => `- ${value}`).join('\n')
}

export function getStrategyDocumentTitle(strategy: StrategyData) {
  const subject = present(strategy.desiredState.destination)
  return subject ? `My Strategy — ${subject}` : 'Untitled Strategy'
}

export function createStrategyDocumentContent(strategy: StrategyData) {
  const summary = [
    present(strategy.currentState.situation) ? `Current situation: ${present(strategy.currentState.situation)}` : '',
    present(strategy.desiredState.destination) ? `Desired result: ${present(strategy.desiredState.destination)}` : '',
  ].filter(Boolean).join('\n\n')
  const currentBlocks = [
    block('Situation', strategy.currentState.situation),
    block('Resources', strategy.currentState.resources),
    block('Skills & Knowledge', strategy.currentState.skills),
    block('Constraints', strategy.currentState.constraints),
    block('Problems', strategy.currentState.problems),
    block('Opportunities', strategy.currentState.opportunities),
  ]
  const desiredBlocks = [
    block('Desired Destination', strategy.desiredState.destination),
    block('Success Picture', strategy.desiredState.successPicture),
    block('Success Indicators', strategy.desiredState.indicators),
    block('Timeframe', strategy.desiredState.timeframe),
    block('Changes After Result', strategy.desiredState.changes),
  ]
  const selectedOptions = strategy.strategicOptions.filter((option) => strategy.selectedOptionIds.includes(option.id))
  const optionBlocks = selectedOptions.map((option) => [
    `### ${option.title}`,
    block('Description', option.description),
    block('Advantages', asList(option.advantages)),
    block('Limitations & Risks', asList(option.risks)),
  ].filter(Boolean).join('\n\n'))

  const planBlocks = (['A', 'B'] as const).map((id) => {
    const plan = strategy.plans[id]
    const details = [
      block('Objective', plan.objective),
      block('Approach', plan.approach),
      block('Key Actions', plan.keyActions),
      block('Risks', plan.risks),
      block('Resources', plan.resources),
    ].filter(Boolean)
    return details.length ? [`### Plan ${id}`, ...details].join('\n\n') : ''
  })

  const stageBlocks = strategy.stages.map((stage, index) => {
    const details = [
      block('Objective', stage.objective),
      block('Key Actions', stage.actions),
      block('Expected Result', stage.expectedResult),
      block('Dependencies', stage.dependencies),
    ].filter(Boolean)
    return details.length ? [`### Stage ${index + 1}${present(stage.title) ? `: ${present(stage.title)}` : ''}`, ...details].join('\n\n') : ''
  })

  const metricBlocks = strategy.control.metrics.map((metric) => {
    const details = [
      block('Metric', metric.name),
      block('Target', metric.target),
      block('Current Value', metric.currentValue),
      block('Review Date', metric.reviewDate),
    ].filter(Boolean)
    return details.length ? [`### ${present(metric.name) || 'Metric'}`, ...details].join('\n\n') : ''
  })

  const strengths = [
    block('Resources', strategy.currentState.resources),
    block('Skills & Knowledge', strategy.currentState.skills),
    block('Opportunities', strategy.currentState.opportunities),
  ]
  const limitations = [
    block('Constraints', strategy.currentState.constraints),
    block('Problems', strategy.currentState.problems),
  ]
  const risks = [
    block('Control Risks', strategy.control.risks),
    block('Warning Signs', strategy.control.warningSigns),
    ...(['A', 'B'] as const).map((id) => block(`Plan ${id} Risks`, strategy.plans[id].risks)),
    ...selectedOptions.map((option) => block(`${option.title} Risks`, asList(option.risks))),
  ]
  const observations = [
    block('Current Situation', strategy.currentState.situation),
    block('Desired Destination', strategy.desiredState.destination),
    block('Timeframe', strategy.desiredState.timeframe),
    block('Review Conditions', strategy.control.reviewConditions),
  ]

  return [
    '# Strategy Overview',
    block('Strategy Name', getStrategyDocumentTitle(strategy)),
    block('Summary', summary),
    block('Current Situation', strategy.currentState.situation),
    block('Desired Result', strategy.desiredState.destination),
    section('Current State', currentBlocks),
    section('Desired State', desiredBlocks),
    section('Strategic Options', optionBlocks),
    section('Strategic Plans', planBlocks),
    section('Stage Plans', stageBlocks),
    section('Control', [
      section('Key Indicators', metricBlocks),
      block('What to Track · Risks', strategy.control.risks),
      block('Warning Signs', strategy.control.warningSigns),
      block('Review Conditions', strategy.control.reviewConditions),
    ]),
    section('AI Strategic Conclusions', [
      'This summary is compiled from the answers provided in Strategy Algorithm. It does not add external or inferred data.',
      section('Summary of Strategy', [block('Current Situation', strategy.currentState.situation), block('Desired Result', strategy.desiredState.destination), block('Timeframe', strategy.desiredState.timeframe)]),
      section('Strengths', strengths),
      section('Limitations', limitations),
      section('Key Risks', risks),
      section('Important Observations', observations),
    ]),
  ].filter(Boolean).join('\n\n').trim()
}

export function createStrategyDocument(strategy: StrategyData) {
  const now = new Date().toISOString()
  return {
    userId: strategy.userId,
    id: globalThis.crypto?.randomUUID?.() ?? `strategy-document-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: getStrategyDocumentTitle(strategy),
    content: createStrategyDocumentContent(strategy),
    createdAt: now,
    updatedAt: now,
    status: 'ready' as const,
    strategy: structuredClone(strategy),
  }
}