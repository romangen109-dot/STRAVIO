import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'

let demoAuthProvider
let createStrategyDocumentRecord
let deleteStrategyDocumentRecord
let getStrategyDocuments
let renameStrategyDocumentRecord
let updateStrategyDocumentRecord
let saveStrategyDocumentDraft
let discardStrategyDocumentDraft
let getRecentActivity
let createPlanningTask
let deletePlanningTask
let getPlanningTasks
let updatePlanningTask
let createStrategy
let deleteStrategy
let getStrategies
let getCachedActiveStrategy
let getStrategy
let updateStrategy
let selectActiveStrategy
let createInitialStrategy
let createStrategyDocumentContent
let readLocalWorkspace
let updateLocalWorkspace
let clearStrategyMessages
let getStrategyMessages
let resolveAgentProposal
let dateFilters
let createAgentContext

class MemoryStorage {
  values = new Map()
  failWrites = false

  get length() { return this.values.size }
  key(index) { return [...this.values.keys()][index] ?? null }
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) {
    if (this.failWrites) throw new DOMException('Storage full', 'QuotaExceededError')
    this.values.set(key, String(value))
  }
  removeItem(key) { this.values.delete(key) }
  clear() { this.values.clear() }
}

const storage = new MemoryStorage()
globalThis.window = { localStorage: storage, dispatchEvent() {} }

let vite
before(async () => {
  const { createServer } = await import('vite')
  vite = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true }, appType: 'custom' })
  ;({ demoAuthProvider } = await vite.ssrLoadModule('/src/data/supabaseAuth.ts'))
  ;({ createStrategyDocumentRecord, deleteStrategyDocumentRecord, discardStrategyDocumentDraft, getStrategyDocuments, renameStrategyDocumentRecord, saveStrategyDocumentDraft, updateStrategyDocumentRecord } = await vite.ssrLoadModule('/src/data/documentService.ts'))
  ;({ getRecentActivity } = await vite.ssrLoadModule('/src/data/activityService.ts'))
  ;({ createPlanningTask, deletePlanningTask, getPlanningTasks, updatePlanningTask } = await vite.ssrLoadModule('/src/data/taskService.ts'))
  ;({ createStrategy, deleteStrategy, getCachedActiveStrategy, getStrategies, getStrategy, selectActiveStrategy, updateStrategy } = await vite.ssrLoadModule('/src/data/strategyService.ts'))
  ;({ createInitialStrategy } = await vite.ssrLoadModule('/src/data/strategyAlgorithm.ts'))
  ;({ createStrategyDocumentContent } = await vite.ssrLoadModule('/src/data/strategyDocument.ts'))
  ;({ readLocalWorkspace, updateLocalWorkspace } = await vite.ssrLoadModule('/src/data/localWorkspace.ts'))
  ;({ clearStrategyMessages, getStrategyMessages, resolveAgentProposal } = await vite.ssrLoadModule('/src/data/chatService.ts'))
  dateFilters = await vite.ssrLoadModule('/src/data/planningDateFilters.ts')
  ;({ createAgentContext } = await vite.ssrLoadModule('/src/data/agentContext.ts'))
})

after(async () => {
  await vite?.close()
})

test('Demo Mode stores no password and restores the same isolated profile after logout', async () => {
  storage.clear()
  const registered = await demoAuthProvider.register('Planner', 'planner@example.com', 'registration-pass')
  assert.equal('user' in registered, true)
  const user = registered.user
  const snapshot = [...storage.values.values()].join('\n')
  assert.equal(snapshot.includes('registration-pass'), false)
  assert.deepEqual(await demoAuthProvider.getCurrentUser(), user)
  await createStrategy(createInitialStrategy(user.id))

  await demoAuthProvider.logout()
  assert.equal(await demoAuthProvider.getCurrentUser(), null)
  assert.equal((await getStrategies(user.id)).length, 1)

  const signedIn = await demoAuthProvider.login('PLANNER@example.com', 'any-other-nonempty-password')
  assert.equal('user' in signedIn, true)
  assert.equal(signedIn.user.id, user.id)
  assert.equal(signedIn.user.name, 'Planner')

  const otherProfile = await demoAuthProvider.login('another-user', 'x')
  assert.equal('user' in otherProfile, true)
  assert.notEqual(otherProfile.user.id, user.id)
  assert.equal((await getStrategies(user.id)).length, 1)
  assert.equal((await getStrategies(otherProfile.user.id)).length, 0)
})

