import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Structure } from '@/lib/types'

/** Structures are predefined and fixed (FR-STR-01), so they are cached for the session. */
export function useStructures(country?: string) {
  return useQuery({
    queryKey: ['structures', country ?? 'all'],
    queryFn: async () => (await api.get<Structure[]>('/structures', { params: { country } })).data,
    staleTime: Infinity,
  })
}
