import { IsString, IsIn, IsObject } from 'class-validator';

const PLAYER_ACTION_TYPES = [
  'PLAYER_MOVE', 'PLAYER_BUY', 'PLAYER_USE_ITEM', 'PLAYER_SPIN_CHANCE', 'PLAYER_BOSS_FIGHT', 'PLAYER_SPIN_JAIL',
] as const;

export class PlayerActionDto {
  @IsString()
  @IsIn(PLAYER_ACTION_TYPES)
  type: string;

  @IsObject()
  payload: Record<string, unknown>;
}