test('local profile, strategy, documents, tasks and activity support CRUD and reload reads', async () => {
  storage.clear()
  const auth = await demoAuthProvider.login('owner@example.com', 'p')
  assert.equal('user' in auth, true)
  const user = auth.user
  const strategy = createInitialStrategy(user.id)
  strategy.name = 'Launch'
  await createStrategy(strategy)

  const second = createInitialStrategy(user.id)
  second.id = 'strategy-second'
  second.name = 'Expansion'
  await createStrategy(second)
  const renamedStrategy = { ...second, name: 'Expansion plan', updatedAt: new Date().toISOString() }
  await updateStrategy(renamedStrategy)
  assert.deepEqual((await getStrategies(user.id)).map((item) => item.name), ['Expansion plan', 'Launch'])

  const document = {
    id: 'doc-one',
    userId: user.id,
    title: 'Brief',
    content: 'Draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ready',
    strategy,
  }
  await createStrategyDocumentRecord(document)
  await updateStrategyDocumentRecord(user.id, document.id, 'Saved content')
  await renameStrategyDocumentRecord(user.id, document.id, 'Final brief')
  assert.equal((await getStrategyDocuments(user.id))[0].content, 'Saved content')
  assert.equal((await getStrategyDocuments(user.id))[0].title, 'Final brief')

  const task = await createPlanningTask({
    userId: user.id,
    strategyId: strategy.id,
    stageId: 'stage-plans',
    title: 'Review',
    description: 'Check milestones',
    status: 'todo',
    priority: 'high',
    deadline: '2026-12-01',
  })
  await updatePlanningTask(user.id, task.id, { status: 'completed' })
  assert.equal((await getPlanningTasks(user.id))[0].status, 'completed')
  await deletePlanningTask(user.id, task.id)
  assert.equal((await getPlanningTasks(user.id)).length, 0)

  await deleteStrategyDocumentRecord(user.id, document.id)
  assert.equal((await getStrategyDocuments(user.id)).length, 0)
  const activity = await getRecentActivity(user.id)
  assert.ok(activity.some((entry) => entry.type === 'document-deleted'))
  assert.ok(activity.some((entry) => entry.type === 'task-completed'))
  assert.ok(readLocalWorkspace(user.id).strategies.length === 2)

  await demoAuthProvider.updateProfile(user.id, 'Updated name')
  assert.equal((await demoAuthProvider.getCurrentUser()).name, 'Updated name')
})

