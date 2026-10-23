import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorState, LoadingState } from '@/components/states'
import type { Role } from '@/lib/types'
import { homePath, useAuth } from './auth-context'

interface RequireAuthProps {
  /** Only this role may enter; others are sent to their own home view (FR-AUTH-02). */
  role?: Role
  /** The change-password page itself must stay reachable while a change is pending. */
  allowPendingPasswordChange?: boolean
}

export function RequireAuth({ role, allowPendingPasswordChange = false }: RequireAuthProps) {
  const { user, isLoading, error } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingState className="p-8" />
  if (!user) {
    if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} className="p-8" />
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  // FR-AUTH-04: a temporary password must be replaced before doing anything else.
  if (user.mustChangePassword && !allowPendingPasswordChange) {
    return <Navigate to="/change-password" replace />
  }
  if (role && user.role !== role) return <Navigate to={homePath(user.role)} replace />

  return <Outlet />
}
