import { Bell, Moon, PanelLeft, Search, Settings, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useSidebar } from '@/components/ui/sidebar'
import { useTheme } from '@/hooks/use-theme'

interface TopbarProps {
  onSearchOpen: () => void
}

export function Topbar({ onSearchOpen }: TopbarProps) {
  const { theme, toggle } = useTheme()
  const { toggleSidebar, state } = useSidebar()

  return (
    <header className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
      <Button variant="ghost" size="sm" onClick={toggleSidebar} className="gap-2 px-2">
        {state === 'expanded' && <span className="text-sm font-bold tracking-widest">BLIND</span>}
        <PanelLeft className="h-4 w-4" />
      </Button>
      <div className="flex-1 flex items-center gap-2">
        <div
          className="relative hidden md:flex items-center cursor-pointer"
          onClick={onSearchOpen}
        >
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            readOnly
            className="pl-9 w-64 cursor-pointer"
            placeholder="Search... ⌘K"
          />
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onSearchOpen} className="md:hidden">
        <Search className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon">
        <Bell className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon">
        <Settings className="h-4 w-4" />
      </Button>
      <Avatar className="h-8 w-8">
        <AvatarFallback>U</AvatarFallback>
      </Avatar>
    </header>
  )
}
