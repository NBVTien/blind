import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Users,
  Map,
  Package,
  Dices,
  Settings2,
  Zap,
  Skull,
  Plus,
} from 'lucide-react'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const groups = [
  {
    heading: 'Play',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard },
      { label: 'Sessions', path: '/sessions', icon: Users },
    ],
  },
  {
    heading: 'Build',
    items: [
      { label: 'Maps', path: '/maps', icon: Map },
      { label: 'Items', path: '/items', icon: Package },
      { label: 'Wheels', path: '/wheels', icon: Dices },
    ],
  },
  {
    heading: 'Create',
    items: [
      { label: 'New Map', path: '/maps/new', icon: Plus },
      { label: 'New Wheel', path: '/wheels/new', icon: Plus },
    ],
  },
  {
    heading: 'Config',
    items: [
      { label: 'Game Config', path: '/game-config', icon: Settings2 },
    ],
  },
  {
    heading: 'Reference',
    items: [
      { label: 'Actions', path: '/actions-docs', icon: Zap },
      { label: 'Death Steps', path: '/steps-docs', icon: Skull },
    ],
  },
]

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  function handleSelect(path: string) {
    onOpenChange(false)
    navigate(path)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.heading} heading={group.heading}>
            {group.items.map((item) => (
              <CommandItem
                key={item.path}
                onSelect={() => handleSelect(item.path)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
