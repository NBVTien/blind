import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { CommandPalette } from './CommandPalette'
import { OfflineBanner } from './OfflineBanner'

export function AppLayout() {
  const [cmdOpen, setCmdOpen] = useState(false)

  return (
    <TooltipProvider>
      <SidebarProvider>
        <OfflineBanner />
        <AppSidebar onSearchOpen={() => setCmdOpen(true)} />
        <SidebarInset>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
        <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      </SidebarProvider>
    </TooltipProvider>
  )
}
