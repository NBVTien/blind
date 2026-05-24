import { Injectable, OnModuleInit } from '@nestjs/common';
import { DbService } from '../db.service';
import type { GameConfig, CellTypeConfigMap, DeathActionStep, WinCondition } from '@blind/shared';

const DEFAULT_DEATH_SEQUENCE: DeathActionStep[] = [
  { type: 'SKIP_TURNS', count: 3 },
  { type: 'RESPAWN_AT_START', hp: 1 },
];

const DEFAULT_WIN_CONDITIONS: WinCondition[] = [];

@Injectable()
export class GameConfigService implements OnModuleInit {
  constructor(private readonly db: DbService) {}

  onModuleInit() {
    this.db.db.exec(`
      CREATE TABLE IF NOT EXISTS game_config (
        id TEXT PRIMARY KEY DEFAULT 'global',
        config TEXT NOT NULL DEFAULT '{}'
      );
    `);
    const row = this.db.db.prepare("SELECT id FROM game_config WHERE id = 'global'").get();
    if (!row) {
      // Migrate from cell_config if present
      const cellRow = this.db.db.prepare("SELECT config FROM cell_config WHERE id = 'global'").get() as { config: string } | undefined;
      const cellConfig: CellTypeConfigMap = cellRow ? JSON.parse(cellRow.config) : {};
      const initial: GameConfig = { cellConfig, deathSequence: DEFAULT_DEATH_SEQUENCE, winConditions: DEFAULT_WIN_CONDITIONS };
      this.db.db.prepare("INSERT INTO game_config (id, config) VALUES ('global', ?)").run(JSON.stringify(initial));
    }
  }

  get(): GameConfig {
    const row = this.db.db.prepare("SELECT config FROM game_config WHERE id = 'global'").get() as { config: string } | undefined;
    const raw = row ? JSON.parse(row.config) : {};
    const cellConfig: CellTypeConfigMap = raw.cellConfig ?? {};
    // back-compat: migrate defaultAction (singular) → defaultActions (array)
    for (const key of Object.keys(cellConfig) as (keyof CellTypeConfigMap)[]) {
      const cfg = cellConfig[key] as any;
      if (cfg && cfg.defaultAction && !cfg.defaultActions) {
        cfg.defaultActions = [cfg.defaultAction];
        delete cfg.defaultAction;
      }
    }
    // back-compat: migrate single winCondition → winConditions array
    let winConditions: WinCondition[] = raw.winConditions ?? DEFAULT_WIN_CONDITIONS;
    if (!raw.winConditions && raw.winCondition) {
      const old = raw.winCondition as { type: string; turns?: number };
      if (old.type === 'FIRST_TO_END_WITH_POSITIVE_GOLD') {
        winConditions = [{ type: 'FIRST_TO_END' }, { type: 'POSITIVE_GOLD' }];
      } else if (old.type === 'FIRST_TO_END') {
        winConditions = [{ type: 'FIRST_TO_END' }];
      } else if (old.type === 'MOST_GOLD_AFTER_TURNS' && old.turns != null) {
        winConditions = [{ type: 'MOST_GOLD_AFTER_TURNS', turns: old.turns }];
      } else if (old.type === 'LEAST_DEATHS_AFTER_TURNS' && old.turns != null) {
        winConditions = [{ type: 'LEAST_DEATHS_AFTER_TURNS', turns: old.turns }];
      } else {
        winConditions = [];
      }
    }
    return {
      cellConfig,
      deathSequence: raw.deathSequence ?? DEFAULT_DEATH_SEQUENCE,
      winConditions,
    };
  }

  update(patch: Partial<GameConfig>): GameConfig {
    const current = this.get();
    const next: GameConfig = { ...current, ...patch };
    this.db.db.prepare("UPDATE game_config SET config = ? WHERE id = 'global'").run(JSON.stringify(next));
    return this.get();
  }
}
