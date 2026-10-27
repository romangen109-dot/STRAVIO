import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
}

let i18n
let vite
let userDataStorageKey

before(async () => {
  const { createServer } = await import('vite')
  vite = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true }, appType: 'custom' })
  i18n = await vite.ssrLoadModule('/src/i18n.tsx')
  ;({ userDataStorageKey } = await vite.ssrLoadModule('/src/data/storage.ts'))
})

after(async () => {
  await vite?.close()
})

test('language preference defaults to Russian and safely restores supported choices', () => {
  const storage = new MemoryStorage()
  assert.equal(i18n.readLanguage(storage), 'ru')
  storage.setItem(i18n.languageStorageKey, 'kk')
  assert.equal(i18n.readLanguage(storage), 'kk')
  storage.setItem(i18n.languageStorageKey, 'fr')
  assert.equal(i18n.readLanguage(storage), 'ru')
})

test('language selection persists independently without modifying workspace data', () => {
  const storage = new MemoryStorage()
  const workspaceKey = userDataStorageKey('localization-test', 'workspace')
  storage.setItem(workspaceKey, '{"strategies":[{"id":"s1"}],"documents":[{"id":"d1"}],"tasks":[{"id":"t1"}]}')
  i18n.storeLanguage('en', storage)
  assert.equal(i18n.readLanguage(storage), 'en')
  assert.equal(storage.getItem(workspaceKey), '{"strategies":[{"id":"s1"}],"documents":[{"id":"d1"}],"tasks":[{"id":"t1"}]}')
  i18n.storeLanguage('kk', storage)
  assert.equal(i18n.readLanguage(storage), 'kk')
})

test('translations interpolate values and dates follow the selected locale', () => {
  assert.equal(i18n.translate('Stage {number}', 'ru', { number: 2 }), 'Этап 2')
  assert.equal(i18n.translate('Stage {number}', 'kk', { number: 2 }), '2-кезең')
  assert.notEqual(
    i18n.formatDateForLanguage('2025-01-02', 'en'),
    i18n.formatDateForLanguage('2025-01-02', 'ru'),
  )
  assert.notEqual(
    i18n.formatDateForLanguage('2025-01-02', 'ru'),
    i18n.formatDateForLanguage('2025-01-02', 'kk'),
  )
})
