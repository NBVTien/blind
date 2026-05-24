import { Injectable, OnModuleInit } from '@nestjs/common';
import { DbService } from '../db.service';
import type { CellTypeConfigMap } from '@blind/shared';

@Injectable()
export class CellConfigService implements OnModuleInit {
  constructor(private readonly db: DbService) {}

  onModuleInit() {
    this.db.db.exec(`
      CREATE TABLE IF NOT EXISTS cell_config (
        id TEXT PRIMARY KEY DEFAULT 'global',
        config TEXT NOT NULL DEFAULT '{}'
      );
    `);
    const row = this.db.db.prepare("SELECT id FROM cell_config WHERE id = 'global'").get();
    if (!row) {
      this.db.db.prepare("INSERT INTO cell_config (id, config) VALUES ('global', '{}')").run();
    }
  }

  get(): CellTypeConfigMap {
    const row = this.db.db.prepare("SELECT config FROM cell_config WHERE id = 'global'").get() as { config: string } | undefined;
    return row ? JSON.parse(row.config) : {};
  }

  update(config: CellTypeConfigMap): CellTypeConfigMap {
    this.db.db.prepare("UPDATE cell_config SET config = ? WHERE id = 'global'").run(JSON.stringify(config));
    return this.get();
  }
}
