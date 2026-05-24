import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { GameConfig } from '@blind/shared'
import { queryKeys } from './query-keys'

export function useGameConfig() {
  return useQuery<GameConfig>({
    queryKey: queryKeys.gameConfig(),
    queryFn: () => api.get('/api/game-config').then(r => r.data),
  })
}

export function useUpdateGameConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config: Partial<GameConfig>) =>
      api.patch('/api/game-config', config).then(r => r.data as GameConfig),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.gameConfig(), data)
    },
  })
}
