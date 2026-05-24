import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { CellTypeConfigMap } from '@blind/shared'
import { queryKeys } from './query-keys'

export function useCellConfig() {
  return useQuery<CellTypeConfigMap>({
    queryKey: queryKeys.cellConfig(),
    queryFn: () => api.get('/api/cell-config').then(r => r.data),
  })
}

export function useUpdateCellConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config: CellTypeConfigMap) =>
      api.patch('/api/cell-config', { config }).then(r => r.data as CellTypeConfigMap),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.cellConfig(), data)
    },
  })
}
