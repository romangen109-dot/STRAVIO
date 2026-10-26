import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'

let demoAuthProvider
let createStrategyDocumentRecord
let deleteStrategyDocumentRecord
let getStrategyDocuments
let renameStrategyDocumentRecord
let updateStrategyDocumentRecord
let getRecentActivity
let createPlanningTask
let deletePlanningTask
let getPlanningTasks
let updatePlanningTask
let createStrategy
let deleteStrategy
let getStrategies
let updateStrategy
let createInitialStrategy
let readLocalWorkspace
let updateLocalWorkspace
let clearStrategyMessages
let getStrategyMessages
let resolveAgentProposal

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
  ;({ createStrategyDocumentRecord, deleteStrategyDocumentRecord, getStrategyDocuments, renameStrategyDocumentRecord, updateStrategyDocumentRecord } = await vite.ssrLoadModule('/src/data/documentService.ts'))
  ;({ getRecentActivity } = await vite.ssrLoadModule('/src/data/activityService.ts'))
  ;({ createPlanningTask, deletePlanningTask, getPlanningTasks, updatePlanningTask } = await vite.ssrLoadModule('/src/data/taskService.ts'))
  ;({ createStrategy, deleteStrategy, getStrategies, updateStrategy } = await vite.ssrLoadModule('/src/data/strategyService.ts'))
  ;({ createInitialStrategy } = await vite.ssrLoadModule('/src/data/strategyAlgorithm.ts'))
  ;({ readLocalWorkspace, updateLocalWorkspace } = await vite.ssrLoadModule('/src/data/localWorkspace.ts'))
  ;({ clearStrategyMessages, getStrategyMessages, resolveAgentProposal } = await vite.ssrLoadModule('/src/data/chatService.ts'))
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

test('local workspace failures are surfaced and corrupted records are not overwritten', async () => {
  storage.clear()
  const auth = await demoAuthProvider.login('storage@example.com', 'p')
  assert.equal('user' in auth, true)
  const strategy = createInitialStrategy(auth.user.id)
  strategy.name = 'Original'
  await createStrategy(strategy)
  storage.failWrites = true
  await assert.rejects(updateStrategy({ ...strategy, name: 'Not saved' }), /Browser storage is full/)
  storage.failWrites = false
  assert.equal((await getStrategies(auth.user.id))[0].name, 'Original')

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
