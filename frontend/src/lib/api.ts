import axios, { isAxiosError } from 'axios'

const TOKEN_KEY = 'salary-management.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let onSessionEnded: (() => void) | null = null

/** Registers what happens when the server rejects our token (expired or logged out elsewhere). */
export function setSessionEndedHandler(handler: (() => void) | null) {
  onSessionEnded = handler
}

api.interceptors.response.use(undefined, (error) => {
  // A 401 on a request that carried a token means the session is gone. A 401 from the
  // login form itself (wrong password) has no token and is left to the form.
  if (isAxiosError(error) && error.response?.status === 401 && error.config?.headers.Authorization) {
    onSessionEnded?.()
  }
  return Promise.reject(error)
})

/** The API's error shape: `{ error: { code, message, fields? } }`. */
interface ApiErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string> }
}

function errorBody(error: unknown) {
  return isAxiosError<ApiErrorBody>(error) ? error.response?.data?.error : undefined
}

export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error) && !error.response) return 'Cannot reach the server. Check your connection.'
  return errorBody(error)?.message ?? 'Something went wrong'
}

export function getErrorCode(error: unknown): string | undefined {
  return errorBody(error)?.code
}

/** Per-field messages, keyed by field name, e.g. `{ fullName: 'Full name is required' }`. */
export function getFieldErrors(error: unknown): Record<string, string> {
  return errorBody(error)?.fields ?? {}
}

export function getStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}
