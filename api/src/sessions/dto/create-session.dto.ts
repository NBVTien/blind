import { IsString, IsNumber, IsArray, ValidateNested, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class PlayerInputDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  color: string;
}

export class CreateSessionDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsNumber()
  mapId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerInputDto)
  players: PlayerInputDto[];
}
