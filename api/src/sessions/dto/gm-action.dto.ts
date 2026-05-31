import { IsString, IsIn, IsObject } from 'class-validator';

const ACTION_TYPES = [
  'MOVE', 'USE_ITEM', 'TELEPORT', 'TELEPORT_TO_START', 'GIVE_GOLD', 'TAKE_GOLD',
  'GIVE_ITEM', 'BUY_ITEM', 'SPIN_WHEEL', 'CHANGE_CELL_TYPE',
  'CREATE_PATH', 'DELETE_PATH', 'BOSS_FIGHT_SPIN', 'SET_PLAYER_HP', 'ADJUST_MAX_HP',
  'ADJUST_HP', 'SWAP_PLAYERS', 'STEAL_GOLD', 'RESET_MOVE', 'NOTIFY_GM',
  'DISTANCE_TO_END', 'REVEAL_ADJACENT', 'BROADCAST',
  'END_TURN', 'SKIP_TURN', 'REORDER_PLAYERS', 'COMPLETE_SESSION',
  'ADD_PLAYER', 'CLEAR_SKIP',
] as const;

export class GmActionDto {
  @IsString()
  @IsIn(ACTION_TYPES)
  type: string;

  @IsObject()
  payload: Record<string, unknown>;
}
