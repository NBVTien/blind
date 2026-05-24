import { LayoutDashboard, Map, Moon, Package, PanelLeft, Search, Sun, Users, Dices, Settings2, Zap, Skull } from 'lucide-react'
import { useLocation, NavLink } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { useTheme } from '@/hooks/use-theme'

const navGroups = [
  {
    label: 'Play',
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard },
      { title: 'Sessions', url: '/sessions', icon: Users },
    ],
  },
  {
    label: 'Build',
    items: [
      { title: 'Maps', url: '/maps', icon: Map },
      { title: 'Items', url: '/items', icon: Package },
      { title: 'Wheels', url: '/wheels', icon: Dices },
    ],
  },
  {
    label: 'Config',
    items: [
      { title: 'Game Config', url: '/game-config', icon: Settings2 },
      { title: 'Actions', url: '/actions-docs', icon: Zap },
      { title: 'Death Steps', url: '/steps-docs', icon: Skull },
    ],
  },
]

interface AppSidebarProps {
  onSearchOpen: () => void
}

function NavGroups() {
  const { pathname } = useLocation()

  return (
    <>
      {navGroups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive = item.url === '/' ? pathname === '/' : pathname.startsWith(item.url)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title} size="default">
                      <NavLink to={item.url} end={item.url === '/'}>
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}

export function AppSidebar({ onSearchOpen }: AppSidebarProps) {
  const { theme, toggle } = useTheme()
  const { state, toggleSidebar } = useSidebar()
  const collapsed = state === 'collapsed'

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex h-8 items-center gap-2">
          {!collapsed && (
            <span className="font-display font-bold tracking-widest text-primary text-base flex-1">BLIND</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 shrink-0"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavGroups />
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Search (⌘K)" onClick={onSearchOpen}>
              <Search />
              <span>Search (⌘K)</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggle}>
              {theme === 'dark' ? <Sun /> : <Moon />}
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <div className="flex items-center gap-2 px-2 py-1">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="text-xs">U</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <span className="text-sm text-sidebar-foreground truncate">Game Master</span>
          )}
        </div>
      </SidebarFooter>

    </Sidebar>
  )
}
