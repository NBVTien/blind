import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { Item, AttachedAction } from '@blind/shared'
import { queryKeys } from './query-keys'

export function useItems() {
  return useQuery<Item[]>({
    queryKey: queryKeys.items(),
    queryFn: () => api.get('/api/items').then(r => r.data),
  })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; description: string; cost: number; actions?: AttachedAction[] | null }) =>
      api.post('/api/items', body).then(r => r.data as Item),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.items() }),
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; description?: string; cost?: number; actions?: AttachedAction[] | null }) =>
      api.patch(`/api/items/${id}`, body).then(r => r.data as Item),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.items() }),
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.items() }),
  })
}
