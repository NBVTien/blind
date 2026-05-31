'use client'

import { useState } from 'react'
import { ActionPicker } from '@/app/_components/ActionPicker'
import type { AttachedAction } from '@blind/shared'

export function ActionsDocsPage() {
  const [previewAction, setPreviewAction] = useState<AttachedAction[] | null>(null)

  return (
    <div className="p-10 max-w-3xl">
      <div className="mb-10">
        <p className="text-xs font-display tracking-[0.3em] uppercase text-muted-foreground mb-2">Reference</p>
        <h1 className="font-display font-light text-4xl leading-none" style={{ letterSpacing: '0.08em' }}>Actions</h1>
      </div>

      <Section title="Action Picker">
        <div className="py-3">
          <p className="text-sm text-muted-foreground mb-3">Interactive picker — attach to wheel entries, items, or cell configs.</p>
          <ActionPicker value={previewAction} onChange={setPreviewAction} />
        </div>
      </Section>

      <Section title="Movement">
        <ActionRow
          name="Move"
          type="MOVE"
          payload="playerId, toCellId"
          notes="Moves player to an adjacent cell (adjacency enforced). Used by players on their turn; GMs can also invoke directly."
        />
        <ActionRow
          name="Teleport"
          type="TELEPORT"
          payload="playerId, toCellId?"
          notes="Moves player to any cell, ignoring adjacency. Omit toCellId to land on a random path cell."
        />
        <ActionRow
          name="Teleport to Start"
          type="TELEPORT_TO_START"
          payload="playerId"
          notes="Instantly moves player to the start cell, ignoring adjacency."
        />
      </Section>

      <Section title="Player Mechanics">
        <ActionRow
          name="Reset Move"
          type="RESET_MOVE"
          payload="playerId"
          notes="Resets the player's hasMoved flag so they can move again this turn. Used by Wind Boots."
        />
        <ActionRow
          name="Swap Players"
          type="SWAP_PLAYERS"
          payload="playerId, targetPlayerId"
          notes="Swaps map positions between two players."
        />
      </Section>

      <Section title="Economy">
        <ActionRow
          name="Give Gold"
          type="GIVE_GOLD"
          payload="playerId, amount"
          notes="Adds gold to player. No floor concern."
        />
        <ActionRow
          name="Take Gold"
          type="TAKE_GOLD"
          payload="playerId, amount"
          notes="Deducts gold. Floors at 0 — cannot go negative."
        />
        <ActionRow
          name="Steal Gold"
          type="STEAL_GOLD"
          payload="playerId (thief), targetPlayerId (victim), amount?"
          notes="Transfers gold from victim to thief. Defaults to 10g if amount omitted. Victim floors at 0."
        />
        <ActionRow
          name="Give Item"
          type="GIVE_ITEM"
          payload="playerId, itemId"
          notes="Adds catalog item to inventory for free. No gold deducted."
        />
        <ActionRow
          name="Use Item"
          type="USE_ITEM"
          payload="playerId, itemId"
          notes="Consumes and removes item from player inventory."
        />
        <ActionRow
          name="Buy Item"
          type="BUY_ITEM"
          payload="playerId, itemId"
          notes="Deducts item cost from player gold. Use for shop purchases triggered manually."
        />
      </Section>

      <Section title="Map">
        <ActionRow
          name="Change Cell Type"
          type="CHANGE_CELL_TYPE"
          payload="cellId, type?, label?"
          notes="Changes a cell's type. Omit type for random assignment. Provide label with no type to make a plain cell with custom label."
        />
        <ActionRow
          name="Create Path"
          type="CREATE_PATH"
          payload="fromCellId, toCellId"
          notes="Adds a bidirectional edge between two cells."
        />
        <ActionRow
          name="Delete Path"
          type="DELETE_PATH"
          payload="fromCellId, toCellId"
          notes="Removes the bidirectional edge between two cells."
        />
      </Section>

      <Section title="Player Stats">
        <ActionRow
          name="Set HP"
          type="SET_PLAYER_HP"
          payload="playerId, hp"
          notes="Sets player HP to an absolute value between 0 and their maxHp."
        />
        <ActionRow
          name="Adjust HP"
          type="ADJUST_HP"
          payload="playerId, amount"
          notes="Relative heal or damage. Positive = heal, negative = damage. Clamps to 0…maxHp."
        />
        <ActionRow
          name="Adjust Max HP"
          type="ADJUST_MAX_HP"
          payload="playerId, amount"
          notes="+1 or −1 to maxHp (floor 1). If max decreases below current HP, current HP clamps to new max."
        />
      </Section>

      <Section title="Wheels">
        <ActionRow
          name="Spin Wheel"
          type="SPIN_WHEEL"
          payload="wheelId"
          notes="Returns a weighted random entry. Does NOT mutate session state — GM applies the outcome manually using other actions."
        />
      </Section>

      <Section title="Boss Fight">
        <ActionRow
          name="Boss Fight Spin"
          type="BOSS_FIGHT_SPIN"
          payload="playerId"
          notes="One-spin boss combat. Win (3/8 odds): player gains +10g. Lose (5/8 odds): player loses 1 heart. Available in Actions tab when a player is on a boss cell."
        />
      </Section>

      <Section title="Information">
        <ActionRow
          name="Distance to End"
          type="DISTANCE_TO_END"
          payload="playerId"
          notes="BFS from player's current cell to nearest end cell. Logs result and returns distanceToEnd in response. Used by Oracle's Eye item. Returns null if no path exists."
        />
        <ActionRow
          name="Reveal Adjacent"
          type="REVEAL_ADJACENT"
          payload="playerId"
          notes="Returns the cell type and label of every cell reachable from the player's current position via outgoing edges. Logs the result. Used by Scout's Map item. Result shown as colored pills in the player view."
        />
        <ActionRow
          name="Notify GM"
          type="NOTIFY_GM"
          payload="playerId, message?"
          notes="Appends a GM-prompt log entry. Used by items that need manual GM resolution (e.g. wish items). Default message: 'item used — awaiting GM response'."
        />
        <ActionRow
          name="Broadcast"
          type="BROADCAST"
          payload="broadcastMessage"
          notes="Sets session.playerBroadcast — a banner visible to all players on their /play view. Replaces any previous broadcast."
        />
      </Section>

      <Section title="Turn Control">
        <ActionRow
          name="End Turn"
          type="END_TURN"
          payload="playerId"
          notes="Ends the player's turn and advances the turn order. Equivalent to the player pressing End Turn themselves."
        />
        <ActionRow
          name="Skip Turn"
          type="SKIP_TURN"
          payload="playerId"
          notes="GM-forced turn skip. Logs 'GM skipped turn' and advances turn order without the player taking any action."
        />
        <ActionRow
          name="Reorder Players"
          type="REORDER_PLAYERS"
          payload="playerOrder (array of player IDs)"
          notes="Replaces session.turnOrder and reorders the players array to match. All player IDs must be valid."
        />
      </Section>

      <Section title="Session Control">
        <ActionRow
          name="Complete Session"
          type="COMPLETE_SESSION"
          payload="winnerId? (player ID)"
          notes="Ends the session immediately. Sets status to 'completed'. Optional winnerId declares a winner and records winTurn. Omit winnerId to end without a winner (GM-decided draw or manual close). Winner banner appears in GM Dashboard and player views."
        />
      </Section>

      <div className="mt-12 border-t border-border pt-6">
        <p className="text-xs text-muted-foreground font-display tracking-widest uppercase">Endpoint</p>
        <p className="mt-1 text-sm font-mono text-foreground">
          POST /api/sessions/:id/action
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Body: <span className="font-mono text-foreground">{'{ "type": "ACTION_TYPE", "payload": { ... } }'}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Response: <span className="font-mono text-foreground">{'{ session?, spunEntry?, bossFight? }'}</span>
        </p>
      </div>
    </div>
  )
}

interface SectionProps {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="mb-8">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-display mb-3 pb-2 border-b border-border">
        {title}
      </h2>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

interface ActionRowProps {
  name: string
  type: string
  payload: string
  notes: string
}

function ActionRow({ name, type, payload, notes }: ActionRowProps) {
  return (
    <div className="py-3 border-b border-border last:border-0 grid grid-cols-[180px_1fr] gap-4 items-start">
      <div>
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs font-mono text-primary mt-0.5">{type}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-mono mb-1">{payload}</p>
        <p className="text-sm text-muted-foreground">{notes}</p>
      </div>
    </div>
  )
}
