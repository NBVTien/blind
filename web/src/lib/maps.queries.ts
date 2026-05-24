import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { GameMap, AttachedAction } from '@blind/shared'
import { queryKeys } from './query-keys'

export function useMaps() {
  return useQuery<GameMap[]>({
    queryKey: queryKeys.maps(),
    queryFn: () => api.get('/api/maps').then(r => r.data),
  })
}

export function useMap(id: number) {
  return useQuery<GameMap>({
    queryKey: queryKeys.map(id),
    queryFn: () => api.get(`/api/maps/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateMap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; gridW: number; gridH: number; density?: number; chaos?: number; specialRate?: number; specialTypes?: string[]; connectivity?: number; randomStartEnd?: boolean }) =>
      api.post('/api/maps', body).then(r => r.data as GameMap),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.maps() }),
  })
}

export function useDeleteMap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/maps/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.maps() }),
  })
}

export function useUpdateMapName() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.patch(`/api/maps/${id}`, { name }).then(r => r.data as GameMap),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.map(data.id), data)
      qc.invalidateQueries({ queryKey: queryKeys.maps() })
    },
  })
}

export function useUpdateCell() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ mapId, cellId, type, label, actions, bossHp }: { mapId: number; cellId: string; type?: string; label?: string; actions?: AttachedAction[] | null; bossHp?: number }) =>
      api.patch(`/api/maps/${mapId}/cell/${cellId}`, { type, label, actions, bossHp }).then(r => r.data as GameMap),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.map(vars.mapId) })
    },
  })
}

export function useToggleEdge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ mapId, from, to }: { mapId: number; from: string; to: string }) =>
      api.patch(`/api/maps/${mapId}/edge`, { from, to }).then(r => r.data as GameMap),
    onSuccess: (data, vars) => {
      qc.setQueryData(queryKeys.map(vars.mapId), data)
    },
  })
}
