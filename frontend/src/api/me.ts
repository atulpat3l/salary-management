import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Disbursement, MyPayslip, MyProfile, PayslipDetail } from '@/lib/types'

// Employee self-service: the server always answers for the logged-in employee.

export function useMyProfile() {
  return useQuery({
    queryKey: ['me', 'profile'],
    queryFn: async () => (await api.get<MyProfile>('/me')).data,
  })
}

export function useMyPayslips() {
  return useQuery({
    queryKey: ['me', 'payslips'],
    queryFn: async () => (await api.get<MyPayslip[]>('/me/payslips')).data,
  })
}

export function useMyPayslip(id: number) {
  return useQuery({
    queryKey: ['me', 'payslips', id],
    queryFn: async () => (await api.get<PayslipDetail>(`/me/payslips/${id}`)).data,
  })
}

export function useMyDisbursements() {
  return useQuery({
    queryKey: ['me', 'disbursements'],
    queryFn: async () => (await api.get<Disbursement[]>('/me/disbursements')).data,
  })
}
