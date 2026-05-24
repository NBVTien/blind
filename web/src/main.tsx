import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { AppLayout } from './app/_components/AppLayout'
import { DashboardPage } from './app/dashboard/page'
import { MapListPage } from './app/maps/page'
import { MapDetailPage } from './app/maps/detail/page'
import { NewMapPage } from './app/maps/new/page'
import { SessionListPage } from './app/sessions/page'
import { SessionPage } from './app/sessions/detail/page'
import { ItemsPage } from './app/items/page'
import { WheelsPage } from './app/wheels/page'
import { WheelNewPage } from './app/wheels/new/page'
import { WheelDetailPage } from './app/wheels/detail/page'
import { CellConfigPage } from './app/cell-config/page'
import { GameConfigPage } from './app/game-config/page'
import { ActionsDocsPage } from './app/actions-docs/page'
import { StepsDocsPage } from './app/steps-docs/page'
import { PlayerPickerPage } from './app/play/page'
import { PlayerViewPage } from './app/play/player/page'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

const router = createBrowserRouter([
  { path: 'play/:code', element: <PlayerPickerPage /> },
  { path: 'play/:code/:playerId', element: <PlayerViewPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'maps', element: <MapListPage /> },
      { path: 'maps/new', element: <NewMapPage /> },
      { path: 'maps/:id', element: <MapDetailPage /> },
      { path: 'sessions', element: <SessionListPage /> },
      { path: 'sessions/:id', element: <SessionPage /> },
      { path: 'items', element: <ItemsPage /> },
      { path: 'wheels', element: <WheelsPage /> },
      { path: 'wheels/new', element: <WheelNewPage /> },
      { path: 'wheels/:id', element: <WheelDetailPage /> },
      { path: 'cell-config', element: <CellConfigPage /> },
      { path: 'game-config', element: <GameConfigPage /> },
      { path: 'actions-docs', element: <ActionsDocsPage /> },
      { path: 'steps-docs', element: <StepsDocsPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
