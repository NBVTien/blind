import { useState } from 'react'
import { Zap } from 'lucide-react'
import { ALL_TYPES, CELL_COLOR_VARS } from '../constants'
import type { CtxMenu, SessionProps } from '../types'
import type { AttachedAction, CellType, Item, Wheel, Cell, Edge } from '@blind/shared'
import { ActionPicker, actionLabel } from '@/app/_components/ActionPicker'

type Props = {
  ctxMenu: CtxMenu
  mapCells: Cell[]
  mapEdges: Edge[]
  pathFrom: string | null
  onSetPathFrom: (cellId: string | null) => void
  onChangeCellType: NonNullable<SessionProps['onChangeCellType']>
  onCreatePath: NonNullable<SessionProps['onCreatePath']>
  onDeletePath: NonNullable<SessionProps['onDeletePath']>
  onSetCellAction?: (cellId: string, actions: AttachedAction[] | null) => void
  sessionItems?: Item[]
  sessionWheels?: Wheel[]
  onClose: () => void
}

export function SessionCellMenu({
  ctxMenu,
  mapCells,
  mapEdges,
  pathFrom,
  onSetPathFrom,
  onChangeCellType,
  onCreatePath,
  onDeletePath,
  onSetCellAction,
  sessionItems = [],
  sessionWheels = [],
  onClose,
}: Props) {
  const [subMenu, setSubMenu] = useState<'type' | 'deletePath' | 'action' | null>(null)
  const cell = ctxMenu.cell

  if (subMenu === 'action' && onSetCellAction) {
    return (
      <ActionSubmenu
        ctxMenu={ctxMenu}
        cell={cell}
        sessionItems={sessionItems}
        sessionWheels={sessionWheels}
        onSetCellAction={onSetCellAction}
        onBack={() => setSubMenu(null)}
        onClose={onClose}
      />
    )
  }

  const neighbors = mapEdges
    .filter(e => e.from === cell.id)
    .map(e => mapCells.find(c => c.id === e.to))
    .filter(Boolean) as Cell[]

  if (subMenu === 'type') {
    return (
      <div
        className="fixed z-[9999] bg-card border border-border rounded shadow-lg py-1 min-w-[160px]"
        style={{ left: ctxMenu.x + 4, top: ctxMenu.y, maxHeight: `calc(100vh - ${ctxMenu.y}px - 8px)`, overflowY: 'auto' as const }}
        onClick={e => e.stopPropagation()}
      >
        <button
          className="w-full text-left px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground font-display border-b border-border mb-1 hover:bg-muted"
          onClick={() => setSubMenu(null)}
        >
          ← Back
        </button>
        <div className="px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground font-display">
          Set type
        </div>
        {ALL_TYPES.map((type: CellType) => (
          <button
            key={type}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors"
            onClick={() => { onChangeCellType(cell.id, type); onClose() }}
          >
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CELL_COLOR_VARS[type] }} />
            <span className="capitalize">{type}</span>
          </button>
        ))}
      </div>
    )
  }

  if (subMenu === 'deletePath') {
    return (
      <div
        className="fixed z-[9999] bg-card border border-border rounded shadow-lg py-1 min-w-[160px]"
        style={{ left: ctxMenu.x + 4, top: ctxMenu.y, maxHeight: `calc(100vh - ${ctxMenu.y}px - 8px)`, overflowY: 'auto' as const }}
        onClick={e => e.stopPropagation()}
      >
        <button
          className="w-full text-left px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground font-display border-b border-border mb-1 hover:bg-muted"
          onClick={() => setSubMenu(null)}
        >
          ← Back
        </button>
        <div className="px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground font-display">
          Delete path to…
        </div>
        {neighbors.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground italic">No paths from here</div>
        )}
        {neighbors.map(n => (
          <button
            key={n.id}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors text-accent"
            onClick={() => { onDeletePath(cell.id, n.id); onClose() }}
          >
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CELL_COLOR_VARS[n.type] }} />
            <span>{n.label || n.type} <span className="text-muted-foreground text-xs">({n.id})</span></span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      className="fixed z-[9999] bg-card border border-border rounded shadow-lg py-1 min-w-[180px]"
      style={{ left: ctxMenu.x + 4, top: ctxMenu.y, maxHeight: `calc(100vh - ${ctxMenu.y}px - 8px)`, overflowY: 'auto' as const }}
      onClick={e => e.stopPropagation()}
    >
      <div className="px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground font-display border-b border-border mb-1">
        {cell.label ? `${cell.label} (${cell.id})` : `${cell.type} — ${cell.id}`}
      </div>

      <button
        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors"
        onClick={() => setSubMenu('type')}
      >
        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CELL_COLOR_VARS[cell.type] }} />
        <span>Change type…</span>
      </button>

      <div className="border-t border-border my-1" />

      {pathFrom === null ? (
        <button
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          onClick={() => { onSetPathFrom(cell.id); onClose() }}
        >
          Set as path start
        </button>
      ) : pathFrom === cell.id ? (
        <button
          className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          onClick={() => { onSetPathFrom(null); onClose() }}
        >
          Cancel path start ({cell.id})
        </button>
      ) : (
        <>
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors text-primary"
            onClick={() => { onCreatePath(pathFrom, cell.id); onSetPathFrom(null); onClose() }}
          >
            Add path: {pathFrom} → {cell.id}
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
            onClick={() => { onSetPathFrom(cell.id); onClose() }}
          >
            Use as new path start
          </button>
        </>
      )}

      {neighbors.length > 0 && (
        <button
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors text-accent"
          onClick={() => setSubMenu('deletePath')}
        >
          Delete path…
        </button>
      )}

      {onSetCellAction && (
        <>
          <div className="border-t border-border my-1" />
          <button
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${cell.actions?.length ? 'text-primary' : ''}`}
            onClick={() => setSubMenu('action')}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>{cell.actions?.length ? `Action: ${actionLabel(cell.actions)}` : 'Set action…'}</span>
          </button>
        </>
      )}
    </div>
  )
}

function ActionSubmenu({
  ctxMenu,
  cell,
  sessionItems,
  sessionWheels,
  onSetCellAction,
  onBack,
  onClose,
}: {
  ctxMenu: CtxMenu
  cell: Cell
  sessionItems: Item[]
  sessionWheels: Wheel[]
  onSetCellAction: (cellId: string, actions: AttachedAction[] | null) => void
  onBack: () => void
  onClose: () => void
}) {
  const [pending, setPending] = useState<AttachedAction[] | null>(cell.actions ?? null)

  return (
    <div
      className="fixed z-[9999] bg-card border border-border rounded shadow-lg py-1 min-w-[220px]"
      style={{ left: ctxMenu.x + 4, top: ctxMenu.y, maxHeight: `calc(100vh - ${ctxMenu.y}px - 8px)`, overflowY: 'auto' as const }}
      onClick={e => e.stopPropagation()}
    >
      <button
        className="w-full text-left px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground font-display border-b border-border mb-2 hover:bg-muted"
        onClick={onBack}
      >
        ← Back
      </button>
      <div className="px-3 pb-2 flex flex-col gap-2">
        <ActionPicker
          value={pending}
          onChange={actions => {
            setPending(actions)
            if (!actions) { onSetCellAction(cell.id, null); onClose() }
          }}
          items={sessionItems}
          wheels={sessionWheels}
          cells={[]}
        />
        {pending?.length && (
          <button
            className="text-xs uppercase tracking-widest font-display px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors self-end"
            onClick={() => { onSetCellAction(cell.id, pending); onClose() }}
          >
            Set action
          </button>
        )}
      </div>
    </div>
  )
}
