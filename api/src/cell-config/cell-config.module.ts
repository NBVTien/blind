import { Module } from '@nestjs/common';
import { CellConfigController } from './cell-config.controller';
import { CellConfigService } from './cell-config.service';

@Module({
  controllers: [CellConfigController],
  providers: [CellConfigService],
  exports: [CellConfigService],
})
export class CellConfigModule {}
