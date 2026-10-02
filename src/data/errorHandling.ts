export function logClientError(scope: string, error: unknown) {
  if (import.meta.env.DEV) console.error(`[stravio] ${scope}`, error)
}
