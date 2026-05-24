import { Controller, Get, Patch, Body } from '@nestjs/common';
import { GameConfigService } from './game-config.service';
import type { GameConfig } from '@blind/shared';

@Controller('game-config')
export class GameConfigController {
  constructor(private readonly gameConfigService: GameConfigService) {}

  @Get()
  get() { return this.gameConfigService.get(); }

  @Patch()
  update(@Body() body: Partial<GameConfig>) { return this.gameConfigService.update(body); }
}
