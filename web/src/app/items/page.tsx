import { useState } from 'react'
import { Trash2, ChevronDown, ChevronRight, Plus, Pencil, Check, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { useItems, useCreateItem, useDeleteItem, useUpdateItem } from '@/lib/items.queries'
import { useWheels } from '@/lib/wheels.queries'
import { ActionPicker, actionLabel } from '@/app/_components/ActionPicker'
import { toast } from '@/lib/toast'
import type { AttachedAction, Item, Wheel } from '@blind/shared'

function EditableRow({
  item,
  wheels,
}: {
  item: Item
  wheels: Wheel[]
}) {
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()
  const { data: allItems = [] } = useItems()

  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description)
  const [cost, setCost] = useState(String(item.cost))

  function handleSave() {
    if (!name.trim() || !cost) return
    updateItem.mutate(
      { id: item.id, name: name.trim(), description: description.trim(), cost: Number(cost) },
      { onSuccess: () => setEditing(false) },
    )
  }

  function handleCancel() {
    setName(item.name)
    setDescription(item.description)
    setCost(String(item.cost))
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="border-b border-border">
        <div className="flex flex-col gap-2 py-3">
          <div className="flex gap-3 items-center">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Item name"
              className="flex-1 h-7 text-sm"
              autoFocus
            />
            <Input
              value={cost}
              onChange={e => setCost(e.target.value)}
              placeholder="Cost"
              type="number"
              className="w-24 h-7 text-sm"
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label="Save item"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleSave}
              disabled={!name.trim() || !cost || updateItem.isPending}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Cancel edit"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={handleCancel}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description"
            className="h-7 text-sm"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-border">
      <div className="grid grid-cols-[1fr_2fr_80px_auto_auto_44px] gap-4 py-3 items-center">
        <span className="font-medium text-foreground">{item.name}</span>
        <span className="text-muted-foreground text-sm">{item.description}</span>
        <span className="text-right text-primary font-display text-sm">{item.cost}g</span>
        <button
          onClick={() => setExpanded(v => !v)}
          className={`flex items-center gap-1 text-xs uppercase tracking-widest font-display transition-colors px-1.5 py-0.5 rounded border ${
            item.actions?.length
              ? 'border-primary/40 text-primary bg-primary/10'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          {item.actions?.length ? <Zap className="h-3 w-3" /> : 'ACT'}
          {expanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit item"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete item"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => {
              let timeout: ReturnType<typeof setTimeout>
              toast('Item deleted', {
                action: { label: 'Undo', onClick: () => clearTimeout(timeout) },
              })
              timeout = setTimeout(() => deleteItem.mutate(item.id), 4000)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="pb-3 pl-0">
          {item.actions?.length && (
            <p className="text-xs text-primary font-display mb-1.5 flex items-center gap-1"><Zap className="h-3 w-3" /> On use: {actionLabel(item.actions)}</p>
          )}
          <ActionPicker
            value={item.actions ?? null}
            onChange={(actions: AttachedAction[] | null) => updateItem.mutate({ id: item.id, actions })}
            items={allItems.filter(i => i.id !== item.id)}
            wheels={wheels}
          />
        </div>
      )}
    </div>
  )
}

export function ItemsPage() {
  const { data: items = [], isLoading } = useItems()
  const { data: wheels = [] } = useWheels()
  const createItem = useCreateItem()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [cost, setCost] = useState('')
  const [newActions, setNewActions] = useState<AttachedAction[] | null>(null)

  function handleAdd() {
    if (!name.trim() || !cost) return
    createItem.mutate(
      { name: name.trim(), description: description.trim(), cost: Number(cost), actions: newActions ?? undefined },
      {
        onSuccess: () => {
          setName('')
          setDescription('')
          setCost('')
          setNewActions(null)
          setOpen(false)
        },
      },
    )
  }

  return (
    <div className="p-10 max-w-3xl">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-display tracking-[0.3em] uppercase text-muted-foreground mb-2">
            Build
          </p>
          <h1 className="font-display font-light text-4xl leading-none" style={{ letterSpacing: '0.08em' }}>
            Items
          </h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="font-display tracking-widest text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Item</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex gap-3">
                <Input
                  placeholder="Item name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Input
                  placeholder="Cost (gold)"
                  type="number"
                  value={cost}
                  onChange={e => setCost(e.target.value)}
                  className="w-32"
                />
              </div>
              <Input
                placeholder="Description"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              <ActionPicker
                value={newActions}
                onChange={setNewActions}
                items={items}
                wheels={wheels}
              />
            </div>
            <DialogFooter showCloseButton>
              <Button
                onClick={handleAdd}
                disabled={!name.trim() || !cost || createItem.isPending}
                className="font-display tracking-widest text-xs"
              >
                {createItem.isPending ? 'Adding...' : 'Add Item'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading items...</p>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_2fr_80px_auto_auto_44px] gap-4 pb-2 border-b border-border text-xs uppercase tracking-widest text-muted-foreground font-display">
            <span>Name</span>
            <span>Description</span>
            <span className="text-right">Cost</span>
            <span />
            <span />
            <span />
          </div>

          {items.length === 0 && (
            <p className="text-muted-foreground py-4 text-sm">No items yet.</p>
          )}

          {items.map(item => (
            <EditableRow key={item.id} item={item} wheels={wheels} />
          ))}
        </>
      )}
    </div>
  )
}
