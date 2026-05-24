import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { ActionType, GmActionPayload, GmActionResult, PlayerActionResult } from '@blind/shared'
import { queryKeys } from './query-keys'

const MAP_MUTATING_ACTIONS = new Set<ActionType>(['CHANGE_CELL_TYPE', 'CREATE_PATH', 'DELETE_PATH'])

export function useGmAction(sessionId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ type, payload }: { type: ActionType; payload: GmActionPayload }) =>
      api.post(`/api/sessions/${sessionId}/action`, { type, payload }).then(r => r.data as GmActionResult),
    onSuccess: (data, vars) => {
      if (data.session) {
        qc.setQueryData(queryKeys.session(sessionId), data.session)
        if (MAP_MUTATING_ACTIONS.has(vars.type)) {
          qc.invalidateQueries({ queryKey: queryKeys.map(data.session.mapId) })
        }
      }
    },
  })
}

export function usePlayerAction(sessionId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ type, payload }: { type: string; payload: Record<string, unknown> }) =>
      api.post(`/api/sessions/${sessionId}/player-action`, { type, payload }).then(r => r.data as PlayerActionResult),
    onSuccess: (data) => {
      if (data.session) {
        qc.setQueryData([...queryKeys.root, 'play', data.session.code] as const, data.session)
        qc.setQueryData(queryKeys.session(sessionId), data.session)
      }
    },
  })
}
