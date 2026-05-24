import { IsString } from 'class-validator';

export class ToggleEdgeDto {
  @IsString()
  from: string;

  @IsString()
  to: string;
}
