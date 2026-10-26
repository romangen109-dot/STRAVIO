export function logClientError(scope: string, error: unknown) {
  if (import.meta.env.DEV) console.error(`[stravio] ${scope}`, error)
}

export function userFacingError(error: unknown, fallback: string) {
  if (error instanceof Error && /local workspace|local profile|browser storage|saved .* data/i.test(error.message)) return error.message
  return fallback
}
