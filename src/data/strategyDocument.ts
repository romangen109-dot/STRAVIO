import type { StrategyData } from '../types'

function list(values: string[]) {
  return values.map((value) => `- ${value}`).join('\n')
}

export function createStrategyDocument(strategy: StrategyData) {
  const current = Object.entries(strategy.currentState).map(([key, value]) => `### ${key}\n\n${value}`).join('\n\n')
  const desired = Object.entries(strategy.desiredState).map(([key, value]) => `### ${key}\n\n${value}`).join('\n\n')
  const options = strategy.strategicOptions.map((option) => `### ${option.title}${strategy.selectedOptionIds.includes(option.id) ? ' (Selected)' : ''}\n\n${option.description}\n\nAdvantages:\n${list(option.advantages)}\n\nRisks:\n${list(option.risks)}\n\nRequired resources:\n${list(option.requiredResources)}`).join('\n\n')
  const plans = (['A', 'B'] as const).map((id) => {
    const plan = strategy.plans[id]
    return `### Plan ${id}\n\nObjective: ${plan.objective}\n\nApproach: ${plan.approach}\n\nKey Actions:\n${plan.keyActions}\n\nRisks:\n${plan.risks}\n\nResources:\n${plan.resources}`
  }).join('\n\n')
  const stages = strategy.stages.map((stage, index) => `### Stage ${index + 1}: ${stage.title}\n\nObjective: ${stage.objective}\n\nActions:\n${stage.actions}\n\nExpected Result: ${stage.expectedResult}\n\nDependencies: ${stage.dependencies}`).join('\n\n')
  const metrics = strategy.control.metrics.map((metric) => `- ${metric.name}: target ${metric.target}; current ${metric.currentValue}; review ${metric.reviewDate}`).join('\n')

  return `# ${strategy.name}\n\n${strategy.description}\n\n## Current State\n\n${current}\n\n## Desired State\n\n${desired}\n\n## Strategic Options\n\n${options}\n\n## Plans\n\n${plans}\n\n## Stage Plans\n\n${stages}\n\n## Control\n\n### Metrics\n\n${metrics}\n\n### Risks\n\n${strategy.control.risks}\n\n### Warning Signs\n\n${strategy.control.warningSigns}\n\n### Review Conditions\n\n${strategy.control.reviewConditions}\n`
}