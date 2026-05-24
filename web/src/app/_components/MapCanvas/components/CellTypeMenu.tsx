import { useState } from 'react'
import { ALL_TYPES, CELL_COLOR_VARS } from '../constants'
import type { CtxMenu, EditProps } from '../types'
import type { CellType } from '@blind/shared'

type Props = {
  ctxMenu: CtxMenu
  onChangeType: EditProps['onChangeType']
  onSetBossHp?: EditProps['onSetBossHp']
  onClose: () => void
}

export function CellTypeMenu({ ctxMenu, onChangeType, onSetBossHp, onClose }: Props) {
  const [bossHpInput, setBossHpInput] = useState(String(ctxMenu.cell.bossHp ?? 10))
  const isBoss = ctxMenu.cell.type === 'boss'

  return (
    <div
      className="fixed z-[9999] bg-card border border-border rounded shadow-lg py-1 min-w-[160px]"
      style={{ left: ctxMenu.x + 4, top: ctxMenu.y }}
      onClick={e => e.stopPropagation()}
    >
      <div className="px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground font-display border-b border-border mb-1">
        {ctxMenu.cell.id} — {ctxMenu.cell.type}
      </div>
      <div className="px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground font-display">
        Cell Type
      </div>
      {ALL_TYPES.map((type: CellType) => (
        <button
          key={type}
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors"
          onClick={() => { onChangeType(ctxMenu.cell.id, type); onClose() }}
        >
          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CELL_COLOR_VARS[type] }} />
          <span className="capitalize">{type}</span>
        </button>
      ))}
      {isBoss && onSetBossHp && (
        <div className="px-3 pt-2 pb-1 border-t border-border mt-1">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-display mb-1">
            Boss Hearts
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={99}
              value={bossHpInput}
              onChange={e => setBossHpInput(e.target.value)}
              className="w-14 h-6 text-xs px-1.5 rounded border border-border bg-background text-foreground"
              onClick={e => e.stopPropagation()}
            />
            <button
              className="text-xs px-2 h-6 rounded border border-primary/40 text-primary hover:bg-primary/10 font-display tracking-widest"
              onClick={e => { e.stopPropagation(); const n = parseInt(bossHpInput); if (n > 0) { onSetBossHp(ctxMenu.cell.id, n); onClose() } }}
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
