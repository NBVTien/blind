import { IsString, IsArray, ValidateNested, IsNumber, IsOptional, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class WheelEntryInputDto {
  @IsString()
  @MinLength(1)
  label: string;

  @IsNumber()
  @Min(0.001)
  weight: number;

  @IsOptional()
  @IsArray()
  actions?: { type: string; payload: Record<string, unknown> }[];
}

export class CreateWheelDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WheelEntryInputDto)
  entries?: WheelEntryInputDto[];
}
