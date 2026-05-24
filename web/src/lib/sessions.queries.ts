import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { Session } from '@blind/shared'
import { queryKeys } from './query-keys'

export function useSessions() {
  return useQuery<Session[]>({
    queryKey: queryKeys.sessions(),
    queryFn: () => api.get('/api/sessions').then(r => r.data),
  })
}

export function useSession(id: number) {
  return useQuery<Session>({
    queryKey: queryKeys.session(id),
    queryFn: () => api.get(`/api/sessions/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; mapId: number; players: { name: string; color: string }[] }) =>
      api.post('/api/sessions', body).then(r => r.data as Session),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sessions() }),
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sessions() }),
  })
}

export function useMovePlayer(sessionId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ playerId, toCellId }: { playerId: string; toCellId: string }) =>
      api.post(`/api/sessions/${sessionId}/move`, { playerId, toCellId }).then(r => r.data as Session),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.session(sessionId), data)
    },
  })
}

export function useBuyItem(sessionId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ playerId, itemId }: { playerId: string; itemId: number }) =>
      api.post(`/api/sessions/${sessionId}/buy`, { playerId, itemId }).then(r => r.data as Session),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.session(sessionId), data)
    },
  })
}

export function useAdjustGold(sessionId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ playerId, amount }: { playerId: string; amount: number }) =>
      api.post(`/api/sessions/${sessionId}/gold`, { playerId, amount }).then(r => r.data as Session),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.session(sessionId), data)
    },
  })
}

export function useIncrementTurn(sessionId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post(`/api/sessions/${sessionId}/turn`).then(r => r.data as Session),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.session(sessionId), data)
    },
  })
}

export function useEndTurn(sessionId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (playerId: string) =>
      api.post(`/api/sessions/${sessionId}/end-turn`, { playerId }).then(r => r.data as Session),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.session(sessionId), data)
      qc.setQueryData([...queryKeys.root, 'play', data.code] as const, data)
    },
  })
}

export function useSessionByCode(code: string) {
  return useQuery<Session>({
    queryKey: [...queryKeys.root, 'play', code] as const,
    queryFn: () => api.get(`/api/sessions/by-code/${code}`).then(r => r.data),
    enabled: !!code,
    refetchInterval: 3000,
  })
}

export function useSessionPolling(id: number) {
  return useQuery<Session>({
    queryKey: queryKeys.session(id),
    queryFn: () => api.get(`/api/sessions/${id}`).then(r => r.data),
    enabled: !!id,
    refetchInterval: 3000,
  })
}
