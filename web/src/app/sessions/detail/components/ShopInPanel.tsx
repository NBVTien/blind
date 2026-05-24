import { ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Session, Item } from '@blind/shared'

export function ShopInPanel({
  session,
  items,
  shopItemIds,
  onBuy,
  onClose,
}: {
  session: Session
  items: Item[]
  shopItemIds?: number[]
  onBuy: (playerId: string, itemId: number) => void
  onClose: () => void
}) {
  const visibleItems = shopItemIds != null ? items.filter(i => shopItemIds.includes(i.id)) : items
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <p className="font-display text-xs tracking-[0.25em] uppercase text-muted-foreground flex items-center gap-2">
          <ShoppingBag className="h-3.5 w-3.5" />
          Shop
        </p>
        <Button size="sm" variant="ghost" onClick={onClose} className="h-7 text-xs font-display tracking-widest">
          Back to Map
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {visibleItems.length === 0 && (
          <p className="text-muted-foreground text-sm py-2">No items in catalog.</p>
        )}
        {visibleItems.map((item, idx) => (
          <div key={item.id}>
            {idx > 0 && <div className="border-t border-border" />}
            <div className="py-3">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-medium text-foreground">{item.name}</span>
                <span className="text-primary font-display text-sm">{item.cost}g</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{item.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {session.players.map(player => (
                  <button
                    key={player.id}
                    onClick={() => onBuy(player.id, item.id)}
                    disabled={player.gold < item.cost}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-display tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                  >
                    <ShoppingBag className="h-2.5 w-2.5" />
                    {player.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
