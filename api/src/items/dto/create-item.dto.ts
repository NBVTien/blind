import { IsString, IsNumber, IsOptional, IsArray, MinLength } from 'class-validator';

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  cost: number;

  @IsOptional()
  @IsArray()
  actions?: { type: string; payload: Record<string, unknown> }[];
}
