import { createContext, useContext } from 'react'
import type { Role, User } from '@/lib/types'

export interface AuthState {
  user: User | null
  /** True while the stored token is being checked on first load. */
  isLoading: boolean
  /** Set when the current user could not be loaded for a reason other than a bad token. */
  error: unknown
  signIn: (token: string, user: User) => void
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth() must be used inside <AuthProvider>')
  return auth
}

/** FR-AUTH-01: HR lands on Employees, an employee on My Payslips. */
export function homePath(role: Role): string {
  return role === 'HR' ? '/employees' : '/payslips'
}
