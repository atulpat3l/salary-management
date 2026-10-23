import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'

export const authKeys = { me: ['auth', 'me'] as const }

export async function fetchCurrentUser() {
  return (await api.get<User>('/auth/me')).data
}

export function useLogin() {
  return useMutation({
    mutationFn: async (input: { loginId: string; password: string }) =>
      (await api.post<{ token: string; user: User }>('/auth/login', input)).data,
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api.post('/auth/change-password', input),
  })
}

export function logoutRequest() {
  return api.post('/auth/logout')
}
