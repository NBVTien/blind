export const queryKeys = {
  root: ['blind'] as const,
  maps: () => [...queryKeys.root, 'maps'] as const,
  map: (id: number) => [...queryKeys.maps(), id] as const,
  sessions: () => [...queryKeys.root, 'sessions'] as const,
  session: (id: number) => [...queryKeys.sessions(), id] as const,
  items: () => [...queryKeys.root, 'items'] as const,
  wheels: () => [...queryKeys.root, 'wheels'] as const,
  wheel: (id: number) => [...queryKeys.wheels(), id] as const,
  cellConfig: () => [...queryKeys.root, 'cell-config'] as const,
  gameConfig: () => [...queryKeys.root, 'game-config'] as const,
}
