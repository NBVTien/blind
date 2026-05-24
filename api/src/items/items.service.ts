import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { Item, AttachedAction } from '@blind/shared';
import { DbService } from '../db.service';
import { CreateItemDto } from './dto/create-item.dto';

function normalizeActions(raw: unknown): AttachedAction[] | undefined {
  if (!raw) return undefined;
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (Array.isArray(parsed)) return parsed as AttachedAction[];
  return [parsed as AttachedAction];
}

@Injectable()
export class ItemsService implements OnModuleInit {
  constructor(private readonly db: DbService) {}

  onModuleInit() {
    const count = (this.db.db.prepare('SELECT COUNT(*) as n FROM items').get() as { n: number }).n;
    if (count === 0) {
      const starters: Array<{ name: string; description: string; cost: number; actions?: AttachedAction[] }> = [
        {
          name: 'Healing Herb',
          description: 'Chew it down. Restores 1 heart immediately.',
          cost: 30,
          actions: [{ type: 'ADJUST_HP', payload: { amount: 1 } }],
        },
        {
          name: 'Vitality Stone',
          description: 'Increases your maximum hearts by 1. Permanently.',
          cost: 70,
          actions: [{ type: 'ADJUST_MAX_HP', payload: { amount: 1 } }],
        },
        {
          name: "Scout's Map",
          description: 'Show the GM. They will describe all adjacent spaces around you.',
          cost: 25,
          actions: [{ type: 'NOTIFY_GM', payload: { message: "reveal all adjacent spaces for player" } }],
        },
        {
          name: 'Body Snatcher',
          description: 'Swaps your position with another player. Pick your target.',
          cost: 90,
          actions: [{ type: 'SWAP_PLAYERS', payload: {} }],
        },
        {
          name: 'Hearthstone',
          description: 'Cracks in your hand. Instantly returns you to the start cell.',
          cost: 45,
          actions: [{ type: 'TELEPORT_TO_START', payload: {} }],
        },
        {
          name: "Pickpocket's Glove",
          description: 'Steals 10 coins from the nearest player. The GM picks who.',
          cost: 40,
          actions: [{ type: 'NOTIFY_GM', payload: { message: "steal 10g from a chosen player and give it to this player" } }],
        },
        {
          name: 'Wind Boots',
          description: 'Grants one extra move this turn. Use after moving to reset your move.',
          cost: 35,
          actions: [{ type: 'RESET_MOVE', payload: {} }],
        },
        {
          name: "Oracle's Eye",
          description: 'The GM tells you how many steps you are from the end cell.',
          cost: 50,
          actions: [{ type: 'DISTANCE_TO_END', payload: {} }],
        },
      ];
      const insert = this.db.db.prepare('INSERT INTO items (name, description, cost, action) VALUES (?, ?, ?, ?)');
      for (const s of starters) insert.run(s.name, s.description, s.cost, s.actions ? JSON.stringify(s.actions) : null);
    }
  }

  private toItem(row: Record<string, unknown>): Item {
    return {
      id: row.id as number,
      name: row.name as string,
      description: row.description as string,
      cost: row.cost as number,
      actions: normalizeActions(row.action),
    };
  }

  findAll(): Item[] {
    return (this.db.db.prepare('SELECT * FROM items').all() as Record<string, unknown>[]).map(r => this.toItem(r));
  }

  findOne(id: number): Item {
    const row = this.db.db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) throw new NotFoundException(`Item ${id} not found`);
    return this.toItem(row);
  }

  create(dto: CreateItemDto): Item {
    const result = this.db.db.prepare('INSERT INTO items (name, description, cost, action) VALUES (?, ?, ?, ?)').run(dto.name, dto.description, dto.cost, dto.actions ? JSON.stringify(dto.actions) : null);
    return this.findOne(Number(result.lastInsertRowid));
  }

  update(id: number, dto: Partial<CreateItemDto>): Item {
    const item = this.findOne(id);
    const name = dto.name ?? item.name;
    const description = dto.description ?? item.description;
    const cost = dto.cost ?? item.cost;
    const actionsValue = 'actions' in dto
      ? (dto.actions ? JSON.stringify(dto.actions) : null)
      : (item.actions ? JSON.stringify(item.actions) : null);
    this.db.db.prepare('UPDATE items SET name = ?, description = ?, cost = ?, action = ? WHERE id = ?').run(name, description, cost, actionsValue, id);
    return this.findOne(id);
  }

  remove(id: number): void {
    const item = this.db.db.prepare('SELECT id FROM items WHERE id = ?').get(id);
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    this.db.db.prepare('DELETE FROM items WHERE id = ?').run(id);
  }
}
