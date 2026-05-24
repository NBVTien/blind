import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { Wheel, AttachedAction } from '@blind/shared'
import { queryKeys } from './query-keys'

export function useWheels() {
  return useQuery<Wheel[]>({
    queryKey: queryKeys.wheels(),
    queryFn: () => api.get('/api/wheels').then(r => r.data),
  })
}

export function useWheel(id: number) {
  return useQuery<Wheel>({
    queryKey: queryKeys.wheel(id),
    queryFn: () => api.get(`/api/wheels/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateWheel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; entries: { label: string; weight: number }[] }) =>
      api.post('/api/wheels', body).then(r => r.data as Wheel),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.wheels() }),
  })
}

export function useUpdateWheel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; entries?: { label: string; weight: number; actions?: AttachedAction[] }[] }) =>
      api.patch(`/api/wheels/${id}`, body).then(r => r.data as Wheel),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.wheel(data.id), data)
      qc.invalidateQueries({ queryKey: queryKeys.wheels() })
    },
  })
}

export function useDeleteWheel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/wheels/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.wheels() }),
  })
}
