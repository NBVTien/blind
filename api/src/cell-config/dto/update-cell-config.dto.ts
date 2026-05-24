import { IsOptional, IsObject } from 'class-validator';

export class UpdateCellConfigDto {
  @IsOptional()
  @IsObject()
  config: Record<string, {
    defaultWheelId?: number;
    defaultBossHp?: number;
    defaultAction?: Record<string, unknown>;
  }>;
}
