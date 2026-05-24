import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

export class UpdateCellDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsArray()
  actions?: { type: string; payload: Record<string, unknown> }[] | null;

  @IsOptional()
  @IsNumber()
  bossHp?: number;
}
