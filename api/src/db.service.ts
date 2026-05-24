import { Injectable, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import path from 'path';

const SCHEMA_VERSION = 2;

@Injectable()
export class DbService implements OnModuleInit {
  db: Database.Database;

  onModuleInit() {
    const dbPath = path.resolve(process.cwd(), '..', 'blind.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.ensureSchemaVersion();
    this.migrate();
  }

  private ensureSchemaVersion() {
    const current = (this.db.pragma('user_version') as { user_version: number }[])[0]?.user_version ?? 0;
    if (current < SCHEMA_VERSION) {
      this.migrateToIntegerIds();
      this.db.pragma(`user_version = ${SCHEMA_VERSION}`);
    }
  }

  private migrateToIntegerIds() {
    // Disable FK enforcement during migration
    this.db.pragma('foreign_keys = OFF');

    const hasMaps = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='maps'").get();
    if (!hasMaps) {
      this.db.pragma('foreign_keys = ON');
      return; // fresh DB, nothing to migrate
    }

    this.db.transaction(() => {
      // ── maps ────────────────────────────────────────────────
      this.db.exec(`ALTER TABLE maps RENAME TO _old_maps`);
      this.db.exec(`
        CREATE TABLE maps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL, grid_w INTEGER NOT NULL, grid_h INTEGER NOT NULL,
          cells TEXT NOT NULL, edges TEXT NOT NULL, created_at TEXT NOT NULL
        )
      `);
      const oldMaps = this.db.prepare('SELECT * FROM _old_maps').all() as { id: string; name: string; grid_w: number; grid_h: number; cells: string; edges: string; created_at: string }[];
      const mapIdMap = new Map<string, number>(); // old uuid → new int
      const insertMap = this.db.prepare('INSERT INTO maps (name, grid_w, grid_h, cells, edges, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      for (const row of oldMaps) {
        const result = insertMap.run(row.name, row.grid_w, row.grid_h, row.cells, row.edges, row.created_at);
        mapIdMap.set(row.id, Number(result.lastInsertRowid));
      }

      // ── items ───────────────────────────────────────────────
      this.db.exec(`ALTER TABLE items RENAME TO _old_items`);
      this.db.exec(`
        CREATE TABLE items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL, description TEXT NOT NULL, cost INTEGER NOT NULL, action TEXT
        )
      `);
      const oldItems = this.db.prepare('SELECT * FROM _old_items').all() as { id: string; name: string; description: string; cost: number; action: string | null }[];
      const itemIdMap = new Map<string, number>();
      const insertItem = this.db.prepare('INSERT INTO items (name, description, cost, action) VALUES (?, ?, ?, ?)');
      for (const row of oldItems) {
        const result = insertItem.run(row.name, row.description, row.cost, row.action);
        itemIdMap.set(row.id, Number(result.lastInsertRowid));
      }

      // ── wheels ──────────────────────────────────────────────
      this.db.exec(`ALTER TABLE wheels RENAME TO _old_wheels`);
      this.db.exec(`
        CREATE TABLE wheels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL, entries TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
        )
      `);
      const oldWheels = this.db.prepare('SELECT * FROM _old_wheels').all() as { id: string; name: string; entries: string; created_at: string }[];
      const wheelIdMap = new Map<string, number>();
      const insertWheel = this.db.prepare('INSERT INTO wheels (name, entries, created_at) VALUES (?, ?, ?)');
      for (const row of oldWheels) {
        // Rewrite itemId references inside wheel entry actions
        const entries = JSON.parse(row.entries) as Array<{ id: string; label: string; weight: number; action?: { type: string; payload: Record<string, unknown> } }>;
        for (const e of entries) {
          if (e.action?.payload?.itemId && typeof e.action.payload.itemId === 'string') {
            e.action.payload.itemId = itemIdMap.get(e.action.payload.itemId) ?? e.action.payload.itemId;
          }
          if (e.action?.payload?.wheelId && typeof e.action.payload.wheelId === 'string') {
            // wheelId refs inside entries resolved after we know all wheel new IDs — skip for now, handled below
          }
        }
        const result = insertWheel.run(row.name, JSON.stringify(entries), row.created_at);
        wheelIdMap.set(row.id, Number(result.lastInsertRowid));
      }
      // Second pass: rewrite wheelId refs inside wheel entries
      for (const row of oldWheels) {
        const newId = wheelIdMap.get(row.id)!;
        const entries = JSON.parse(row.entries) as Array<{ action?: { payload: Record<string, unknown> } }>;
        let changed = false;
        for (const e of entries) {
          if (e.action?.payload?.wheelId && typeof e.action.payload.wheelId === 'string') {
            const mapped = wheelIdMap.get(e.action.payload.wheelId as string);
            if (mapped !== undefined) { e.action.payload.wheelId = mapped; changed = true; }
          }
        }
        if (changed) this.db.prepare('UPDATE wheels SET entries = ? WHERE id = ?').run(JSON.stringify(entries), newId);
      }

      // ── sessions ────────────────────────────────────────────
      const hasSessionsCols = this.db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
      const hasSessions = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get();
      if (hasSessions) {
        this.db.exec(`ALTER TABLE sessions RENAME TO _old_sessions`);
        this.db.exec(`
          CREATE TABLE sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL DEFAULT '',
            name TEXT NOT NULL, map_id INTEGER NOT NULL, map_name TEXT NOT NULL,
            players TEXT NOT NULL, log TEXT NOT NULL DEFAULT '[]',
            current_turn INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL,
            player_broadcast TEXT,
            turn_order TEXT NOT NULL DEFAULT '[]',
            active_player_id TEXT,
            turn_done_ids TEXT NOT NULL DEFAULT '[]',
            winner_id TEXT,
            win_turn INTEGER
          )
        `);
        const colNames = hasSessionsCols.map(c => c.name);
        const oldSessions = this.db.prepare('SELECT * FROM _old_sessions').all() as Record<string, unknown>[];
        const insertSession = this.db.prepare(
          'INSERT INTO sessions (code, name, map_id, map_name, players, log, current_turn, status, created_at, player_broadcast, turn_order, active_player_id, turn_done_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const row of oldSessions) {
          const oldMapId = row.map_id as string;
          const newMapId = mapIdMap.get(oldMapId) ?? 1;

          // Rewrite item IDs inside players JSON inventories
          const players = JSON.parse(row.players as string) as Array<{ inventory: Array<{ id: string; action?: { payload?: Record<string, unknown> } }> }>;
          for (const p of players) {
            for (const item of (p.inventory ?? [])) {
              if (typeof item.id === 'string' && itemIdMap.has(item.id)) {
                (item as unknown as Record<string, unknown>).id = itemIdMap.get(item.id)!;
              }
              if (item.action?.payload?.itemId && typeof item.action.payload.itemId === 'string') {
                item.action.payload.itemId = itemIdMap.get(item.action.payload.itemId) ?? item.action.payload.itemId;
              }
              if (item.action?.payload?.wheelId && typeof item.action.payload.wheelId === 'string') {
                item.action.payload.wheelId = wheelIdMap.get(item.action.payload.wheelId) ?? item.action.payload.wheelId;
              }
            }
          }

          // Rewrite wheelId / itemId / mapId refs inside log entries
          const log = JSON.parse((row.log as string) || '[]') as Array<Record<string, unknown>>;

          insertSession.run(
            colNames.includes('code') ? (row.code ?? '') : '',
            row.name,
            newMapId,
            row.map_name,
            JSON.stringify(players),
            JSON.stringify(log),
            row.current_turn ?? 1,
            row.status ?? 'active',
            row.created_at,
            row.player_broadcast ?? null,
            colNames.includes('turn_order') ? (row.turn_order ?? '[]') : '[]',
            colNames.includes('active_player_id') ? (row.active_player_id ?? null) : null,
            colNames.includes('turn_done_ids') ? (row.turn_done_ids ?? '[]') : '[]',
          );
        }
      }

      // Cleanup old tables
      this.db.exec(`
        DROP TABLE IF EXISTS _old_maps;
        DROP TABLE IF EXISTS _old_items;
        DROP TABLE IF EXISTS _old_wheels;
        DROP TABLE IF EXISTS _old_sessions;
        DROP TABLE IF EXISTS play_links;
      `);

      // Rewrite defaultWheelId in cell_config / game_config tables if they exist
      for (const cfgTable of ['cell_config', 'game_config']) {
        const exists = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${cfgTable}'`).get();
        if (!exists) continue;
        const cfgRow = this.db.prepare(`SELECT * FROM ${cfgTable} LIMIT 1`).get() as Record<string, unknown> | undefined;
        if (!cfgRow) continue;
        // game_config stores JSON in a 'value' or 'config' column
        for (const col of ['value', 'config', 'data']) {
          if (cfgRow[col] && typeof cfgRow[col] === 'string') {
            try {
              const parsed = JSON.parse(cfgRow[col] as string);
              const cellCfg = parsed.cellConfig ?? parsed;
              let changed = false;
              for (const type of Object.keys(cellCfg)) {
                if (typeof cellCfg[type]?.defaultWheelId === 'string') {
                  const mapped = wheelIdMap.get(cellCfg[type].defaultWheelId);
                  if (mapped !== undefined) { cellCfg[type].defaultWheelId = mapped; changed = true; }
                }
              }
              if (changed) {
                this.db.prepare(`UPDATE ${cfgTable} SET ${col} = ?`).run(JSON.stringify(parsed));
              }
            } catch { /* not JSON, skip */ }
          }
        }
      }
    })();

    this.db.pragma('foreign_keys = ON');
  }

  private migrate() {
    // Add new columns to existing tables (idempotent: ignore if already present)
    const addColIfMissing = (table: string, col: string, def: string) => {
      const cols = (this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);
      if (!cols.includes(col)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    };

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS maps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        grid_w INTEGER NOT NULL,
        grid_h INTEGER NOT NULL,
        cells TEXT NOT NULL,
        edges TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        map_id INTEGER NOT NULL,
        map_name TEXT NOT NULL,
        players TEXT NOT NULL,
        log TEXT NOT NULL DEFAULT '[]',
        current_turn INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        player_broadcast TEXT,
        turn_order TEXT NOT NULL DEFAULT '[]',
        active_player_id TEXT,
        turn_done_ids TEXT NOT NULL DEFAULT '[]',
        winner_id TEXT,
        win_turn INTEGER
      );

      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        cost INTEGER NOT NULL,
        action TEXT
      );

      CREATE TABLE IF NOT EXISTS wheels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        entries TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS map_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        params TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    addColIfMissing('sessions', 'winner_id', 'TEXT');
    addColIfMissing('sessions', 'win_turn', 'INTEGER');
  }
}
