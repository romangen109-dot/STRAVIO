import { createContext, useContext, type ReactNode } from 'react'
import type { User } from '../../types'

const CurrentUserContext = createContext<User | null>(null)

export function CurrentUserProvider({ user, children }: { user: User; children: ReactNode }) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>
}

export function useCurrentUser() {
  const user = useContext(CurrentUserContext)
  if (!user) throw new Error('User-scoped data requires an authenticated user.')
  return user
}
