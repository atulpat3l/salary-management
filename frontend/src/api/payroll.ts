import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Page, PayrollInput, PayrollRun, PayslipDetail, PayslipSummary } from '@/lib/types'

export interface RunPayslipParams {
  flagged?: boolean
  country?: string
  page?: number
  pageSize?: number
}

export interface MonthlyInputValues {
  employeeId: number
  overtimeHours: string
  bonus: string
  achievementPct: string
}

export const payrollKeys = {
  all: ['payroll-runs'] as const,
  run: (id: number) => ['payroll-runs', id] as const,
  inputs: (id: number) => ['payroll-runs', id, 'inputs'] as const,
  payslips: (id: number, params: RunPayslipParams) => ['payroll-runs', id, 'payslips', params] as const,
  payslip: (id: number, payslipId: number) => ['payroll-runs', id, 'payslip', payslipId] as const,
}

export function usePayrollRuns() {
  return useQuery({
    queryKey: payrollKeys.all,
    queryFn: async () => (await api.get<PayrollRun[]>('/payroll-runs')).data,
  })
}

export function usePayrollRun(id: number) {
  return useQuery({
    queryKey: payrollKeys.run(id),
    queryFn: async () => (await api.get<PayrollRun>(`/payroll-runs/${id}`)).data,
  })
}

export function useRunInputs(id: number) {
  return useQuery({
    queryKey: payrollKeys.inputs(id),
    queryFn: async () => (await api.get<PayrollInput[]>(`/payroll-runs/${id}/inputs`)).data,
  })
}

export function useRunPayslips(id: number, params: RunPayslipParams) {
  return useQuery({
    queryKey: payrollKeys.payslips(id, params),
    queryFn: async () =>
      (await api.get<Page<PayslipSummary>>(`/payroll-runs/${id}/payslips`, { params })).data,
    placeholderData: keepPreviousData,
  })
}

export function useRunPayslip(id: number, payslipId: number | null) {
  return useQuery({
    queryKey: payrollKeys.payslip(id, payslipId ?? 0),
    queryFn: async () =>
      (await api.get<PayslipDetail>(`/payroll-runs/${id}/payslips/${payslipId}`)).data,
    enabled: payslipId !== null,
  })
}

export function useCreateRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (month: string) =>
      (await api.post<PayrollRun>('/payroll-runs', { month })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: payrollKeys.all }),
  })
}

// Calculate, finalise and disburse return the updated run and change its payslips, so each
// refreshes everything about payroll runs.

export function useCalculateRun(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => (await api.post<PayrollRun>(`/payroll-runs/${id}/calculate`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: payrollKeys.all }),
  })
}

export function useFinaliseRun(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => (await api.post<PayrollRun>(`/payroll-runs/${id}/finalise`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: payrollKeys.all }),
  })
}

export function useDisburseRun(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (paymentDate: string) =>
      (await api.post<PayrollRun>(`/payroll-runs/${id}/disburse`, { paymentDate })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: payrollKeys.all }),
  })
}

export function useSaveInputs(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (inputs: MonthlyInputValues[]) =>
      (await api.put<{ saved: number }>(`/payroll-runs/${id}/inputs`, { inputs })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: payrollKeys.inputs(id) }),
  })
}
