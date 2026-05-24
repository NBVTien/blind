import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Session, Player, LogEntry, Cell, Edge, ActionType, GmActionPayload, GmActionResult, BossFightSpinResult, PlayerBroadcast, PlayerActionType, PlayerActionPayload, PlayerActionResult, DeathActionStep, AttachedAction } from '@blind/shared';

function nextLogId(): string { return String(Date.now() * 1000 + Math.floor(Math.random() * 1000)); }
function nextPlayerId(): string { return String(Date.now() * 1000 + Math.floor(Math.random() * 1000)); }
import { DbService } from '../db.service';
import { MapsService } from '../maps/maps.service';
import { ItemsService } from '../items/items.service';
import { WheelsService } from '../wheels/wheels.service';
import { GameConfigService } from '../game-config/game-config.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateCellDto } from '../maps/dto/update-cell.dto';

interface SessionRow {
  id: number; code: string; name: string; map_id: number; map_name: string;
  players: string; log: string; current_turn: number; status: string;
  created_at: string; player_broadcast: string | null;
  turn_order: string; active_player_id: string | null; turn_done_ids: string;
  winner_id: string | null; win_turn: number | null;
}

function toSession(row: SessionRow): Session {
  const players: Player[] = JSON.parse(row.players);
  // backfill skippedTurnsRemaining, hasMoved, deathCount for old data
  const normPlayers = players.map(p => ({
    ...p,
    skippedTurnsRemaining: p.skippedTurnsRemaining ?? 0,
    hasMoved: p.hasMoved ?? false,
    deathCount: p.deathCount ?? 0,
  }));
  return {
    id: row.id, code: row.code, name: row.name, mapId: row.map_id, mapName: row.map_name,
    players: normPlayers, log: JSON.parse(row.log),
    currentTurn: row.current_turn, status: row.status as 'active' | 'completed',
    createdAt: row.created_at,
    playerBroadcast: row.player_broadcast ? JSON.parse(row.player_broadcast) : undefined,
    turnOrder: row.turn_order ? JSON.parse(row.turn_order) : normPlayers.map(p => p.id),
    activePlayerId: row.active_player_id ?? (normPlayers[0]?.id ?? null),
    turnDoneIds: row.turn_done_ids ? JSON.parse(row.turn_done_ids) : [],
    ...(row.winner_id ? { winnerId: row.winner_id } : {}),
    ...(row.win_turn != null ? { winTurn: row.win_turn } : {}),
  };
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly db: DbService,
    private readonly mapsService: MapsService,
    private readonly itemsService: ItemsService,
    private readonly wheelsService: WheelsService,
    private readonly gameConfigService: GameConfigService,
  ) {}

  findAll(): Session[] {
    return (this.db.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all() as SessionRow[])
      .map(toSession)
      .sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1));
  }

  findOne(id: number): Session {
    const row = this.db.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
    if (!row) throw new NotFoundException(`Session ${id} not found`);
    return toSession(row);
  }

  findByCode(code: string): Session {
    const row = this.db.db.prepare('SELECT * FROM sessions WHERE code = ?').get(code.toUpperCase()) as SessionRow | undefined;
    if (!row) throw new NotFoundException(`Session with code ${code} not found`);
    return toSession(row);
  }

  private generateUniqueCode(): string {
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
    } while (this.db.db.prepare('SELECT code FROM sessions WHERE code = ?').get(code));
    return code;
  }

  create(dto: CreateSessionDto): Session {
    const map = this.mapsService.findOne(dto.mapId);
    const startCell = map.cells.find(c => c.type === 'start') ?? map.cells[0];
    const players: Player[] = dto.players.map(p => ({
      id: nextPlayerId(), name: p.name, gold: 30, hp: 3, maxHp: 3,
      currentCellId: startCell.id, inventory: [], color: p.color,
      skippedTurnsRemaining: 0, deathCount: 0,
    }));
    const code = this.generateUniqueCode();
    const now = new Date().toISOString();
    const turnOrder = players.map(p => p.id);
    const result = this.db.db.prepare('INSERT INTO sessions (code, name, map_id, map_name, players, log, current_turn, status, created_at, turn_order, active_player_id, turn_done_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(code, dto.name, map.id, map.name, JSON.stringify(players), '[]', 1, 'active', now, JSON.stringify(turnOrder), turnOrder[0] ?? null, '[]');
    return this.findOne(Number(result.lastInsertRowid));
  }

  private save(session: Session): Session {
    this.db.db.prepare('UPDATE sessions SET players = ?, log = ?, current_turn = ?, status = ?, player_broadcast = ?, turn_order = ?, active_player_id = ?, turn_done_ids = ?, winner_id = ?, win_turn = ? WHERE id = ?')
      .run(
        JSON.stringify(session.players), JSON.stringify(session.log),
        session.currentTurn, session.status,
        session.playerBroadcast ? JSON.stringify(session.playerBroadcast) : null,
        JSON.stringify(session.turnOrder), session.activePlayerId,
        JSON.stringify(session.turnDoneIds),
        session.winnerId ?? null,
        session.winTurn ?? null,
        session.id,
      );
    return this.findOne(session.id);
  }

  /**
   * Advance to next player in turnOrder who is alive and not skipping.
   * If all alive players have acted this round, increment turn counter and start new round.
   * Skipped players have their skippedTurnsRemaining decremented; if they run death sequence steps, those run first.
   */
  private advanceTurn(session: Session): Session {
    const order = session.turnOrder.filter(id => session.players.find(p => p.id === id));
    if (order.length === 0) return session;

    const currentIdx = order.indexOf(session.activePlayerId ?? '');
    // Mark current player done
    if (session.activePlayerId && !session.turnDoneIds.includes(session.activePlayerId)) {
      session.turnDoneIds.push(session.activePlayerId);
    }

    // Find next player who hasn't acted yet, skipping dead/skip players
    let nextId: string | null = null;
    let checked = 0;
    let idx = (currentIdx + 1) % order.length;
    while (checked < order.length) {
      const candidateId = order[idx];
      const candidate = session.players.find(p => p.id === candidateId);
      if (!candidate) { idx = (idx + 1) % order.length; checked++; continue; }

      if (session.turnDoneIds.includes(candidateId)) {
        idx = (idx + 1) % order.length; checked++; continue;
      }

      if ((candidate.skippedTurnsRemaining ?? 0) > 0) {
        // decrement skip and mark done — run death sequence if still at 0 hp
        candidate.skippedTurnsRemaining -= 1;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: candidate.id, playerName: candidate.name, action: `skipping turn (${candidate.skippedTurnsRemaining} remaining)`, timestamp: new Date().toISOString() });
        session.turnDoneIds.push(candidateId);
        // if skips exhausted, run remaining death sequence steps
        if (candidate.skippedTurnsRemaining === 0 && candidate.hp === 0) {
          this.runDeathSequenceAfterSkips(session, candidate);
        }
        idx = (idx + 1) % order.length; checked++; continue;
      }

      nextId = candidateId;
      break;
    }

    if (nextId === null) {
      // All players acted — new round
      session.currentTurn++;
      session.turnDoneIds = [];
      session.players.forEach(p => { p.hasMoved = false; });
      this.checkWinCondition(session);
      // Find first non-fully-skipped player for next round start
      const firstAlive = order.find(id => {
        const p = session.players.find(pl => pl.id === id);
        return p && (p.hp > 0 || (p.skippedTurnsRemaining ?? 0) === 0);
      }) ?? order[0];
      session.activePlayerId = firstAlive ?? null;
    } else {
      session.activePlayerId = nextId;
    }

    return session;
  }

  private runDeathSequenceAfterSkips(session: Session, player: Player): void {
    const config = this.gameConfigService.get();
    const steps = config.deathSequence ?? [];
    // After skips are done, run non-skip steps
    const postSteps = steps.filter(s => s.type !== 'SKIP_TURNS');
    for (const step of postSteps) {
      if (step.type === 'RESPAWN_AT_START') {
        const map = this.mapsService.findOne(session.mapId);
        const startCell = map.cells.find((c: Cell) => c.type === 'start') ?? map.cells[0];
        player.currentCellId = startCell.id;
        player.hp = step.hp;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `respawned at start with ${step.hp} HP`, timestamp: new Date().toISOString() });
      } else if (step.type === 'GIVE_HP') {
        player.hp = Math.min(player.maxHp, player.hp + step.amount);
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `received ${step.amount} HP on respawn`, timestamp: new Date().toISOString() });
      }
    }
  }

  /** Apply death sequence when a player hits 0 HP. */
  private applyDeathSequence(session: Session, player: Player): void {
    const config = this.gameConfigService.get();
    const steps: DeathActionStep[] = config.deathSequence ?? [
      { type: 'SKIP_TURNS', count: 3 },
      { type: 'RESPAWN_AT_START', hp: 1 },
    ];
    player.deathCount = (player.deathCount ?? 0) + 1;
    session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `reached 0 HP — death sequence started (death #${player.deathCount})`, timestamp: new Date().toISOString() });
    for (const step of steps) {
      if (step.type === 'SKIP_TURNS') {
        player.skippedTurnsRemaining = (player.skippedTurnsRemaining ?? 0) + step.count;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `will skip ${step.count} turn${step.count !== 1 ? 's' : ''}`, timestamp: new Date().toISOString() });
        // Defer RESPAWN_AT_START/GIVE_HP until after skips
        return;
      } else if (step.type === 'RESPAWN_AT_START') {
        const map = this.mapsService.findOne(session.mapId);
        const startCell = map.cells.find((c: Cell) => c.type === 'start') ?? map.cells[0];
        player.currentCellId = startCell.id;
        player.hp = step.hp;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `respawned at start with ${step.hp} HP`, timestamp: new Date().toISOString() });
      } else if (step.type === 'GIVE_HP') {
        player.hp = Math.min(player.maxHp, player.hp + step.amount);
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `received ${step.amount} HP`, timestamp: new Date().toISOString() });
      }
    }
  }

  private checkWinCondition(session: Session): void {
    if (session.status === 'completed') return;
    const config = this.gameConfigService.get();
    const conditions = config.winConditions ?? [];
    if (!conditions.length) return;

    const map = this.mapsService.findOne(session.mapId);
    const endIds = new Set((map.cells as Cell[]).filter(c => c.type === 'end').map(c => c.id));

    // For turn-gated conditions, bail early if not enough turns have passed
    const turnGated = conditions.filter(c => c.type === 'MOST_GOLD_AFTER_TURNS' || c.type === 'LEAST_DEATHS_AFTER_TURNS') as ({ type: 'MOST_GOLD_AFTER_TURNS' | 'LEAST_DEATHS_AFTER_TURNS'; turns: number })[];
    if (turnGated.some(c => session.currentTurn < c.turns)) return;

    // Find a player that satisfies ALL conditions
    const winner = session.players.find(player => {
      return conditions.every(cond => {
        switch (cond.type) {
          case 'FIRST_TO_END': return endIds.has(player.currentCellId);
          case 'POSITIVE_GOLD': return player.gold > 0;
          case 'MOST_GOLD_AFTER_TURNS': {
            const best = session.players.reduce((a, b) => b.gold > a.gold ? b : a, session.players[0]);
            return player.id === best.id;
          }
          case 'LEAST_DEATHS_AFTER_TURNS': {
            const best = session.players.reduce((a, b) => (b.deathCount ?? 0) < (a.deathCount ?? 0) ? b : a, session.players[0]);
            return player.id === best.id;
          }
          default: return false;
        }
      });
    });

    if (winner) {
      session.status = 'completed';
      session.winnerId = winner.id;
      session.winTurn = session.currentTurn;
      const desc = conditions.map(c => {
        switch (c.type) {
          case 'FIRST_TO_END': return 'reached END';
          case 'POSITIVE_GOLD': return `${winner.gold}g`;
          case 'MOST_GOLD_AFTER_TURNS': return `most gold (${winner.gold}g) after ${c.turns} turns`;
          case 'LEAST_DEATHS_AFTER_TURNS': return `fewest deaths (${winner.deathCount ?? 0}) after ${c.turns} turns`;
          default: return '';
        }
      }).filter(Boolean).join(', ');
      session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: winner.id, playerName: winner.name, action: `${desc} — WINNER!`, timestamp: new Date().toISOString() });
    }
  }

  movePlayer(sessionId: number, playerId: string, toCellId: string): Session {
    const session = this.findOne(sessionId);
    const player = session.players.find(p => p.id === playerId);
    if (!player) throw new NotFoundException(`Player ${playerId} not found`);

    const map = this.mapsService.findOne(session.mapId);
    const srcCell = (map.cells as Cell[]).find(c => c.id === player.currentCellId);
    if (srcCell?.type === 'jail')
      throw new BadRequestException(`${player.name} is in jail — must spin the Jail Wheel to escape`);
    const destCell = (map.cells as Cell[]).find(c => c.id === toCellId);
    if (!destCell) throw new NotFoundException(`Cell ${toCellId} not found`);
    if (!(map.edges as Edge[]).some(e => e.from === player.currentCellId && e.to === toCellId))
      throw new BadRequestException(`${toCellId} not adjacent to ${player.currentCellId}`);

    const from = player.currentCellId;
    player.currentCellId = toCellId;
    player.hasMoved = true;
    session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId, playerName: player.name, action: `moved from ${from} to ${toCellId}`, timestamp: new Date().toISOString() });
    this.checkWinCondition(session);
    const saved = this.save(session);

    // Fire cell actions: cell's own, or trap/loot defaults, or start cell config
    const gameConfig = this.gameConfigService.get();
    const effectiveActions: AttachedAction[] =
      destCell.actions?.length ? destCell.actions
      : destCell.type === 'trap' ? [{ type: 'TAKE_GOLD', payload: { amount: 10 } }]
      : destCell.type === 'loot' ? [{ type: 'GIVE_GOLD', payload: { amount: 10 } }]
      : destCell.type === 'start' ? (gameConfig.cellConfig?.start?.defaultActions ?? [])
      : [];
    if (effectiveActions.length) {
      return this.executeActions(sessionId, effectiveActions, playerId).session ?? saved;
    }
    return saved;
  }

  buyItem(sessionId: number, playerId: string, itemId: number): Session {
    const session = this.findOne(sessionId);
    const player = session.players.find(p => p.id === playerId);
    if (!player) throw new NotFoundException(`Player ${playerId} not found`);
    const item = this.itemsService.findOne(itemId);
    if (player.gold < item.cost) throw new BadRequestException(`${player.name} needs ${item.cost}g, has ${player.gold}g`);
    player.gold -= item.cost;
    player.inventory.push({ ...item });
    session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId, playerName: player.name, action: `bought ${item.name} for ${item.cost}g`, timestamp: new Date().toISOString() });
    return this.save(session);
  }

  adjustGold(sessionId: number, playerId: string, amount: number): Session {
    const session = this.findOne(sessionId);
    const player = session.players.find(p => p.id === playerId);
    if (!player) throw new NotFoundException(`Player ${playerId} not found`);
    player.gold = player.gold + amount;
    session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId, playerName: player.name, action: amount >= 0 ? `gained ${amount}g (total: ${player.gold}g)` : `spent ${Math.abs(amount)}g (total: ${player.gold}g)`, timestamp: new Date().toISOString() });
    return this.save(session);
  }

  incrementTurn(sessionId: number): Session {
    const session = this.findOne(sessionId);
    return this.save(this.advanceTurn(session));
  }

  endTurn(sessionId: number, playerId: string): Session {
    const session = this.findOne(sessionId);
    // Validate it's this player's turn (or GM override with no playerId check needed)
    session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId, playerName: session.players.find(p => p.id === playerId)?.name ?? 'Unknown', action: 'ended turn', timestamp: new Date().toISOString() });
    return this.save(this.advanceTurn(session));
  }

  remove(id: number): void {
    if (!this.db.db.prepare('SELECT id FROM sessions WHERE id = ?').get(id)) throw new NotFoundException(`Session ${id} not found`);
    this.db.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  executeActions(sessionId: number, actions: AttachedAction[], playerId: string, extra?: Partial<GmActionPayload>): GmActionResult {
    let last: GmActionResult = { session: this.findOne(sessionId) };
    for (const act of actions) {
      const merged = { ...act.payload, playerId, ...extra } as GmActionPayload;
      last = this.executeAction(sessionId, act.type as ActionType, merged);
    }
    return last;
  }

  executeAction(sessionId: number, type: ActionType, payload: GmActionPayload): GmActionResult {
    switch (type) {

      case 'MOVE': {
        return { session: this.movePlayer(sessionId, payload.playerId!, payload.toCellId!) };
      }

      case 'USE_ITEM': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        const idx = player.inventory.findIndex(i => i.id === payload.itemId);
        if (idx === -1) throw new BadRequestException(`Item ${payload.itemId} not in inventory`);
        const [item] = player.inventory.splice(idx, 1);
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `used ${item.name}`, timestamp: new Date().toISOString() });
        const saved = this.save(session);
        if (item.actions?.length) {
          const inner = this.executeActions(sessionId, item.actions, player.id, payload.targetPlayerId ? { targetPlayerId: payload.targetPlayerId } : {});
          return { ...inner, session: inner.session ?? saved };
        }
        return { session: saved };
      }

      case 'TELEPORT': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        const map = this.mapsService.findOne(session.mapId);
        let dest: string;
        if (payload.toCellId) {
          if (!map.cells.find(c => c.id === payload.toCellId)) throw new NotFoundException(`Cell ${payload.toCellId} not found`);
          dest = payload.toCellId;
        } else {
          const connectedIds = new Set(map.edges.map(e => e.from));
          const pathCells = map.cells.filter(c => connectedIds.has(c.id));
          if (!pathCells.length) throw new BadRequestException('No path cells on map');
          dest = pathCells[Math.floor(Math.random() * pathCells.length)].id;
        }
        const from = player.currentCellId;
        player.currentCellId = dest;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `teleported from ${from} to ${dest}`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'GIVE_GOLD': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        player.gold = player.gold + payload.amount!;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `GM gave ${payload.amount}g (total: ${player.gold}g)`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'TAKE_GOLD': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        player.gold = player.gold - payload.amount!;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `GM took ${payload.amount}g (total: ${player.gold}g)`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'GIVE_ITEM': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        const item = this.itemsService.findOne(payload.itemId!);
        player.inventory.push({ ...item });
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `GM gave ${item.name}`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'BUY_ITEM': {
        return { session: this.buyItem(sessionId, payload.playerId!, payload.itemId!) };
      }

      case 'SPIN_WHEEL': {
        const spunEntry = this.wheelsService.spin(payload.wheelId!);
        return { spunEntry };
      }

      case 'CHANGE_CELL_TYPE': {
        const session = this.findOne(sessionId);
        const map = this.mapsService.findOne(session.mapId);
        if (!map.cells.find(c => c.id === payload.cellId)) throw new NotFoundException(`Cell ${payload.cellId} not found`);
        const PATH_TYPES = ['plain', 'shop', 'trap', 'boss', 'loot', 'chance', 'jail'] as const;
        const newType = payload.label && !payload.cellType
          ? 'plain'
          : (payload.cellType ?? PATH_TYPES[Math.floor(Math.random() * PATH_TYPES.length)]);
        const existingCell = map.cells.find(c => c.id === payload.cellId);
        const dto: UpdateCellDto = {
          type: newType,
          label: payload.label,
          ...(newType === 'trap' && !existingCell?.actions?.length
            ? { actions: [{ type: 'TAKE_GOLD', payload: { amount: 10 } }] }
            : newType === 'loot' && !existingCell?.actions?.length
              ? { actions: [{ type: 'GIVE_GOLD', payload: { amount: 10 } }] }
              : (newType !== 'trap' && existingCell?.type === 'trap') || (newType !== 'loot' && existingCell?.type === 'loot')
                ? { actions: null }
                : {}),
        };
        this.mapsService.updateCell(session.mapId, payload.cellId!, dto);
        const displayLabel = payload.label ? ` (${payload.label})` : '';
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: '', playerName: 'GM', action: `changed cell ${payload.cellId} to ${newType}${displayLabel}`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'CREATE_PATH': {
        const session = this.findOne(sessionId);
        const map = this.mapsService.findOne(session.mapId);
        const fromCell = map.cells.find(c => c.id === payload.fromCellId);
        const toCell = map.cells.find(c => c.id === payload.toCellId);
        if (!fromCell) throw new NotFoundException(`Cell ${payload.fromCellId} not found`);
        if (!toCell) throw new NotFoundException(`Cell ${payload.toCellId} not found`);
        const fwdExists = map.edges.some(e => e.from === payload.fromCellId && e.to === payload.toCellId);
        if (!fwdExists) {
          this.mapsService.toggleEdge(session.mapId, { from: payload.fromCellId!, to: payload.toCellId! });
          // jail is inward-only: skip adding the outward reverse edge
          if (toCell.type !== 'jail') {
            this.mapsService.toggleEdge(session.mapId, { from: payload.toCellId!, to: payload.fromCellId! });
          }
        }
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: '', playerName: 'GM', action: `created path ${payload.fromCellId} ↔ ${payload.toCellId}`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'DELETE_PATH': {
        const session = this.findOne(sessionId);
        const map = this.mapsService.findOne(session.mapId);
        const fwdExists = map.edges.some(e => e.from === payload.fromCellId && e.to === payload.toCellId);
        if (fwdExists) {
          this.mapsService.toggleEdge(session.mapId, { from: payload.fromCellId!, to: payload.toCellId! });
          this.mapsService.toggleEdge(session.mapId, { from: payload.toCellId!, to: payload.fromCellId! });
        }
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: '', playerName: 'GM', action: `deleted path ${payload.fromCellId} ↔ ${payload.toCellId}`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'BOSS_FIGHT_SPIN': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        // win weight = player.hp, lose weight = 5
        const winWeight = Math.max(0, player.hp ?? 3);
        if (winWeight === 0) throw new BadRequestException(`${player.name} has 0 hearts — cannot fight`);
        const won = Math.random() < winWeight / (winWeight + 5);
        let bossFight: BossFightSpinResult;
        if (won) {
          player.gold += 10;
          bossFight = { outcome: 'win', goldGained: 10 };
          session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `fought boss — WON! +10g (total: ${player.gold}g)`, timestamp: new Date().toISOString() });
        } else {
          player.hp = Math.max(0, player.hp - 1);
          bossFight = { outcome: 'lose', hpLost: 1 };
          session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `fought boss — LOST! −1 heart (${player.hp} remaining)`, timestamp: new Date().toISOString() });
          if (player.hp === 0) this.applyDeathSequence(session, player);
        }
        return { session: this.save(session), bossFight };
      }

      case 'SET_PLAYER_HP': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        const maxHp = player.maxHp ?? 3;
        const newHp = Math.max(0, Math.min(maxHp, payload.hp ?? maxHp));
        player.hp = newHp;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `GM set HP to ${newHp} heart${newHp !== 1 ? 's' : ''}`, timestamp: new Date().toISOString() });
        if (newHp === 0) this.applyDeathSequence(session, player);
        return { session: this.save(session) };
      }

      case 'ADJUST_MAX_HP': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        const delta = payload.amount ?? 1;
        const newMax = Math.max(1, (player.maxHp ?? 3) + delta);
        player.maxHp = newMax;
        player.hp = Math.min(player.hp, newMax);
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `GM ${delta > 0 ? 'increased' : 'decreased'} max hearts to ${newMax}`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'ADJUST_HP': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        const delta = payload.amount ?? 1;
        const newHp = Math.max(0, Math.min(player.maxHp ?? 3, player.hp + delta));
        player.hp = newHp;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `${delta > 0 ? `healed +${delta}` : `took ${delta}`} heart (${newHp} remaining)`, timestamp: new Date().toISOString() });
        if (newHp === 0) this.applyDeathSequence(session, player);
        return { session: this.save(session) };
      }

      case 'TELEPORT_TO_START': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        const map = this.mapsService.findOne(session.mapId);
        const startCell = map.cells.find(c => c.type === 'start');
        if (!startCell) throw new BadRequestException('No start cell on map');
        const from = player.currentCellId;
        player.currentCellId = startCell.id;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `teleported to start (from ${from})`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'STEAL_GOLD': {
        const session = this.findOne(sessionId);
        const thief = session.players.find(p => p.id === payload.playerId);
        if (!thief) throw new NotFoundException(`Player ${payload.playerId} not found`);
        const victim = session.players.find(p => p.id === payload.targetPlayerId);
        if (!victim) throw new NotFoundException(`Target player ${payload.targetPlayerId} not found`);
        const stolen = payload.amount ?? 10;
        victim.gold -= stolen;
        thief.gold += stolen;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: thief.id, playerName: thief.name, action: `stole ${stolen}g from ${victim.name} (thief: ${thief.gold}g, victim: ${victim.gold}g)`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'SWAP_PLAYERS': {
        const session = this.findOne(sessionId);
        const playerA = session.players.find(p => p.id === payload.playerId);
        if (!playerA) throw new NotFoundException(`Player ${payload.playerId} not found`);
        const playerB = session.players.find(p => p.id === payload.targetPlayerId);
        if (!playerB) throw new NotFoundException(`Target player ${payload.targetPlayerId} not found`);
        const cellA = playerA.currentCellId;
        playerA.currentCellId = playerB.currentCellId;
        playerB.currentCellId = cellA;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: playerA.id, playerName: playerA.name, action: `swapped positions with ${playerB.name}`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'RESET_MOVE': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        player.hasMoved = false;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `reset move — can move again`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'NOTIFY_GM': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `[GM prompt] ${payload.message ?? 'item used — awaiting GM response'}`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'DISTANCE_TO_END': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        const map = this.mapsService.findOne(session.mapId);
        const endCells = new Set((map.cells as Cell[]).filter(c => c.type === 'end').map(c => c.id));
        const adj = new Map<string, string[]>();
        for (const e of map.edges as Edge[]) {
          if (!adj.has(e.from)) adj.set(e.from, []);
          adj.get(e.from)!.push(e.to);
        }
        let dist: number | null = null;
        const queue: [string, number][] = [[player.currentCellId, 0]];
        const visited = new Set<string>();
        while (queue.length) {
          const [cellId, d] = queue.shift()!;
          if (visited.has(cellId)) continue;
          visited.add(cellId);
          if (endCells.has(cellId)) { dist = d; break; }
          for (const nb of adj.get(cellId) ?? []) queue.push([nb, d + 1]);
        }
        const msg = dist === null
          ? `[Oracle's Eye] no path to end cell found from current position`
          : `[Oracle's Eye] ${dist} step${dist !== 1 ? 's' : ''} to the end`;
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: msg, timestamp: new Date().toISOString() });
        return { session: this.save(session), distanceToEnd: dist };
      }

      case 'BROADCAST': {
        const session = this.findOne(sessionId);
        const broadcast: PlayerBroadcast = {
          message: payload.broadcastMessage ?? payload.message ?? '',
          timestamp: new Date().toISOString(),
        };
        session.playerBroadcast = broadcast;
        return { session: this.save(session) };
      }

      case 'END_TURN': {
        const playerId = payload.playerId;
        if (!playerId) throw new BadRequestException('playerId required for END_TURN');
        return { session: this.endTurn(sessionId, playerId) };
      }

      case 'SKIP_TURN': {
        const session = this.findOne(sessionId);
        const player = session.players.find(p => p.id === payload.playerId);
        if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `GM skipped turn`, timestamp: new Date().toISOString() });
        return { session: this.save(this.advanceTurn(session)) };
      }

      case 'REORDER_PLAYERS': {
        const session = this.findOne(sessionId);
        const order = payload.playerOrder ?? [];
        if (!order.every(id => session.players.find(p => p.id === id))) {
          throw new BadRequestException('Invalid player IDs in playerOrder');
        }
        session.turnOrder = order;
        // Reorder players array to match
        const playerMap = new Map(session.players.map(p => [p.id, p]));
        session.players = order.map(id => playerMap.get(id)!).filter(Boolean);
        session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: '', playerName: 'GM', action: `reordered turn order`, timestamp: new Date().toISOString() });
        return { session: this.save(session) };
      }

      case 'COMPLETE_SESSION': {
        const session = this.findOne(sessionId);
        session.status = 'completed';
        if (payload.winnerId) {
          const winner = session.players.find(p => p.id === payload.winnerId);
          if (!winner) throw new NotFoundException(`Player ${payload.winnerId} not found`);
          session.winnerId = winner.id;
          session.winTurn = session.currentTurn;
          session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: winner.id, playerName: winner.name, action: `GM declared ${winner.name} the winner`, timestamp: new Date().toISOString() });
        } else {
          session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: '', playerName: 'GM', action: `GM ended the session`, timestamp: new Date().toISOString() });
        }
        return { session: this.save(session) };
      }

      default:
        throw new BadRequestException(`Unknown action type: ${type}`);
    }
  }

  executePlayerAction(sessionId: number, type: PlayerActionType, payload: PlayerActionPayload): PlayerActionResult {
    const session = this.findOne(sessionId);
    const player = session.players.find(p => p.id === payload.playerId);
    if (!player) throw new NotFoundException(`Player ${payload.playerId} not found`);

    // Turn enforcement for actions that require it
    const TURN_ENFORCED: PlayerActionType[] = ['PLAYER_MOVE', 'PLAYER_BUY', 'PLAYER_SPIN_CHANCE', 'PLAYER_BOSS_FIGHT', 'PLAYER_SPIN_JAIL'];
    if (TURN_ENFORCED.includes(type) && session.activePlayerId !== payload.playerId) {
      throw new BadRequestException("It's not your turn");
    }

    switch (type) {

      case 'PLAYER_MOVE': {
        if (player.hasMoved)
          throw new BadRequestException('Already moved this turn');
        // same jail + adjacency checks as movePlayer
        const map = this.mapsService.findOne(session.mapId);
        const srcCell = map.cells.find(c => c.id === player.currentCellId);
        if (srcCell?.type === 'jail')
          throw new BadRequestException(`${player.name} is in jail — must spin the Jail Wheel to escape`);
        const destCell = map.cells.find(c => c.id === payload.toCellId);
        if (!destCell) throw new NotFoundException(`Cell ${payload.toCellId} not found`);
        if (!map.edges.some(e => e.from === player.currentCellId && e.to === payload.toCellId!))
          throw new BadRequestException(`${payload.toCellId} not adjacent to ${player.currentCellId}`);
        const movedSession = this.movePlayer(sessionId, payload.playerId, payload.toCellId!);
        // Surface passive event for trap/loot cells
        const destCellType = destCell.type;
        if (destCellType === 'trap' || destCellType === 'loot') {
          const amount = (destCell.actions?.[0]?.payload?.amount as number | undefined) ?? 10;
          const goldDelta = destCellType === 'trap' ? -amount : amount;
          return { session: movedSession, passiveEvent: { type: destCellType, goldDelta } };
        }
        return { session: movedSession };
      }

      case 'PLAYER_BUY': {
        if (!player.hasMoved) throw new BadRequestException('Move first before taking actions');
        const map = this.mapsService.findOne(session.mapId);
        const cell = map.cells.find(c => c.id === player.currentCellId);
        if (cell?.type !== 'shop')
          throw new BadRequestException(`${player.name} is not at a shop`);
        return { session: this.buyItem(sessionId, payload.playerId, payload.itemId!) };
      }

      case 'PLAYER_USE_ITEM': {
        // Guard: Wind Boots (RESET_MOVE) only useful after moving
        const freshSession = this.findOne(sessionId);
        const freshPlayer = freshSession.players.find(p => p.id === payload.playerId)!;
        const itemToUse = freshPlayer.inventory.find(i => i.id === payload.itemId);
        const firstActionType = itemToUse?.actions?.[0]?.type;
        if (firstActionType === 'RESET_MOVE' && !freshPlayer.hasMoved) {
          throw new BadRequestException('Wind Boots only useful after moving — move first');
        }
        if (firstActionType === 'SWAP_PLAYERS' && !payload.targetPlayerId) {
          throw new BadRequestException('Body Snatcher requires a target player');
        }
        const result = this.executeAction(sessionId, 'USE_ITEM', { playerId: payload.playerId, itemId: payload.itemId, targetPlayerId: payload.targetPlayerId });
        return { session: result.session!, ...(result.distanceToEnd !== undefined ? { distanceToEnd: result.distanceToEnd } : {}) };
      }

      case 'PLAYER_SPIN_CHANCE': {
        if (!player.hasMoved) throw new BadRequestException('Move first before taking actions');
        const map = this.mapsService.findOne(session.mapId);
        const cell = map.cells.find(c => c.id === player.currentCellId);
        if (cell?.type !== 'chance')
          throw new BadRequestException(`${player.name} is not on a chance cell`);
        // Use cell's attached wheel or configured default wheel
        const wheelId = cell.actions?.find(a => a.type === 'SPIN_WHEEL')?.payload?.wheelId as number | undefined;
        const gameConfig = this.gameConfigService.get();
        const resolvedWheelId = wheelId ?? gameConfig.cellConfig?.chance?.defaultWheelId;
        if (!resolvedWheelId) throw new BadRequestException('No wheel configured for chance cell');
        const spunEntry = this.wheelsService.spin(resolvedWheelId);
        if (spunEntry.actions?.length) {
          const actionResult = this.executeActions(sessionId, spunEntry.actions, payload.playerId);
          return { session: actionResult.session ?? this.findOne(sessionId), spunEntry };
        }
        return { session: this.findOne(sessionId), spunEntry };
      }

      case 'PLAYER_BOSS_FIGHT': {
        if (!player.hasMoved) throw new BadRequestException('Move first before taking actions');
        const map = this.mapsService.findOne(session.mapId);
        const cell = map.cells.find(c => c.id === player.currentCellId);
        if (cell?.type !== 'boss')
          throw new BadRequestException(`${player.name} is not on a boss cell`);
        const result = this.executeAction(sessionId, 'BOSS_FIGHT_SPIN', { playerId: payload.playerId });
        return { session: result.session!, bossFight: result.bossFight };
      }

      case 'PLAYER_SPIN_JAIL': {
        const map = this.mapsService.findOne(session.mapId);
        const jailCell = map.cells.find(c => c.id === player.currentCellId);
        if (jailCell?.type !== 'jail')
          throw new BadRequestException(`${player.name} is not in jail`);
        const gameConfig = this.gameConfigService.get();
        const jailWheelId = gameConfig.cellConfig?.jail?.defaultWheelId;
        if (!jailWheelId) throw new BadRequestException('No wheel configured for jail cell');
        const spunEntry = this.wheelsService.spin(jailWheelId);
        const label = (spunEntry.label ?? '').toLowerCase();
        const escaped = label.includes('escape') || label.includes('free') || label.includes('out');
        if (escaped) {
          const adjacentIds = (map.edges as Edge[])
            .filter(e => e.from === player.currentCellId)
            .map(e => e.to);
          const candidates = (map.cells as Cell[]).filter(c => adjacentIds.includes(c.id) && c.type !== 'jail');
          if (candidates.length === 0) throw new BadRequestException('No adjacent non-jail cells to escape to');
          const dest = candidates[Math.floor(Math.random() * candidates.length)];
          player.currentCellId = dest.id;
          player.hasMoved = true;
          session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `escaped jail to ${dest.id}`, timestamp: new Date().toISOString() });
          const savedAfterEscape = this.save(session);
          if (spunEntry.actions?.length) {
            const actionResult = this.executeActions(sessionId, spunEntry.actions, player.id);
            return { session: actionResult.session ?? savedAfterEscape, spunEntry };
          }
          return { session: savedAfterEscape, spunEntry };
        } else {
          player.hasMoved = true;
          session.log.unshift({ id: nextLogId(), turn: session.currentTurn, playerId: player.id, playerName: player.name, action: `spun jail wheel — still trapped`, timestamp: new Date().toISOString() });
          const savedTrapped = this.save(session);
          if (spunEntry.actions?.length) {
            const actionResult = this.executeActions(sessionId, spunEntry.actions, player.id);
            return { session: actionResult.session ?? savedTrapped, spunEntry };
          }
          return { session: savedTrapped, spunEntry };
        }
      }

      case 'PLAYER_END_TURN': {
        if (!player.hasMoved) throw new BadRequestException('You must move before ending your turn');
        return { session: this.endTurn(sessionId, payload.playerId) };
      }

      default:
        throw new BadRequestException(`Unknown player action type: ${type}`);
    }
  }
}
