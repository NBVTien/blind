import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { IsString, IsNumber } from 'class-validator';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { GmActionDto } from './dto/gm-action.dto';
import { PlayerActionDto } from './dto/player-action.dto';
import type { ActionType, GmActionPayload, PlayerActionType, PlayerActionPayload } from '@blind/shared';

class MovePlayerDto { @IsString() playerId: string; @IsString() toCellId: string; }
class BuyItemDto { @IsString() playerId: string; @IsNumber() itemId: number; }
class AdjustGoldDto { @IsString() playerId: string; @IsNumber() amount: number; }

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  findAll() { return this.sessionsService.findAll(); }

  @Post()
  create(@Body() dto: CreateSessionDto) { return this.sessionsService.create(dto); }

  @Get('by-code/:code')
  findByCode(@Param('code') code: string) { return this.sessionsService.findByCode(code); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.sessionsService.findOne(Number(id)); }

  @Post(':id/move')
  move(@Param('id') id: string, @Body() body: MovePlayerDto) { return this.sessionsService.movePlayer(Number(id), body.playerId, body.toCellId); }

  @Post(':id/buy')
  buy(@Param('id') id: string, @Body() body: BuyItemDto) { return this.sessionsService.buyItem(Number(id), body.playerId, body.itemId); }

  @Post(':id/gold')
  gold(@Param('id') id: string, @Body() body: AdjustGoldDto) { return this.sessionsService.adjustGold(Number(id), body.playerId, body.amount); }

  @Post(':id/turn')
  incrementTurn(@Param('id') id: string) { return this.sessionsService.incrementTurn(Number(id)); }

  @Post(':id/end-turn')
  endTurn(@Param('id') id: string, @Body() body: { playerId: string }) { return this.sessionsService.endTurn(Number(id), body.playerId); }

  @Post(':id/action')
  action(@Param('id') id: string, @Body() body: GmActionDto) {
    return this.sessionsService.executeAction(Number(id), body.type as ActionType, body.payload as GmActionPayload);
  }

  @Post(':id/player-action')
  playerAction(@Param('id') id: string, @Body() body: PlayerActionDto) {
    return this.sessionsService.executePlayerAction(Number(id), body.type as PlayerActionType, body.payload as unknown as PlayerActionPayload);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.sessionsService.remove(Number(id));
    return { deleted: true };
  }
}
