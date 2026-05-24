import { IsString, IsNumber, Min, Max, MinLength, IsOptional, IsArray, IsIn } from 'class-validator';
import { SPECIAL_CELL_TYPES } from '@blind/shared';

export class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  density?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  chaos?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  specialRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  connectivity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  oneWayRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  portalCount?: number;

  @IsOptional()
  @IsArray()
  @IsIn(SPECIAL_CELL_TYPES, { each: true })
  specialTypes?: string[];

  @IsOptional()
  randomStartEnd?: boolean;
}
