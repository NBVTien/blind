import { Controller, Get, Patch, Body } from '@nestjs/common';
import { CellConfigService } from './cell-config.service';
import { UpdateCellConfigDto } from './dto/update-cell-config.dto';

@Controller('cell-config')
export class CellConfigController {
  constructor(private readonly cellConfigService: CellConfigService) {}

  @Get()
  get() { return this.cellConfigService.get(); }

  @Patch()
  update(@Body() dto: UpdateCellConfigDto) { return this.cellConfigService.update(dto.config as never); }
}
