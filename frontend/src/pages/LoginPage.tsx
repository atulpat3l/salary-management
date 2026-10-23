import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { WalletIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useLogin } from '@/api/auth'
import { homePath, useAuth } from '@/auth/auth-context'
import { getErrorMessage } from '@/lib/api'

/** FR-AUTH-01: log in with Employee ID (or HR ID) and password. */
export function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')

  if (user) return <Navigate to={homePath(user.role)} replace />

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate(
      { loginId, password },
      {
        onSuccess: ({ token, user }) => {
          signIn(token, user)
          const from = (location.state as { from?: string } | null)?.from
          if (user.mustChangePassword) navigate('/change-password', { replace: true })
          else navigate(from && from !== '/' ? from : homePath(user.role), { replace: true })
        },
      },
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <WalletIcon className="size-5" aria-hidden />
            Salary Management
          </div>
          <CardTitle className="text-xl">Log in</CardTitle>
          <CardDescription>Use your Employee ID and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              {login.isError && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{getErrorMessage(login.error)}</AlertDescription>
                </Alert>
              )}
              <Field>
                <FieldLabel htmlFor="loginId">Employee ID</FieldLabel>
                <Input
                  id="loginId"
                  autoComplete="username"
                  placeholder="e.g. EMP00001"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
              <Button type="submit" disabled={login.isPending || !loginId.trim() || !password}>
                {login.isPending ? 'Logging in…' : 'Log in'}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
