import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actions?: ReactNode
  decorate?: boolean
}

export function EmptyState({ icon: Icon, title, description, actions, decorate = false }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center gap-3',
        decorate ? 'py-16 px-8' : 'py-8 px-4',
      )}
    >
      <div
        className={cn(
          'rounded-full p-3',
          decorate ? 'bg-muted' : 'bg-muted/50',
        )}
      >
        <Icon className={cn('text-muted-foreground', decorate ? 'h-8 w-8' : 'h-5 w-5')} />
      </div>
      <div>
        <p className={cn('font-medium', decorate ? 'text-lg' : 'text-sm')}>{title}</p>
        <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
      </div>
      {actions && <div className="flex gap-2 mt-1">{actions}</div>}
    </div>
  )
}