test('strategy workflow, document drafts, planning links and dashboard source data survive switching and reload reads', async () => {
  storage.clear()
  const auth = await demoAuthProvider.login('workflow@example.com', 'p')
  assert.equal('user' in auth, true)
  const user = auth.user
  const first = createInitialStrategy(user.id)
  first.id = 'workflow-first'
  first.name = 'Market entry'
  first.currentState = {
    situation: 'Small product team',
    resources: 'Two engineers',
    skills: 'Product design',
    constraints: 'Limited budget',
    problems: 'Low awareness',
    opportunities: 'Partner network',
  }
  first.desiredState = {
    destination: 'Enter the regional market',
    successPicture: 'A sustainable customer base',
    indicators: '100 active customers',
    timeframe: 'Within 12 months',
    changes: 'Recurring revenue',
  }
  first.strategicOptions = [{
    id: 'option-one',
    title: 'Partner-led',
    description: 'Launch with regional partners',
    advantages: ['Reach'],
    risks: ['Dependency'],
    requiredResources: ['Partner manager'],
  }]
  first.selectedOptionIds = ['option-one']
  first.plans.A = {
    objective: 'Build distribution',
    approach: 'Recruit partners',
    keyActions: 'Interview candidates',
    risks: 'Slow onboarding',
    resources: 'Partner manager',
  }
  first.plans.B = {
    objective: 'Validate direct demand',
    approach: 'Run a pilot',
    keyActions: 'Recruit pilot users',
    risks: 'Low response',
    resources: 'Research time',
  }
  first.stages = [{
    id: 'stage-research',
    title: 'Research',
    objective: 'Validate demand',
    actions: 'Interview customers',
    expectedResult: 'Validated segment',
    dependencies: 'Interview guide',
  }]
  first.control = {
    metrics: [{ id: 'metric-one', name: 'Active customers', target: '100', currentValue: '0', reviewDate: '2026-12-01' }],
    risks: 'Low conversion',
    warningSigns: 'Fewer than 10 pilot users',
    reviewConditions: 'Review after the pilot',
  }
  first.workflowStep = 5
  first.completed = true
  await createStrategy(first)
  const second = createInitialStrategy(user.id)
  second.id = 'workflow-second'
  second.name = 'Alternative strategy'
  second.currentState.situation = 'Independent situation'
  await createStrategy(second)

  selectActiveStrategy(user.id, first.id)
  await getStrategy(user.id, second.id)
  assert.equal(getCachedActiveStrategy(user.id).id, first.id)
  await updateStrategy({ ...second, description: 'Updated without changing active selection' })
  assert.equal(getCachedActiveStrategy(user.id).id, first.id)
  const strategies = await getStrategies(user.id)
  assert.equal(strategies[0].id, first.id)
  assert.equal(strategies.find((strategy) => strategy.id === first.id).currentState.resources, 'Two engineers')
  assert.equal(strategies.find((strategy) => strategy.id === first.id).plans.B.objective, 'Validate direct demand')
  assert.equal(strategies.find((strategy) => strategy.id === first.id).control.metrics[0].target, '100')
  assert.equal(strategies.find((strategy) => strategy.id === second.id).currentState.situation, 'Independent situation')

  const document = {
    id: 'workflow-document',
    userId: user.id,
    title: 'Market entry brief',
    content: createStrategyDocumentContent(first),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ready',
    strategy: first,
  }
  await createStrategyDocumentRecord(document)
  await saveStrategyDocumentDraft(user.id, document.id, 'Uncommitted text that must survive navigation and reload.')
  const reloadedDraft = (await getStrategyDocuments(user.id))[0]
  assert.equal(reloadedDraft.content, document.content)
  assert.equal(reloadedDraft.draftContent, 'Uncommitted text that must survive navigation and reload.')
  await updateStrategyDocumentRecord(user.id, document.id, reloadedDraft.draftContent)
  assert.equal((await getStrategyDocuments(user.id))[0].draftContent, undefined)
  assert.equal((await getStrategyDocuments(user.id))[0].content, 'Uncommitted text that must survive navigation and reload.')
  await saveStrategyDocumentDraft(user.id, document.id, 'Discard this edit.')
  await discardStrategyDocumentDraft(user.id, document.id)
  assert.equal((await getStrategyDocuments(user.id))[0].draftContent, undefined)
  const generatedDocument = {
    ...document,
    id: 'workflow-generated-document',
    title: 'Generated brief',
    content: createStrategyDocumentContent(first),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ready',
  }
  await createStrategyDocumentRecord(generatedDocument)

  const firstTask = await createPlanningTask({
    userId: user.id,
    strategyId: first.id,
    stageId: 'stage-plans',
    sourceStagePlanId: 'stage-research',
    title: 'Interview customers',
    description: 'Validate the target segment.',
    status: 'todo',
    priority: 'high',
    deadline: '2026-12-01',
  })
  await createPlanningTask({
    userId: user.id,
    strategyId: second.id,
    stageId: 'stage-current-state',
    title: 'Separate strategy task',
    description: 'Belongs only to the alternative strategy.',
    status: 'in-progress',
    priority: 'medium',
    deadline: '2026-12-02',
  })
  assert.deepEqual((await getPlanningTasks(user.id, first.id)).map((task) => task.id), [firstTask.id])
  assert.equal((await getPlanningTasks(user.id, second.id)).length, 1)

  const dashboardData = readLocalWorkspace(user.id)
  assert.equal(dashboardData.strategies.length, 2)
  assert.equal(dashboardData.documents.length, 2)
  assert.equal(dashboardData.tasks.length, 2)
  assert.ok(dashboardData.activities.some((activity) => activity.type === 'document-generated'))

  await updateStrategy({ ...first, desiredState: { ...first.desiredState, destination: 'Updated dashboard goal' } })
  assert.equal(readLocalWorkspace(user.id).strategies.find((strategy) => strategy.id === first.id).desiredState.destination, 'Updated dashboard goal')
  const updatedDocuments = await getStrategyDocuments(user.id)
  const updatedGeneratedDocument = updatedDocuments.find((entry) => entry.id === generatedDocument.id)
  const updatedEditedDocument = updatedDocuments.find((entry) => entry.id === document.id)
  const updatedStrategy = readLocalWorkspace(user.id).strategies.find((strategy) => strategy.id === first.id)
  assert.equal(updatedGeneratedDocument.content, createStrategyDocumentContent(updatedStrategy))
  assert.equal(updatedGeneratedDocument.strategy.desiredState.destination, 'Updated dashboard goal')
  assert.equal(updatedEditedDocument.content, 'Uncommitted text that must survive navigation and reload.')
  assert.equal(updatedEditedDocument.strategy.desiredState.destination, 'Updated dashboard goal')
  await deleteStrategy(user.id, second.id)
  assert.equal((await getPlanningTasks(user.id)).length, 1)
  assert.equal(readLocalWorkspace(user.id).strategies.length, 1)
})

