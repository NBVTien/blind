import { IsString, IsArray, ValidateNested, IsOptional, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { WheelEntryInputDto } from './create-wheel.dto';

export class UpdateWheelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WheelEntryInputDto)
  entries?: WheelEntryInputDto[];
}
