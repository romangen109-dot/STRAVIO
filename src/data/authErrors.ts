export function authErrorMessageForCode(code: string | undefined): string | undefined {
  if (!code) return undefined
  if (code === 'invalid_credentials') return 'Email or password is incorrect. If you have not confirmed your email, check your inbox first.'
  if (code === 'email_not_confirmed') return 'Confirm your email using the link we sent, then sign in.'
  if (code === 'weak_password' || code === 'password_too_short') return 'Choose a stronger password and try again.'
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || code === 'too_many_requests') return 'Too many attempts. Wait a moment and try again.'
  if (code === 'user_already_exists' || code === 'email_exists') return 'An account with this email may already exist. Try signing in or reset its password.'
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'Enter a valid email address and check the required fields.'
  if (code === 'same_password') return 'Choose a password different from your current password.'
  if (code === 'otp_expired') return 'This authentication link has expired or already been used. Request a new password reset email.'
  if (code === 'access_denied') return 'This authentication link could not be verified. Request a new link and try again.'
  return undefined
}

export function authRedirectError(search: string, hash: string): string | undefined {
  const searchParams = new URLSearchParams(search)
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
  const code = searchParams.get('error_code')
    ?? hashParams.get('error_code')
    ?? searchParams.get('error')
    ?? hashParams.get('error')
  if (!code) return undefined
  return authErrorMessageForCode(code) ?? 'This authentication link could not be verified. Request a new link and try again.'
}

export function isPasswordRecoveryRequested(search: string, hash: string): boolean {
  return new URLSearchParams(search).get('flow') === 'recovery'
    && !authRedirectError(search, hash)
}

export function authRedirectUrls(origin: string) {
  return {
    emailConfirmation: new URL('/', origin).toString(),
    passwordRecovery: new URL('/?flow=recovery', origin).toString(),
  }
}
