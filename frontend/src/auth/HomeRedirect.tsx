import { Navigate } from 'react-router'
import { LoadingState } from '@/components/states'
import { homePath, useAuth } from './auth-context'

/** "/" sends each role to its home view (FR-AUTH-01). */
export function HomeRedirect() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <LoadingState className="p-8" />
  return <Navigate to={user ? homePath(user.role) : '/login'} replace />
}