test('local workspace failures are surfaced and corrupted records are not overwritten', async () => {
  storage.clear()
  const auth = await demoAuthProvider.login('storage@example.com', 'p')
  assert.equal('user' in auth, true)
  const strategy = createInitialStrategy(auth.user.id)
  strategy.name = 'Original'
  await createStrategy(strategy)
  const document = {
    id: 'storage-failure-document',
    userId: auth.user.id,
    title: 'Saved document',
    content: 'Committed content',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ready',
    strategy,
  }
  await createStrategyDocumentRecord(document)
  storage.failWrites = true
  await assert.rejects(updateStrategy({ ...strategy, name: 'Not saved' }), /Browser storage is full/)
  await assert.rejects(saveStrategyDocumentDraft(auth.user.id, document.id, 'Draft not saved'), /Browser storage is full/)
  storage.failWrites = false
  assert.equal((await getStrategies(auth.user.id))[0].name, 'Original')
  assert.equal((await getStrategyDocuments(auth.user.id))[0].content, 'Committed content')
  assert.equal((await getStrategyDocuments(auth.user.id))[0].draftContent, undefined)

  const key = `stravio:user:${encodeURIComponent(auth.user.id)}:workspace.v1`
  storage.setItem(key, '{broken')
  await assert.rejects(getStrategies(auth.user.id), /unreadable and was left untouched/)
  assert.equal(storage.getItem(key), '{broken')
})

test('deleting a strategy removes only its linked local records', async () => {
  storage.clear()
  const auth = await demoAuthProvider.login('delete@example.com', 'p')
  assert.equal('user' in auth, true)
  const first = createInitialStrategy(auth.user.id)
  first.name = 'First'
  await createStrategy(first)
  const second = createInitialStrategy(auth.user.id)
  second.id = 'second-delete-test'
  second.name = 'Second'
  await createStrategy(second)
  await updateLocalWorkspace(auth.user.id, (workspace) => {
    workspace.chats[first.id] = []
  })
  await deleteStrategy(auth.user.id, first.id)
  assert.deepEqual((await getStrategies(auth.user.id)).map((entry) => entry.id), [second.id])
  assert.equal(readLocalWorkspace(auth.user.id).chats[first.id], undefined)
})

test('AI history and accepted proposals are stored locally without a database call', async () => {
  storage.clear()
  const auth = await demoAuthProvider.login('assistant@example.com', 'p')
  assert.equal('user' in auth, true)
  const strategy = createInitialStrategy(auth.user.id)
  strategy.id = 'ai-strategy'
  strategy.desiredState.destination = 'Previous goal'
  await createStrategy(strategy)
  const proposal = {
    id: 'proposal-one',
    kind: 'update-desired-state',
    status: 'pending',
    userId: auth.user.id,
    strategyId: strategy.id,
    previousValue: 'Previous goal',
    proposedValue: 'Updated goal',
  }
  const message = {
    id: 'message-one',
    userId: auth.user.id,
    strategyId: strategy.id,
    role: 'agent',
    content: 'Suggested change',
    createdAt: new Date().toISOString(),
    proposal,
  }
  await updateLocalWorkspace(auth.user.id, (workspace) => {
    workspace.chats[strategy.id] = [message]
  })
  assert.equal((await getStrategyMessages(auth.user.id, strategy.id)).length, 1)
  await resolveAgentProposal(auth.user.id, strategy.id, message.id, 'apply')
  assert.equal((await getStrategies(auth.user.id))[0].desiredState.destination, 'Updated goal')
  assert.equal((await getStrategyMessages(auth.user.id, strategy.id))[0].proposal.status, 'applied')
  await clearStrategyMessages(auth.user.id, strategy.id)
  assert.deepEqual(await getStrategyMessages(auth.user.id, strategy.id), [])
})

