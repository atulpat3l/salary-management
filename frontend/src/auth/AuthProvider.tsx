import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authKeys, fetchCurrentUser, logoutRequest } from '@/api/auth'
import { getToken, setSessionEndedHandler, setToken } from '@/lib/api'
import type { User } from '@/lib/types'
import { AuthContext, type AuthState } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setTokenState] = useState(getToken)

  const me = useQuery({
    queryKey: authKeys.me,
    queryFn: fetchCurrentUser,
    enabled: token !== null,
    staleTime: Infinity,
  })

  /** Forgets the token and every cached response, so nothing from this session is shown again. */
  const endSession = useCallback(() => {
    setToken(null)
    setTokenState(null)
    queryClient.clear()
  }, [queryClient])

  // FR-AUTH-03: the server ends idle sessions; the next request then gets a 401.
  useEffect(() => {
    setSessionEndedHandler(() => {
      toast.error('Your session has ended. Please log in again.', { id: 'session-ended' })
      endSession()
    })
    return () => setSessionEndedHandler(null)
  }, [endSession])

  const signIn = useCallback(
    (newToken: string, user: User) => {
      setToken(newToken)
      queryClient.setQueryData(authKeys.me, user)
      setTokenState(newToken)
    },
    [queryClient],
  )

  const signOut = useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      // The session ends locally either way.
    }
    endSession()
  }, [endSession])

  const value = useMemo<AuthState>(
    () => ({
      user: token ? (me.data ?? null) : null,
      isLoading: token !== null && me.isPending,
      error: me.error,
      signIn,
      signOut,
    }),
    [token, me.data, me.isPending, me.error, signIn, signOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
