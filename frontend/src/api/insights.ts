import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CountryInsights, InsightsOverview, JobTitleInsights } from '@/lib/types'

export function useInsightsOverview() {
  return useQuery({
    queryKey: ['insights', 'overview'],
    queryFn: async () => (await api.get<InsightsOverview>('/insights/overview')).data,
  })
}

export function useCountryInsights(code: string | undefined) {
  return useQuery({
    queryKey: ['insights', 'country', code],
    queryFn: async () => (await api.get<CountryInsights>(`/insights/countries/${code}`)).data,
    enabled: !!code,
  })
}

export function useJobTitleInsights(code: string | undefined) {
  return useQuery({
    queryKey: ['insights', 'job-titles', code],
    queryFn: async () =>
      (await api.get<JobTitleInsights>(`/insights/countries/${code}/job-titles`)).data,
    enabled: !!code,
  })
}