test('Demo Mode rejects Google OAuth and password reset without calling Supabase Auth', async () => {
  const googleResult = await demoAuthProvider.continueWithGoogle()
  assert.match(googleResult.error, /unavailable in temporary local Demo Mode/)
  const resetResult = await demoAuthProvider.requestPasswordReset('test@example.com')
  assert.match(resetResult.error, /Password reset emails are unavailable/)
})

test('Planning date filters include correct local calendar boundaries', () => {
  const { getWeekBounds, matchesPlanningDate, shiftDate } = dateFilters
  const today = '2027-01-03'
  const { weekStart, weekEnd } = getWeekBounds(today)
  assert.equal(weekStart, '2026-12-28')
  assert.equal(weekEnd, '2027-01-03')
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01')
  assert.equal(matchesPlanningDate(today, 'today', today, weekStart, weekEnd, '2027-01', null), true)
  assert.equal(matchesPlanningDate('2027-01-04', 'tomorrow', today, weekStart, weekEnd, '2027-01', null), true)
  assert.equal(matchesPlanningDate(weekStart, 'week', today, weekStart, weekEnd, '2027-01', null), true)
  assert.equal(matchesPlanningDate(weekEnd, 'week', today, weekStart, weekEnd, '2027-01', null), true)
  assert.equal(matchesPlanningDate('2027-01-04', 'week', today, weekStart, weekEnd, '2027-01', null), false)
  assert.equal(matchesPlanningDate('2027-01-31', 'month', today, weekStart, weekEnd, '2027-01', null), true)
  assert.equal(matchesPlanningDate('2027-02-01', 'month', today, weekStart, weekEnd, '2027-01', null), false)
  assert.equal(matchesPlanningDate('2027-01-31', 'month', today, weekStart, weekEnd, '2027-01', '2027-01-31'), true)
  assert.equal(matchesPlanningDate('2027-01-30', 'month', today, weekStart, weekEnd, '2027-01', '2027-01-31'), false)
  assert.equal(matchesPlanningDate('2026-02-29', 'month', today, weekStart, weekEnd, '2026-02', null), false)
  assert.equal(matchesPlanningDate('', 'today', today, weekStart, weekEnd, '2027-01', null), false)
  assert.equal(matchesPlanningDate('', 'all', today, weekStart, weekEnd, '2027-01', null), true)
})

test('AI context carries the selected strategy, active stage, document and only linked tasks', () => {
  const strategy = createInitialStrategy('agent-context-user')
  strategy.id = 'context-strategy'
  strategy.workflowStep = 4
  const otherStrategy = { ...strategy, id: 'other-context-strategy' }
  const currentDocument = {
    id: 'context-document',
    userId: strategy.userId,
    title: 'Stage plan',
    content: 'Current strategy details',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ready',
    strategy,
  }
  const context = createAgentContext({
    userId: strategy.userId,
    strategy,
    language: 'kk',
    hasActiveStrategy: true,
    activeView: 'Documents',
    currentDocument,
    documents: [currentDocument, { ...currentDocument, id: 'other-document', strategy: otherStrategy }],
    tasks: [
      { userId: strategy.userId, id: 'linked-task', strategyId: strategy.id, stageId: 'stage-plans', title: 'Linked', description: '', status: 'todo', priority: 'medium', deadline: '', createdAt: '' },
      { userId: strategy.userId, id: 'other-task', strategyId: otherStrategy.id, stageId: 'stage-plans', title: 'Other', description: '', status: 'todo', priority: 'medium', deadline: '', createdAt: '' },
    ],
  })
  assert.equal(context.strategy.workflowStep, 4)
  assert.equal(context.language, 'kk')
  assert.equal(context.currentDocument.id, currentDocument.id)
  assert.deepEqual(context.tasks.map((task) => task.id), ['linked-task'])
  assert.deepEqual(context.documents.map((document) => document.id), ['context-document'])

  const emptyContext = createAgentContext({ ...context, hasActiveStrategy: false })
  assert.deepEqual(emptyContext.tasks, [])
})
