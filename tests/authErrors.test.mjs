import assert from 'node:assert/strict'
import test from 'node:test'
import { authErrorMessageForCode, authRedirectError, authRedirectUrls, isPasswordRecoveryRequested } from '../src/data/authErrors.ts'

test('maps common Supabase authentication failures to actionable messages', () => {
  assert.match(authErrorMessageForCode('invalid_credentials'), /Email or password is incorrect/)
  assert.match(authErrorMessageForCode('email_not_confirmed'), /Confirm your email/)
  assert.match(authErrorMessageForCode('user_already_exists'), /may already exist/)
  assert.match(authErrorMessageForCode('weak_password'), /stronger password/)
  assert.match(authErrorMessageForCode('otp_expired'), /expired or already been used/)
})

test('reads callback errors from query parameters and URL fragments', () => {
  assert.match(authRedirectError('?error=access_denied&error_code=otp_expired', ''), /expired or already been used/)
  assert.match(authRedirectError('', '#error=access_denied'), /could not be verified/)
  assert.equal(authRedirectError('?flow=recovery', ''), undefined)
})

test('creates allowed absolute email and recovery redirects for production and localhost', () => {
  assert.deepEqual(authRedirectUrls('https://stravio.vercel.app'), {
    emailConfirmation: 'https://stravio.vercel.app/',
    passwordRecovery: 'https://stravio.vercel.app/?flow=recovery',
  })
  assert.deepEqual(authRedirectUrls('http://localhost:5173'), {
    emailConfirmation: 'http://localhost:5173/',
    passwordRecovery: 'http://localhost:5173/?flow=recovery',
  })
})

test('recognizes the explicit recovery route and rejects a provider-error callback', () => {
  assert.equal(isPasswordRecoveryRequested('?flow=recovery', ''), true)
  assert.equal(isPasswordRecoveryRequested('?flow=recovery&error=access_denied', ''), false)
  assert.equal(isPasswordRecoveryRequested('', '#access_token=token&type=recovery'), false)
})

test('does not expose arbitrary provider error descriptions', () => {
  assert.equal(
    authRedirectError('?error=unexpected&error_description=internal+details', ''),
    'This authentication link could not be verified. Request a new link and try again.',
  )
})
