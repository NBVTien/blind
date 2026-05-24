import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import type { Wheel, WheelEntry, AttachedAction } from '@blind/shared';

function nextEntryId(): string { return String(Date.now() * 1000 + Math.floor(Math.random() * 1000)); }
import { DbService } from '../db.service';
import { CreateWheelDto } from './dto/create-wheel.dto';
import { UpdateWheelDto } from './dto/update-wheel.dto';

interface WheelRow { id: number; name: string; entries: string; created_at: string; }

function normalizeEntryActions(e: WheelEntry & { action?: AttachedAction }): WheelEntry {
  if (e.actions) return e;
  if (e.action) return { id: e.id, label: e.label, weight: e.weight, actions: [e.action] };
  return { id: e.id, label: e.label, weight: e.weight };
}

function toWheel(row: WheelRow): Wheel {
  const raw: (WheelEntry & { action?: AttachedAction })[] = JSON.parse(row.entries);
  return { id: row.id, name: row.name, entries: raw.map(normalizeEntryActions), createdAt: row.created_at };
}

@Injectable()
export class WheelsService implements OnModuleInit {
  constructor(private readonly db: DbService) {}

  onModuleInit() {
    const count = (this.db.db.prepare('SELECT COUNT(*) as n FROM wheels').get() as { n: number }).n;
    if (count === 0) {
      const W = 10;
      const entries: WheelEntry[] = [
        { id: nextEntryId(), label: '+1 ♥',    weight: W, actions: [{ type: 'ADJUST_HP',     payload: { amount:  1 } }] },
        { id: nextEntryId(), label: '−1 ♥',    weight: W, actions: [{ type: 'ADJUST_HP',     payload: { amount: -1 } }] },
        { id: nextEntryId(), label: '+1 max ♥', weight: W, actions: [{ type: 'ADJUST_MAX_HP', payload: { amount:  1 } }] },
        { id: nextEntryId(), label: '+20g',     weight: W, actions: [{ type: 'GIVE_GOLD',     payload: { amount: 20 } }] },
        { id: nextEntryId(), label: '+10g',     weight: W, actions: [{ type: 'GIVE_GOLD',     payload: { amount: 10 } }] },
        { id: nextEntryId(), label: '−10g',     weight: W, actions: [{ type: 'TAKE_GOLD',     payload: { amount: 10 } }] },
        { id: nextEntryId(), label: '−20g',     weight: W, actions: [{ type: 'TAKE_GOLD',     payload: { amount: 20 } }] },
        { id: nextEntryId(), label: 'Nothing',  weight: W },
        { id: nextEntryId(), label: 'Teleport', weight: W, actions: [{ type: 'TELEPORT',      payload: {} }] },
        { id: nextEntryId(), label: 'Back to Start', weight: W, actions: [{ type: 'TELEPORT_TO_START', payload: {} }] },
      ];
      const now = new Date().toISOString();
      this.db.db.prepare('INSERT INTO wheels (name, entries, created_at) VALUES (?, ?, ?)')
        .run('Chance Wheel', JSON.stringify(entries), now);
    }
    this.seedJailWheel();
  }

  private seedJailWheel() {
    const exists = (this.db.db.prepare("SELECT id FROM wheels WHERE name = 'Jail Wheel'").get() as { id: number } | undefined);
    if (exists) return;
    const entries: WheelEntry[] = [
      { id: nextEntryId(), label: '−1 ♥',    weight: 15, actions: [{ type: 'ADJUST_HP',  payload: { amount: -1 } }] },
      { id: nextEntryId(), label: '−2 ♥',    weight: 8,  actions: [{ type: 'ADJUST_HP',  payload: { amount: -2 } }] },
      { id: nextEntryId(), label: '−20g',    weight: 15, actions: [{ type: 'TAKE_GOLD',  payload: { amount: 20 } }] },
      { id: nextEntryId(), label: '−30g',    weight: 10, actions: [{ type: 'TAKE_GOLD',  payload: { amount: 30 } }] },
      { id: nextEntryId(), label: '−50g',    weight: 6,  actions: [{ type: 'TAKE_GOLD',  payload: { amount: 50 } }] },
      { id: nextEntryId(), label: 'Stuck',   weight: 20 },
      { id: nextEntryId(), label: 'Stuck',   weight: 16 },
      { id: nextEntryId(), label: 'ESCAPE — Back to Start', weight: 10, actions: [{ type: 'TELEPORT_TO_START', payload: {} }] },
    ];
    const now = new Date().toISOString();
    this.db.db.prepare('INSERT INTO wheels (name, entries, created_at) VALUES (?, ?, ?)')
      .run('Jail Wheel', JSON.stringify(entries), now);
  }

  findAll(): Wheel[] {
    return (this.db.db.prepare('SELECT * FROM wheels ORDER BY created_at DESC').all() as WheelRow[]).map(toWheel);
  }

  findOne(id: number): Wheel {
    const row = this.db.db.prepare('SELECT * FROM wheels WHERE id = ?').get(id) as WheelRow | undefined;
    if (!row) throw new NotFoundException(`Wheel ${id} not found`);
    return toWheel(row);
  }

  create(dto: CreateWheelDto): Wheel {
    const entries: WheelEntry[] = (dto.entries ?? []).map(e => ({
      id: nextEntryId(),
      label: e.label,
      weight: e.weight,
      ...(e.actions?.length ? { actions: e.actions as AttachedAction[] } : {}),
    }));
    const now = new Date().toISOString();
    const result = this.db.db.prepare('INSERT INTO wheels (name, entries, created_at) VALUES (?, ?, ?)')
      .run(dto.name, JSON.stringify(entries), now);
    return this.findOne(Number(result.lastInsertRowid));
  }

  update(id: number, dto: UpdateWheelDto): Wheel {
    const wheel = this.findOne(id);
    const name = dto.name ?? wheel.name;
    const entries: WheelEntry[] = dto.entries
      ? dto.entries.map(e => ({
          id: nextEntryId(),
          label: e.label,
          weight: e.weight,
          ...(e.actions?.length ? { actions: e.actions as AttachedAction[] } : {}),
        }))
      : wheel.entries;
    this.db.db.prepare('UPDATE wheels SET name = ?, entries = ? WHERE id = ?')
      .run(name, JSON.stringify(entries), id);
    return this.findOne(id);
  }

  remove(id: number): void {
    if (!this.db.db.prepare('SELECT id FROM wheels WHERE id = ?').get(id))
      throw new NotFoundException(`Wheel ${id} not found`);
    this.db.db.prepare('DELETE FROM wheels WHERE id = ?').run(id);
  }

  spin(id: number): WheelEntry {
    const wheel = this.findOne(id);
    if (!wheel.entries.length) throw new BadRequestException(`Wheel ${id} has no entries`);
    const total = wheel.entries.reduce((sum, e) => sum + e.weight, 0);
    let rng = Math.random() * total;
    for (const entry of wheel.entries) {
      rng -= entry.weight;
      if (rng <= 0) return entry;
    }
    return wheel.entries[wheel.entries.length - 1];
  }
}
