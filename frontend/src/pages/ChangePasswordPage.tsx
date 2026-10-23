import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppLayout } from '@/components/AppLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { authKeys, useChangePassword } from '@/api/auth'
import { homePath, useAuth } from '@/auth/auth-context'
import { getErrorMessage, getFieldErrors } from '@/lib/api'

/** FR-AUTH-05 password rules, checked here too so mistakes show before submitting. */
function passwordProblem(password: string, current: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (password.length > 72) return 'Password must be at most 72 characters'
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number'
  if (password === current) return 'New password must be different from the current password'
  return null
}

/** FR-AUTH-04/05: forced after a temporary password, and available any time from the user menu. */
export function ChangePasswordPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const changePassword = useChangePassword()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!user) return null
  const forced = user.mustChangePassword

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const found: Record<string, string> = {}
    if (!currentPassword) found.currentPassword = 'Current password is required'
    const problem = passwordProblem(newPassword, currentPassword)
    if (problem) found.newPassword = problem
    if (confirmPassword !== newPassword) found.confirmPassword = 'Passwords do not match'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: authKeys.me })
          toast.success('Your password has been changed')
          navigate(homePath(user.role), { replace: true })
        },
        onError: (error) => setErrors(getFieldErrors(error)),
      },
    )
  }

  const form = (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">{forced ? 'Set a new password' : 'Change password'}</CardTitle>
        <CardDescription>
          {forced
            ? 'You logged in with a temporary password. Choose your own password to continue.'
            : 'Enter your current password and choose a new one.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {changePassword.isError && !Object.keys(getFieldErrors(changePassword.error)).length && (
              <Alert variant="destructive">
                <AlertTitle>Password not changed</AlertTitle>
                <AlertDescription>{getErrorMessage(changePassword.error)}</AlertDescription>
              </Alert>
            )}
            <PasswordField
              id="currentPassword"
              label={forced ? 'Temporary password' : 'Current password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
              error={errors.currentPassword}
            />
            <PasswordField
              id="newPassword"
              label="New password"
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
              error={errors.newPassword}
              description="At least 8 characters, with letters and numbers."
            />
            <PasswordField
              id="confirmPassword"
              label="Confirm new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={errors.confirmPassword}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? 'Saving…' : 'Change password'}
              </Button>
              {forced ? (
                <Button type="button" variant="ghost" onClick={() => void signOut()}>
                  Log out
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
              )}
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )

  // While a change is forced the rest of the app is off limits, so the form stands alone.
  return forced ? (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">{form}</div>
  ) : (
    <AppLayout>
      <div className="flex justify-center">{form}</div>
    </AppLayout>
  )
}

interface PasswordFieldProps {
  id: string
  label: string
  autoComplete: string
  value: string
  onChange: (value: string) => void
  error?: string
  description?: string
}

function PasswordField({ id, label, autoComplete, value, onChange, error, description }: PasswordFieldProps) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {description && !error && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  )
}
