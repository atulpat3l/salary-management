import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  Country,
  EmployeeDetail,
  EmployeeInput,
  EmployeeListItem,
  Page,
  PayBreakdown,
} from '@/lib/types'

export interface EmployeeListParams {
  q?: string
  country?: string
  jobTitle?: string
  status?: string
  sort?: 'employeeCode' | 'name' | 'salary'
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export const employeeKeys = {
  all: ['employees'] as const,
  list: (params: EmployeeListParams) => ['employees', 'list', params] as const,
  detail: (id: number) => ['employees', 'detail', id] as const,
  jobTitles: (country?: string) => ['employees', 'job-titles', country ?? 'all'] as const,
}

export function useCountries() {
  return useQuery({
    queryKey: ['countries'],
    queryFn: async () => (await api.get<Country[]>('/countries')).data,
    staleTime: Infinity, // reference data does not change at runtime
  })
}

export function useEmployees(params: EmployeeListParams, { enabled = true } = {}) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: async () => (await api.get<Page<EmployeeListItem>>('/employees', { params })).data,
    placeholderData: keepPreviousData, // keep the table on screen while the next page loads
    enabled,
  })
}

export function useEmployee(id: number) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: async () => (await api.get<EmployeeDetail>(`/employees/${id}`)).data,
  })
}

export function useJobTitles(country?: string) {
  return useQuery({
    queryKey: employeeKeys.jobTitles(country),
    queryFn: async () =>
      (await api.get<string[]>('/employees/job-titles', { params: { country } })).data,
  })
}

/** FR-EMP-06: the standard monthly salary for values not saved yet. */
export function useSalaryPreview(
  input: { countryCode: string; annualBaseSalary: string; structureId: number } | null,
) {
  return useQuery({
    queryKey: ['employees', 'salary-preview', input],
    queryFn: async () =>
      (
        await api.post<{ currency: string; standardMonthlySalary: PayBreakdown }>(
          '/employees/salary-preview',
          input,
        )
      ).data,
    enabled: input !== null,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: EmployeeInput) =>
      (await api.post<{ employee: EmployeeDetail; temporaryPassword: string }>('/employees', input))
        .data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
  })
}

export function useUpdateEmployee(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<EmployeeInput>) =>
      (await api.patch<EmployeeDetail>(`/employees/${id}`, input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
  })
}

export function useDeactivateEmployee(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => (await api.post<EmployeeDetail>(`/employees/${id}/deactivate`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
  })
}

export function useResetPassword(id: number) {
  return useMutation({
    mutationFn: async () =>
      (await api.post<{ temporaryPassword: string }>(`/employees/${id}/reset-password`)).data,
  })
}
