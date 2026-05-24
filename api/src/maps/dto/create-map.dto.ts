import { IsString, IsNumber, Min, Max, MinLength, IsOptional, IsArray, IsIn } from 'class-validator';
import { SPECIAL_CELL_TYPES } from '@blind/shared';

export class CreateMapDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsNumber()
  @Min(4)
  @Max(12)
  gridW: number;

  @IsNumber()
  @Min(4)
  @Max(12)
  gridH: number;

  /** 0–100: how many branches/cells (0=sparse linear, 100=dense tangled) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  density?: number;

  /** 0–100: how much the main path zigzags (0=direct, 100=chaotic wander) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  chaos?: number;

  /** 0–100: probability of special cells (0=all plain, 100=mostly special) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  specialRate?: number;

  /** 0–100: extra cross-connections between branches (0=none, 100=many shortcuts) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  connectivity?: number;

  /** which special cell types may appear (default: all) */
  @IsOptional()
  @IsArray()
  @IsIn(SPECIAL_CELL_TYPES, { each: true })
  specialTypes?: string[]; // validated against SpecialCellType values

  /** if true, place start/end on random path cells instead of fixed corners */
  @IsOptional()
  randomStartEnd?: boolean;
}
